import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../lib/mongodb';
import Board from '../../../../../../models/Board';
import mongoose from 'mongoose';
import User from '../../../../../../models/User';
import Activity from '../../../../../../models/Activity';
import jwt from 'jsonwebtoken';
import logger from '../../../../../../lib/logger';
import { canPerform } from '../../../../../../lib/permissions';

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
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, memberId } = await context.params;
  if (!id || !memberId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const board = await Board.findById(id);
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  if (!canPerform(user, board, 'manageMembers')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // don't allow removing the owner
  if (String(board.owner) === String(memberId)) {
    return NextResponse.json({ error: 'Cannot remove owner' }, { status: 400 });
  }

  // Use an atomic $pull to remove the member (handles populated or raw entries)
  // If memberId is a hex string, convert to ObjectId so it matches stored ObjectIds.
  let memberSelector = memberId;
  try {
    if (mongoose && mongoose.Types && typeof memberId === 'string' && /^[0-9a-fA-F]{24}$/.test(memberId)) {
      memberSelector = mongoose.Types.ObjectId(memberId);
    }
  } catch (e) {
    // fallback to string
    memberSelector = memberId;
  }

  // First try pulling by the member's `user` field (most common)
  let update = null;
  try {
    update = await Board.updateOne({ _id: id }, { $pull: { members: { user: memberSelector } } });
    logger.debug && logger.debug('member remove attempt by user selector', { boardId: id, memberSelector, result: update });
  } catch (e) {
    logger.warn('member remove attempted pull by user failed', { err: String(e), boardId: id, memberSelector });
  }

  // If nothing was removed, the caller may have passed the member subdocument _id
  // (each subdocument has its own _id). Try pulling by members._id as a fallback.
  let fallbackTried = false;
  let update2 = null;
  if (!update || update.modifiedCount === 0) {
    fallbackTried = true;
    try {
      if (mongoose && mongoose.Types && /^[0-9a-fA-F]{24}$/.test(memberId)) {
        const subId = mongoose.Types.ObjectId(memberId);
        update2 = await Board.updateOne({ _id: id }, { $pull: { members: { _id: subId } } });
        logger.debug && logger.debug('member remove attempt by subdoc _id', { boardId: id, subId, result: update2 });
        if (update2 && update2.modifiedCount > 0) {
          update = update2;
        }
      }
    } catch (e) {
      logger.warn('member remove fallback pull by subdoc id failed', { err: String(e), boardId: id, memberId });
    }
  }

  if (!update || update.modifiedCount === 0) {
    // include board.members shape to help debugging
    logger.warn('member remove failed - no modified docs', { boardId: id, memberId, memberSelector, fallbackTried, updateResult: update, updateResultFallback: update2, members: (board && board.members) });
    return NextResponse.json({ error: 'Not a member' }, { status: 400 });
  }

  try {
    const removedUser = await User.findById(memberId);
    await Activity.create({ boardId: board._id, userId: user.id, action: 'member.removed', details: `${user.email} removed ${removedUser ? removedUser.email : memberId} from board` });
    try {
      const SOCKET_SERVER = process.env.SOCKET_SERVER_URL || 'http://localhost:4001';
      await fetch(`${SOCKET_SERVER}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'activity:created', boardId: String(board._id), data: { action: 'member.removed', userId: user.id, details: `${user.email} removed ${removedUser ? removedUser.email : memberId} from board` } }),
      });
    } catch (e) {
      logger.warn('member remove broadcast failed', e);
    }
  } catch (e) {
    logger.error(e, 'activity create failed for member remove');
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
