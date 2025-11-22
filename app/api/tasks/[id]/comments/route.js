import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/mongodb';
import Comment from '../../../../../models/Comment';
import Task from '../../../../../models/Task';
import User from '../../../../../models/User';
import Notification from '../../../../../models/Notification';
import jwt from 'jsonwebtoken';
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

export async function GET(req, { params }) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = params && typeof params.then === 'function' ? await params : params;
  const { id: taskId } = resolvedParams;

  const task = await Task.findById(taskId).populate('listId');
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Check if user can view the board
  const boardId = task.listId.boardId; // Assuming List has boardId
  if (!canPerform(user, { _id: boardId }, 'viewBoard')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const comments = await Comment.find({ taskId }).populate('userId', 'name email').sort({ createdAt: 1 });
  return NextResponse.json({ comments }, { status: 200 });
}

export async function POST(req, { params }) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = params && typeof params.then === 'function' ? await params : params;
  const { id: taskId } = resolvedParams;

  const task = await Task.findById(taskId).populate('listId');
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const boardId = task.listId.boardId;
  if (!canPerform(user, { _id: boardId }, 'editTask')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { content, parentId } = await req.json();
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  // Parse mentions: find @username in content
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];
    const mentionedUser = await User.findOne({ name: new RegExp(`^${username}$`, 'i') });
    if (mentionedUser) {
      mentions.push(mentionedUser._id);
    }
  }

  const comment = await Comment.create({
    taskId,
    userId: user.id,
    content,
    mentions,
    parentId: parentId || null
  });

  // Create notifications for mentioned users
  if (mentions.length > 0) {
    const commenter = await User.findById(user.id);
    const notifications = mentions.map(mentionedUserId => ({
      userId: mentionedUserId,
      type: 'mention',
      title: 'You were mentioned in a comment',
      message: `${commenter.name} mentioned you in a comment on "${task.title}"`,
      relatedTaskId: taskId,
      relatedBoardId: boardId
    }));
    const createdNotifications = await Notification.insertMany(notifications);

    // Broadcast notification events to mentioned users
    try {
      for (const notification of createdNotifications) {
        await fetch(`${socketUrl}/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'notification:created',
            data: { notification }
          })
        });
      }
    } catch (broadcastError) {
      console.error('Failed to broadcast notification events:', broadcastError);
      // Don't fail the request if broadcast fails
    }
  }

  // Broadcast comment creation to all users in the board room
  try {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:4001';
    await fetch(`${socketUrl}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'comment:created',
        boardId: boardId,
        data: {
          comment: {
            ...comment.toObject(),
            userId: { name: (await User.findById(user.id)).name },
            taskTitle: task.title
          }
        }
      })
    });
  } catch (socketError) {
    console.error('Failed to broadcast comment creation:', socketError);
    // Don't fail the request if socket broadcast fails
  }

  return NextResponse.json({ comment }, { status: 201 });
}