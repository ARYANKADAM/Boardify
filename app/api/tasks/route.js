import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';
import Task from '../../../models/Task';
import List from '../../../models/List';
import Activity from '../../../models/Activity';
import jwt from 'jsonwebtoken';
import logger from '../../../lib/logger';
import { canPerform } from '../../../lib/permissions';

const JWT_SECRET = process.env.JWT_SECRET;

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

export async function POST(req) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { listId, title, description, assignedTo, dueDate, priority, position } = await req.json();
  if (!listId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  // permission: members (and owner/admin) may create tasks
  let list = null;
  try {
    list = await List.findById(listId);
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });
    const Board = (await import('../../../models/Board')).default;
    const boardId = list ? String(list.boardId) : null;
    if (!boardId) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    const board = await Board.findById(boardId);
    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    if (!canPerform(user, board, 'createTask')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e) {
    logger.error(e, 'permission check failed for task create');
    return NextResponse.json({ error: 'Permission check failed' }, { status: 500 });
  }

  const task = await Task.create({ listId, title, description, assignedTo, dueDate, priority, position });
  // update the list tasks array (use the already-fetched list)
  try {
    await List.findByIdAndUpdate(listId, { $push: { tasks: task._id } });
  } catch (e) {
    logger.error(e, 'failed to push task into list');
  }
  // Broadcast to socket server (best-effort)
  try {
    const SOCKET_SERVER = process.env.SOCKET_SERVER_URL || 'http://localhost:4001';
    // fetch list to determine boardId
    const list = await List.findById(listId);
    const boardId = list ? String(list.boardId) : null;
    await fetch(`${SOCKET_SERVER}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'task:created', boardId, data: { task } }),
    });
  } catch (err) {
    logger.error(err, 'socket broadcast failed');
  }
  // Create activity
  try {
    const activity = await Activity.create({ boardId, userId: user.id, action: 'task.created', details: `${user.email} created task "${title}"` });
    // broadcast activity with populated user info
    const populatedActivity = await Activity.findById(activity._id).populate('userId', 'name email');
    await fetch(`${SOCKET_SERVER}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'activity:created', boardId, data: populatedActivity }),
    });
  } catch (err) {
    logger.error(err, 'activity create failed');
  }
  return NextResponse.json({ task }, { status: 201 });
}
