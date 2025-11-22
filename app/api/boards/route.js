import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/mongodb';
import Board from '../../../models/Board';
import User from '../../../models/User';
import Activity from '../../../models/Activity';
import jwt from 'jsonwebtoken';

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

export async function GET(req) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Fetch boards and apply access rules:
  // - Owners always see boards they own; members see boards they are a member of.
  // - Global admins may see boards except those created by users with global role 'owner' (owner-created boards are private to their owner unless they add members).
  // - Global owners keep full access.
  const globalRole = (user.role || '').toString().toLowerCase();
  try {
    // populate owner role and member user details so clients can render member names/emails
    const allBoards = await Board.find({})
      .populate('owner', 'role')
      .populate('members.user', '_id email name role');

    const visible = allBoards.filter(b => {
      const ownerId = b.owner ? String(b.owner._id || b.owner) : null;
      const ownerRole = b.owner && b.owner.role ? String(b.owner.role).toLowerCase() : null;
      // owners and members always see their boards
      if (ownerId === String(user.id)) return true;
      if (Array.isArray(b.members) && b.members.some(m => {
        // m.user may be populated (object) or an id. Handle both.
        const memberUid = m && (m.user ? String(m.user._id || m.user) : String(m));
        return memberUid === String(user.id);
      })) return true;
      // global owners have full visibility
      if (globalRole === 'owner') return true;
      // global admins may NOT see boards created by users whose role is 'owner'
      if (globalRole === 'admin') {
        if (ownerRole === 'owner') return false;
        return true;
      }
      // otherwise not visible
      return false;
    });

    return NextResponse.json({ boards: visible }, { status: 200 });
  } catch (e) {
    console.error('boards.get failed', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { title, description } = await req.json();
  // Only global admins/owners may create top-level boards in this policy.
  // Members and Viewers are not permitted to create boards.
  const role = (user.role || '').toString().toLowerCase();
  if (role !== 'admin' && role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  const board = await Board.create({ title, description, owner: user.id, members: [{ user: user.id, role: 'member' }] });
  // create activity
  try {
    await Activity.create({ boardId: board._id, userId: user.id, action: 'board.created', details: `${user.email} created board "${title}"` });
  } catch (e) { logger.error(e, 'activity create failed'); }
  return NextResponse.json({ board }, { status: 201 });
}
