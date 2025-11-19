import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import Board from '../../../../models/Board';
import jwt from 'jsonwebtoken';
import Activity from '../../../../models/Activity';
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

export async function PUT(req, { params }) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = params;
  const { title, description } = await req.json();
  const board = await Board.findById(id);
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  if (String(board.owner) !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (title) board.title = title;
  if (description) board.description = description;
  await board.save();
  return NextResponse.json({ board }, { status: 200 });
}

export async function DELETE(req, { params }) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = params;
  const board = await Board.findById(id);
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  if (String(board.owner) !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await board.deleteOne();
  try {
    await Activity.create({ boardId: board._id, userId: user.id, action: 'board.deleted', details: `${user.email} deleted board "${board.title}"` });
  } catch (e) { logger.error(e, 'activity create failed'); }
  return NextResponse.json({ success: true }, { status: 200 });
}
