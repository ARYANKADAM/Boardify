import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';
import Task from '../../../models/Task';
import List from '../../../models/List';
import Activity from '../../../models/Activity';
import jwt from 'jsonwebtoken';
import logger from '../../../lib/logger';

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
  // permission: check board membership
  try {
    const list = await List.findById(listId);
    const boardId = list ? String(list.boardId) : null;
    if (boardId) {
      const Board = (await import('../../../models/Board')).default;
      const board = await Board.findById(boardId);
      const isOwner = board && String(board.owner) === String(user.id);
      const isMember = board && Array.isArray(board.members) && board.members.map(m => String(m)).includes(String(user.id));
      if (!(user.role === 'admin' || isOwner || isMember)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  } catch (e) {
    logger.error(e, 'permission check failed for task create');
  }
  const task = await Task.create({ listId, title, description, assignedTo, dueDate, priority, position });
  await List.findByIdAndUpdate(listId, { $push: { tasks: task._id } });
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
    await Activity.create({ boardId, userId: user.id, action: 'task.created', details: `${user.email} created task "${title}"` });
    // broadcast activity as well
    try {
      await fetch(`${SOCKET_SERVER}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'activity:created', boardId, data: { action: 'task.created', userId: user.id, details: `${user.email} created task "${title}"` } }),
      });
    } catch (e) {
      // ignore
    }
  } catch (err) {
    logger.error(err, 'activity create failed');
  }
  return NextResponse.json({ task }, { status: 201 });
}
