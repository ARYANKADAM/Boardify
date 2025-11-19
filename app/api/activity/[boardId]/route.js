import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import Activity from '../../../../models/Activity';
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

export async function GET(req, context) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // In some Next.js versions `context.params` is a Promise — await it to be safe
  const params = context && context.params ? await context.params : {};
  const { boardId } = params || {};
  if (!boardId) return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });

  const activities = await Activity.find({ boardId }).sort({ timestamp: -1 }).limit(100).populate('userId', 'name email');
  return NextResponse.json({ activities }, { status: 200 });
}
