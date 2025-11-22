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

    const { provider, accessToken, refreshToken, expiresIn } = await request.json();

    if (!provider || !['google', 'outlook'].includes(provider)) {
      return NextResponse.json({ error: 'Valid provider is required' }, { status: 400 });
    }

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: 'Access token and refresh token are required' }, { status: 400 });
    }

    // Update user integrations
    const updatePath = `integrations.${provider}`;
    const updateData = {
      [`${updatePath}.connected`]: true,
      [`${updatePath}.accessToken`]: accessToken,
      [`${updatePath}.refreshToken`]: refreshToken,
      [`${updatePath}.expiresAt`]: new Date(Date.now() + (expiresIn * 1000))
    };

    await User.findByIdAndUpdate(user._id, { $set: updateData });

    return NextResponse.json({
      success: true,
      message: `${provider} integration connected successfully`
    });
  } catch (error) {
    console.error('Connect integration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}