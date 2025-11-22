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

  // Build date filter
  const filter = { boardId };
  if (from || to) filter.dueDate = {};
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate)) filter.dueDate.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate)) filter.dueDate.$lte = toDate;
  }

  try {
    const tasks = await Task.find(filter).select('title dueDate listId _id');
    return NextResponse.json({ tasks }, { status: 200 });
  } catch (e) {
    logger.error(e, 'failed to fetch calendar tasks');
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
