import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import Board from '../../../../models/Board';
import jwt from 'jsonwebtoken';
import Activity from '../../../../models/Activity';
import User from '../../../../models/User';
import logger from '../../../../lib/logger';
import { canPerform } from '../../../../lib/permissions';

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

export async function PUT(req, { params }) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // `params` may be a Promise in newer Next versions — resolve if needed
  const resolvedParams = params && typeof params.then === 'function' ? await params : params;
  const { id } = resolvedParams;
  const { title, description } = await req.json();
  const board = await Board.findById(id);
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  // allow edit for owner or global admin
  if (!canPerform(user, board, 'editBoard')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (title) board.title = title;
  if (description) board.description = description;
  await board.save();
  return NextResponse.json({ board }, { status: 200 });
}

export async function DELETE(req, { params }) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // `params` may be a Promise in newer Next versions — resolve if needed
  const resolvedParams = params && typeof params.then === 'function' ? await params : params;
  const { id } = resolvedParams;
  const board = await Board.findById(id);
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  // Enforce custom delete rules (authoritative server-side):
  // - Global `owner`: can delete boards they created, and boards created by admins.
  // - Global `admin`: can only delete boards they created.
  // - Others: forbidden.
  const currentRole = (user.role || '').toString().toLowerCase();
  const currentUserId = user.id || user._id || user.sub;
  // Try to resolve the board owner's global role (by fetching the user doc)
  let boardOwnerRole = null;
  let boardOwnerId = null;
  try {
    if (board.owner) {
      boardOwnerId = String(board.owner);
      const ownerUser = await User.findById(board.owner).lean();
      if (ownerUser && ownerUser.role) boardOwnerRole = String(ownerUser.role).toLowerCase();
    }
  } catch (e) {
    logger.error(e, 'failed to resolve board owner');
  }

  let allowedToDelete = false;
  if (currentRole === 'owner') {
    if (currentUserId && boardOwnerId && String(boardOwnerId) === String(currentUserId)) {
      allowedToDelete = true;
    } else if (boardOwnerRole === 'admin') {
      allowedToDelete = true;
    }
  } else if (currentRole === 'admin') {
    if (currentUserId && boardOwnerId && String(boardOwnerId) === String(currentUserId)) {
      allowedToDelete = true;
    }
  }
  logger.info && logger.info('deleteBoard check', { currentRole, currentUserId, boardOwnerId, boardOwnerRole, allowedToDelete });
  if (!allowedToDelete) {
    logger.warn && logger.warn('deleteBoard forbidden', { currentRole, currentUserId, boardOwnerId, boardOwnerRole });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  logger.info && logger.info('deleteBoard allowed, proceeding', { boardId: id, by: currentUserId });
  await board.deleteOne();
  try {
    await Activity.create({ boardId: board._id, userId: user.id, action: 'board.deleted', details: `${user.email} deleted board "${board.title}"` });
  } catch (e) { logger.error(e, 'activity create failed'); }
  logger.info && logger.info('board.deleted activity created', { boardId: String(board._id), by: currentUserId });
  return NextResponse.json({ success: true }, { status: 200 });
}
