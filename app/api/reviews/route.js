import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';
import Review from '../../../models/Review';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';

// GET /api/reviews - returns recent reviews (populated with user name/avatar)
export async function GET(request) {
  try {
    await connectToDatabase();
    const reviews = await Review.find()
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50);
    return NextResponse.json({ reviews }, { status: 200 });
  } catch (error) {
    console.error('GET /api/reviews error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST /api/reviews - create a new review (requires Bearer token)
export async function POST(request) {
  try {
    // verify token from request headers (verifyToken expects the Request)
    const user = verifyToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { rating, comment } = body || {};
    if (!rating || !comment) return NextResponse.json({ error: 'Rating and comment are required' }, { status: 400 });

    await connectToDatabase();

    // try to fetch fuller user info from DB if available
    const dbUser = await User.findById(user.id);

    const review = new Review({
      userId: dbUser ? dbUser._id : user.id,
      name: dbUser ? dbUser.name : (user.name || user.email || 'Anonymous'),
      rating: Number(rating),
      comment: String(comment).slice(0, 500)
    });

    await review.save();
    const populated = await Review.findById(review._id).populate('userId', 'name avatar');
    return NextResponse.json({ review: populated }, { status: 201 });
  } catch (error) {
    console.error('POST /api/reviews error:', error);
    return NextResponse.json({ error: 'Failed to add review' }, { status: 500 });
  }
}