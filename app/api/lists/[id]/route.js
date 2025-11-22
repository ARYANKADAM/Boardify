import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import List from '../../../../models/List';
import Task from '../../../../models/Task';
import jwt from 'jsonwebtoken';
import logger from '../../../../lib/logger';
import Board from '../../../../models/Board';
import { canPerform } from '../../../../lib/permissions';

const JWT_SECRET = process.env.JWT_SECRET;

// ----------------------
//  AUTH
// ----------------------
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

// ----------------------
//  DELETE LIST
// ----------------------
export async function DELETE(req, context) {
  await connectToDatabase();

  const user = getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ✅ Clean: unwrap params properly
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: 'Missing id param' }, { status: 400 });
  }

  const list = await List.findById(id);
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }

  // permission: only owner or global admin may delete lists
  try {
    const board = await Board.findById(list.boardId);
    if (!canPerform(user, board, 'deleteList')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (e) {
    logger.error(e, 'permission check failed for list delete');
  }

  // Delete all tasks inside this list
  await Task.deleteMany({ listId: id });

  // Delete the list itself
  await list.deleteOne();

  // create activity
  try {
    await connectToDatabase();
    const Activity = (await import('../../../../models/Activity')).default;
    // user is available from earlier
    const activity = await Activity.create({ boardId: list.boardId, userId: user.id, action: 'list.deleted', details: `${user.email} deleted list "${list.title}"` });
    // broadcast activity with populated user info
    const populatedActivity = await Activity.findById(activity._id).populate('userId', 'name email');
    const SOCKET_SERVER = process.env.SOCKET_SERVER_URL || 'http://localhost:4001';
    await fetch(`${SOCKET_SERVER}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'activity:created', boardId: list.boardId, data: populatedActivity }),
    });
  } catch (err) {
    logger.error(err, 'activity create failed');
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
