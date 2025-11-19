import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';
import List from '../../../models/List';
import Activity from '../../../models/Activity';
import Task from '../../../models/Task';
import jwt from 'jsonwebtoken';
import logger from '../../../lib/logger';
import Board from '../../../models/Board';

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

export async function GET(req) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get('boardId');
  if (!boardId) return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });
  const lists = await List.find({ boardId }).populate('tasks');
  return NextResponse.json({ lists }, { status: 200 });
}

export async function POST(req) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { boardId, title, position } = await req.json();
  if (!boardId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  // permission check: ensure user is owner/member/admin
  try {
    const board = await Board.findById(boardId);
    const isOwner = board && String(board.owner) === String(user.id);
    const isMember = board && Array.isArray(board.members) && board.members.map(m => String(m)).includes(String(user.id));
    if (!(user.role === 'admin' || isOwner || isMember)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e) {
    logger.error(e, 'permission check failed for list create');
  }
  const list = await List.create({ boardId, title, position, tasks: [] });
  // create activity
  try {
    await Activity.create({ boardId, userId: user.id, action: 'list.created', details: `${user.email} created list "${title}"` });
    // broadcast activity
    try {
      const SOCKET_SERVER = process.env.SOCKET_SERVER_URL || 'http://localhost:4001';
      await fetch(`${SOCKET_SERVER}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'activity:created', boardId, data: { action: 'list.created', userId: user.id, details: `${user.email} created list "${title}"` } }),
      });
    } catch (e) {}
  } catch (e) { console.error('activity create failed', e); }
  return NextResponse.json({ list }, { status: 201 });
}
