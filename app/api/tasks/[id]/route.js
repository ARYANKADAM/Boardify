import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import Task from '../../../../models/Task';
import List from '../../../../models/List';
import Activity from '../../../../models/Activity';
import Board from '../../../../models/Board';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import logger from '../../../../lib/logger';
import { canPerform } from '../../../../lib/permissions';

const JWT_SECRET = process.env.JWT_SECRET;

// ----------------------
//  AUTH HELPER
// ----------------------
function getUserFromToken(req) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;

  const token = auth.replace('Bearer ', '');
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ----------------------
//  UPDATE TASK (PUT)
// ----------------------
export async function PUT(req, context) {
  await connectToDatabase();

  const user = getUserFromToken(req);
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ FIX: params must be awaited
  const { id } = await context.params;

  // parse body once (will be used for permission checks)
  const body = await req.json();
  const { title, description, assignedTo, dueDate, priority, position, listId } = body;

  const task = await Task.findById(id);
  if (!task)
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // permission: ensure user can delete this task
  try {
    const board = await Board.findById((await List.findById(task.listId))?.boardId);
    if (!canPerform(user, board, 'deleteTask')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e) {
    logger.error(e, 'permission check failed for task delete');
  }

  // Determine boardId for permission checks (use destination if provided)
  let boardId = null;
  try {
    if (listId) {
      const destList = await List.findById(listId);
      boardId = destList ? String(destList.boardId) : null;
    } else {
      const currentList = await List.findById(task.listId);
      boardId = currentList ? String(currentList.boardId) : null;
    }
  } catch (e) {
    logger.error(e, 'failed to determine board for permission check');
  }

  if (boardId) {
    const board = await Board.findById(boardId);
    if (!canPerform(user, board, 'editTask')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Update properties
  if (title) task.title = title;
  if (description) task.description = description;
  if (assignedTo) task.assignedTo = assignedTo;
  if (dueDate) task.dueDate = dueDate;
  if (priority) task.priority = priority;
  // We'll update positions below; don't set `task.position` yet if reindexing

  const oldListId = String(task.listId);
  const targetListId = listId ? String(listId) : oldListId;

  // If moving between lists or reordering within same list, reindex both lists
  if (position !== undefined) {
    // Use a transaction for multi-document reorders to maintain consistency
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Fetch source and destination tasks as docs ordered by position using session
        const sourceId = String(task.listId);
        const destId = listId ? String(listId) : sourceId;

        if (destId !== sourceId) {
          const sourceTasks = await Task.find({ listId: sourceId, _id: { $ne: task._id } }).sort({ position: 1 }).session(session);
          const destTasks = await Task.find({ listId: destId }).sort({ position: 1 }).session(session);

          const insertAt = Math.max(0, Math.min(position, destTasks.length));

          const newDestTasks = destTasks.slice();
          newDestTasks.splice(insertAt, 0, task);

          for (let i = 0; i < newDestTasks.length; i++) {
            const t = newDestTasks[i];
            t.position = i;
            t.listId = destId;
            await t.save({ session });
          }

          for (let i = 0; i < sourceTasks.length; i++) {
            sourceTasks[i].position = i;
            await sourceTasks[i].save({ session });
          }

          await List.findByIdAndUpdate(destId, { tasks: newDestTasks.map(t => t._id) }, { session });
          await List.findByIdAndUpdate(sourceId, { tasks: sourceTasks.map(t => t._id) }, { session });

        } else {
          // same-list reorder
          const tasksInList = await Task.find({ listId: sourceId }).sort({ position: 1 }).session(session);
          const others = tasksInList.filter(t => String(t._id) !== String(task._id));
          const insertAt = Math.max(0, Math.min(position, others.length));
          const newOrder = [];
          for (let i = 0; i < insertAt; i++) newOrder.push(others[i]);
          newOrder.push(task);
          for (let i = insertAt; i < others.length; i++) newOrder.push(others[i]);

          for (let i = 0; i < newOrder.length; i++) {
            newOrder[i].position = i;
            newOrder[i].listId = sourceId;
            await newOrder[i].save({ session });
          }

          await List.findByIdAndUpdate(sourceId, { tasks: newOrder.map(t => t._id) }, { session });
        }
      });
    } catch (e) {
      logger.error(e, 'transactional reorder failed');
      await session.endSession();
      return NextResponse.json({ error: 'Reorder failed' }, { status: 500 });
    } finally {
      try { await session.endSession(); } catch (e) {}
    }

    // refresh task from DB after transaction
    const refreshed = await Task.findById(id);
    Object.assign(task, refreshed.toObject());

  } else {
    // no position provided — just save property updates
    if (title || description || assignedTo || dueDate || priority) {
      await task.save();
    }
  }

  // Broadcast move/update to socket server
  try {
    const SOCKET_SERVER = process.env.SOCKET_SERVER_URL || 'http://localhost:4001';
    // determine boardId from destination list or task.listId
    const destList = await List.findById(task.listId);
    const boardId = destList ? String(destList.boardId) : null;
    await fetch(`${SOCKET_SERVER}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'task:moved', boardId, data: { taskId: task._id, listId: task.listId, position: task.position } }),
    });
    // create activity (include destination list title for readability)
    try {
      const destListTitle = destList && destList.title ? destList.title : String(task.listId);
      const details = `${user.email} moved task "${task.title}" to list "${destListTitle}"`;
      const activity = await Activity.create({ boardId, userId: user.id, action: 'task.moved', details });
      // broadcast activity with populated user info
      const populatedActivity = await Activity.findById(activity._id).populate('userId', 'name email');
      await fetch(`${SOCKET_SERVER}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'activity:created', boardId, data: populatedActivity }),
      });
    } catch (e) {
      logger.error(e, 'activity create failed');
    }
  } catch (err) {
    logger.error(err, 'socket broadcast failed');
  }

  return NextResponse.json({ task }, { status: 200 });
}

