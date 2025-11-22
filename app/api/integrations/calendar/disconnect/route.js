import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import User from '@/models/User';

export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { provider } = await request.json();

    if (!provider || !['google', 'outlook'].includes(provider)) {
      return NextResponse.json({ error: 'Valid provider is required' }, { status: 400 });
    }

    // Remove integration data
    const updatePath = `integrations.${provider}`;
    await User.findByIdAndUpdate(user._id, {
      $unset: {
        [updatePath]: 1
      }
    });

    return NextResponse.json({ success: true, message: `${provider} integration disconnected` });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}