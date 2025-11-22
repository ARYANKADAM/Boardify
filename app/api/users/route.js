import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';
import User from '../../../models/User';

export async function GET(req) {
  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const id = searchParams.get('id');
  if (!email && !id) return NextResponse.json({ error: 'email or id required' }, { status: 400 });
  if (email) {
    const user = await User.findOne({ email }).select('_id email role name');
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ user }, { status: 200 });
  }
  const user = await User.findById(id).select('_id email role name');
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ user }, { status: 200 });
}
