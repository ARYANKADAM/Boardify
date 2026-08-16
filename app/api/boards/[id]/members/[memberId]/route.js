import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../lib/mongodb';
import Board from '../../../../../../models/Board';
import User from '../../../../../../models/User';
import Activity from '../../../../../../models/Activity';
import jwt from 'jsonwebtoken';
import logger from '../../../../../../lib/logger';
import { canPerform } from '../../../../../../lib/permissions';
import mongoose from 'mongoose';

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

// DELETE: remove member from board
export async function DELETE(req, context) {
  try {
    await connectToDatabase();

    const user = getUserFromToken(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: boardId, memberId } = await context.params;

    if (!boardId || !memberId) {
      return NextResponse.json(
        { error: 'Missing boardId or memberId' },
        { status: 400 }
      );
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return NextResponse.json(
        { error: 'Invalid board ID' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return NextResponse.json(
        { error: 'Invalid member ID' },
        { status: 400 }
      );
    }

    const board = await Board.findById(boardId);

    if (!board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (!canPerform(user, board, 'manageMembers')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Don't allow removing the owner
    if (String(board.owner) === String(memberId)) {
      return NextResponse.json(
        { error: 'Cannot remove owner' },
        { status: 400 }
      );
    }

    const memberObjectId = new mongoose.Types.ObjectId(memberId);

    // Check whether this user is actually a member
    const existingMember = board.members?.find(
      (member) =>
        String(member.user) === String(memberObjectId)
    );

    if (!existingMember) {
      return NextResponse.json(
        { error: 'User is not a member of this board' },
        { status: 400 }
      );
    }

    // Get removed user's information before removing them
    const removedUser = await User.findById(memberObjectId);

    // IMPORTANT:
    // Board.members stores objects like:
    //
    // {
    //   user: ObjectId(...),
    //   role: "member"
    // }
    //
    // Therefore pull using members.user.
  const updatedBoard = await Board.findOneAndUpdate(
  {
    _id: new mongoose.Types.ObjectId(boardId),
    'members.user': new mongoose.Types.ObjectId(memberId)
  },
  {
    $pull: {
      members: {
        user: new mongoose.Types.ObjectId(memberId)
      }
    }
  },
  {
    new: true
  }
);

    if (!updatedBoard) {
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      );
    }

    console.log(
      `Member ${memberId} removed from board ${boardId}`
    );

    // Create activity
    try {
      await Activity.create({
        boardId: board._id,
        userId: user.id,
        action: 'member.removed',
        details: `${user.email} removed ${
          removedUser?.email || memberId
        } from board`
      });
    } catch (activityError) {
      logger.error(
        activityError,
        'activity create failed for member remove'
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Member removed successfully',
        board: updatedBoard
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Remove member error:', error);

    logger.error(
      error,
      'Failed to remove board member'
    );

    return NextResponse.json(
      {
        error: error.message || 'Failed to remove member'
      },
      { status: 500 }
    );
  }
}

// Small helper so the ObjectId conversion is explicit.
function boardObjectIdSafe(id) {
  return new mongoose.Types.ObjectId(id);
}