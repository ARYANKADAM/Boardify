import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import jwt from 'jsonwebtoken';
import User from '../../../../models/User';

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
  const payload = getUserFromToken(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Fetch canonical user record to ensure role is up-to-date
  try {
    const user = await User.findById(payload.id).select('_id name email avatar role');
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const role = (user.role || 'member').toString().toLowerCase();
    return NextResponse.json({ user: { id: String(user._id), name: user.name, email: user.email, avatar: user.avatar, role } }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
