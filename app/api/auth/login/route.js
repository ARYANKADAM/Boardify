import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import User from '../../../../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req) {
  await connectToDatabase();
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const user = await User.findOne({ email });
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const role = (user.role || 'member').toString().toLowerCase();
  const token = jwt.sign({ id: user._id, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
  return NextResponse.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, role } }, { status: 200 });
}
