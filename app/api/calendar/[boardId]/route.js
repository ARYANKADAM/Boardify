import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import Task from '../../../../models/Task';
import jwt from 'jsonwebtoken';
import Board from '../../../../models/Board';
import logger from '../../../../lib/logger';

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

export async function GET(req, context) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = context && context.params ? await context.params : {};
  const { boardId } = params || {};
  if (!boardId) return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });

  // query params: from, to (ISO date strings)
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  // permission check: user must be member/owner/global admin
  try {
    const board = await Board.findById(boardId);
    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    const globalRole = (user.role || '').toString().toLowerCase();
    const isOwner = board && String(board.owner) === String(user.id);
    const isMember = board && Array.isArray(board.members) && board.members.some(m => {
      const uid = m && (m.user ? String(m.user) : String(m));
      return uid === String(user.id);
    });
    if (!(globalRole === 'admin' || globalRole === 'owner' || isOwner || isMember)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e) {
    logger.error(e, 'permission check failed for calendar.get');
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Build date filter - only include tasks that have due dates
  const filter = { dueDate: { $exists: true, $ne: null } };
  if (from || to) {
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate)) filter.dueDate.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate)) filter.dueDate.$lte = toDate;
    }
  }

  try {
    // Find tasks that belong to lists in this board and have due dates
    const tasks = await Task.find(filter)
      .populate({
        path: 'listId',
        match: { boardId: boardId }, // Only include tasks from lists in this board
        select: 'boardId'
      })
      .select('title dueDate listId _id')
      .then(tasks => tasks.filter(task => task.listId !== null)); // Filter out tasks where listId population failed (wrong board)
    
    return NextResponse.json({ tasks }, { status: 200 });
  } catch (e) {
    logger.error(e, 'failed to fetch calendar tasks');
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Update task due date (for drag and drop)
export async function PUT(req, context) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = context && context.params ? await context.params : {};
  const { boardId } = params || {};
  if (!boardId) return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });

  try {
    const board = await Board.findById(boardId);
    if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    const globalRole = (user.role || '').toString().toLowerCase();
    const isOwner = board && String(board.owner) === String(user.id);
    const isMember = board && Array.isArray(board.members) && board.members.some(m => {
      const uid = m && (m.user ? String(m.user) : String(m));
      return uid === String(user.id);
    });
    if (!(globalRole === 'admin' || globalRole === 'owner' || isOwner || isMember)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e) {
    logger.error(e, 'permission check failed for calendar.put');
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { taskId, newDate } = await req.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Update the task's due date
    const updateData = {};
    if (newDate) {
      updateData.dueDate = new Date(newDate);
    } else {
      updateData.dueDate = null;
    }

    const task = await Task.findByIdAndUpdate(
      taskId,
      updateData,
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Broadcast the update to all clients in the board room
    try {
      const SOCKET_SERVER = process.env.SOCKET_SERVER_URL || 'http://localhost:4001';
      await fetch(`${SOCKET_SERVER}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'task:updated',
          boardId,
          data: {
            taskId,
            updates: { dueDate: newDate ? new Date(newDate).toISOString() : null }
          }
        })
      });
    } catch (broadcastError) {
      logger.error(broadcastError, 'socket broadcast failed for task update');
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({ task });

  } catch (error) {
    logger.error(error, 'failed to update task date');
    return NextResponse.json({ error: 'Failed to update task date' }, { status: 500 });
  }
}
