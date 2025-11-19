import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import User from '../../../../models/User';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  await connectToDatabase();
  const { name, email, password, avatar } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const existing = await User.findOne({ email });
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, avatar });
  return NextResponse.json({ user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, role: user.role } }, { status: 201 });
}