// ----------------------
//  DELETE TASK (DELETE)
// ----------------------
export async function DELETE(req, context) {
  await connectToDatabase();

  const user = getUserFromToken(req);
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ✅ FIX: unwrap params properly
  const { id } = await context.params;

  if (!id)
    return NextResponse.json({ error: 'Missing id param' }, { status: 400 });

  const task = await Task.findById(id);
  if (!task)
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // permission: ensure user can delete this task
  try {
    const list = await List.findById(task.listId);
    const board = list ? await Board.findById(list.boardId) : null;
    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!canPerform(user, board, 'deleteTask')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e) {
    logger.error(e, 'permission check failed for task delete');
    return NextResponse.json({ error: 'Permission check failed' }, { status: 500 });
  }

  // Remove from list.tasks[] array
  await List.findByIdAndUpdate(task.listId, {
    $pull: { tasks: task._id },
  });

  // Delete task
  await task.deleteOne();

  // Reindex remaining tasks in the list so positions stay contiguous
  try {
    const remaining = await Task.find({ listId: task.listId }).sort({ position: 1 });
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].position = i;
    }
    if (remaining.length > 0) await Promise.all(remaining.map(t => t.save()));
    await List.findByIdAndUpdate(task.listId, { tasks: remaining.map(t => t._id) });
  } catch (err) {
    logger.error(err, 'reindex after delete failed');
  }

  // Broadcast deletion and create activity
  try {
    const SOCKET_SERVER = process.env.SOCKET_SERVER_URL || 'http://localhost:4001';
    const boardId = String(task.listId ? (await List.findById(task.listId)).boardId : null);
    await fetch(`${SOCKET_SERVER}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'task:deleted', boardId, data: { taskId: task._id } }),
    });
    try {
      const activity = await Activity.create({ boardId, userId: user.id, action: 'task.deleted', details: `${user.email} deleted task "${task.title}"` });
      // broadcast activity with populated user info
      const populatedActivity = await Activity.findById(activity._id).populate('userId', 'name email');
      await fetch(`${SOCKET_SERVER}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'activity:created', boardId, data: populatedActivity }),
      });
    } catch (e) {
      logger.error(e, 'activity create failed');
    }
  } catch (err) {
    logger.error(err, 'socket broadcast failed');
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
