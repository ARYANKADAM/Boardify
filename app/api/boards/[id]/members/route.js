import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/mongodb';
import Board from '../../../../../models/Board';
import User from '../../../../../models/User';
import Activity from '../../../../../models/Activity';
import jwt from 'jsonwebtoken';
import logger from '../../../../../lib/logger';
import { canPerform } from '../../../../../lib/permissions';

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

// POST: add a member to the board
export async function POST(req, context) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params; // board id
  const { memberId, role } = await req.json();
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

  const board = await Board.findById(id);
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  // permission: only owner or global admin may manage members
  if (!canPerform(user, board, 'manageMembers')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const member = await User.findById(memberId);
  if (!member) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // support new member object shape and legacy id array
  const already = Array.isArray(board.members) && board.members.some(m => {
    const uid = m && (m.user ? String(m.user) : String(m));
    return uid === String(memberId);
  });
  if (already) return NextResponse.json({ error: 'Already a member' }, { status: 400 });

  board.members = board.members || [];
  const roleNormalized = role && typeof role === 'string' ? role.toString().toLowerCase() : null;
  const memberRole = roleNormalized && ['member','viewer','admin'].includes(roleNormalized) ? roleNormalized : 'member';
  board.members.push({ user: member._id, role: memberRole });
  await board.save();

  // create activity + broadcast
  try {
    await Activity.create({ boardId: board._id, userId: user.id, action: 'member.added', details: `${user.email} added ${member.email} to board` });
    try {
      const SOCKET_SERVER = process.env.SOCKET_SERVER_URL || 'http://localhost:4001';
      await fetch(`${SOCKET_SERVER}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'activity:created', boardId: String(board._id), data: { action: 'member.added', userId: user.id, details: `${user.email} added ${member.email} to board` } }),
      });
    } catch (e) {
      logger.warn('member add broadcast failed', e);
    }
  } catch (e) {
    logger.error(e, 'activity create failed for member add');
  }

  return NextResponse.json({ success: true, member: { id: String(member._id), email: member.email, role: memberRole } }, { status: 200 });
}
