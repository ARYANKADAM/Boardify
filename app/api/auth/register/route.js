import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import User from '../../../../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req) {
  await connectToDatabase();
  const { name, email, password, avatar, role } = await req.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const existing = await User.findOne({ email });
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  const hashed = await bcrypt.hash(password, 10);

  // Accept requested role (member/viewer/admin/owner) and store lowercased.
  // NOTE: This change allows self-registration as admin/owner. This is
  // intentionally permissive per your request — consider using
  // `ALLOW_SELF_ADMIN` or other controls in production to avoid privilege abuse.
  const allowedRoles = ['member', 'viewer', 'admin', 'owner'];
  let assignedRole = 'member';
  const roleNormalized = role && typeof role === 'string' ? role.toLowerCase() : null;
  if (roleNormalized && allowedRoles.includes(roleNormalized)) {
    assignedRole = roleNormalized;
  }

  const user = await User.create({ name, email, password: hashed, avatar, role: assignedRole });

  // Do not auto-login on registration. Return created user (normalized role)
  const roleForResponse = (user.role || 'member').toString().toLowerCase();
  user.role = roleForResponse;
  return NextResponse.json({ user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, role: user.role } }, { status: 201 });
}
