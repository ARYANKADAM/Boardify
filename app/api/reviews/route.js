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
    // Try to verify token. If present and valid, post will be attributed to that user.
    // If not present, accept anonymous submission with optional name/email in the body.
    const user = verifyToken(request);
    const body = await request.json();
    const { rating, comment, name: submittedName, email: submittedEmail } = body || {};
    if (!rating || !comment) return NextResponse.json({ error: 'Rating and comment are required' }, { status: 400 });

    await connectToDatabase();

    let reviewData = {
      rating: Number(rating),
      comment: String(comment).slice(0, 500)
    };

    if (user) {
      // Authenticated user -> record their DB user id and canonical name (ignore submittedName)
      const dbUser = await User.findById(user.id);
      reviewData.userId = dbUser ? dbUser._id : user.id;
      reviewData.name = dbUser ? dbUser.name : (user.name || user.email || 'Anonymous');
    } else {
      // Anonymous submission -> allow name/email fields if provided, but do not link to a userId
      reviewData.userId = null;
      reviewData.name = submittedName ? String(submittedName).slice(0, 100) : (submittedEmail ? submittedEmail.split('@')[0] : 'Anonymous');
      if (submittedEmail) reviewData.email = String(submittedEmail).slice(0, 200);
    }

    const review = new Review(reviewData);

    await review.save();
    // populate userId (if any) for richer client display
    const populated = await Review.findById(review._id).populate('userId', 'name avatar');
    return NextResponse.json({ review: populated }, { status: 201 });
  } catch (error) {
    console.error('POST /api/reviews error:', error);
    return NextResponse.json({ error: 'Failed to add review' }, { status: 500 });
  }
}