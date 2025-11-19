import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';
import Board from '../../../models/Board';
import User from '../../../models/User';
import Activity from '../../../models/Activity';
import jwt from 'jsonwebtoken';

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
  const boards = await Board.find({ $or: [{ owner: user.id }, { members: user.id }] });
  return NextResponse.json({ boards }, { status: 200 });
}

export async function POST(req) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { title, description } = await req.json();
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  const board = await Board.create({ title, description, owner: user.id, members: [user.id] });
  // create activity
  try {
    await Activity.create({ boardId: board._id, userId: user.id, action: 'board.created', details: `${user.email} created board "${title}"` });
  } catch (e) { console.error('activity create failed', e); }
  return NextResponse.json({ board }, { status: 201 });
}
