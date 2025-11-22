import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import User from '@/models/User';

export async function GET(request) {
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

    // Check integration status
    const integrations = user.integrations || {};
    const google = integrations.google?.connected || false;
    const outlook = integrations.outlook?.connected || false;
    const lastSync = integrations.lastSync || null;

    return NextResponse.json({
      google,
      outlook,
      lastSync
    });
  } catch (error) {
    console.error('Integration status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}