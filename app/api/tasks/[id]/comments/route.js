import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/mongodb';
import Comment from '../../../../../models/Comment';
import Task from '../../../../../models/Task';
import User from '../../../../../models/User';
import Notification from '../../../../../models/Notification';
import jwt from 'jsonwebtoken';
import { canPerform } from '../../../../../lib/permissions';
import { broadcast, broadcastToUser } from '../../../../../lib/broadcast';

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

/*
|--------------------------------------------------------------------------
| GET COMMENTS
|--------------------------------------------------------------------------
*/
export async function GET(req, { params }) {
  await connectToDatabase();

  const user = getUserFromToken(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const resolvedParams =
    params && typeof params.then === 'function'
      ? await params
      : params;

  const { id: taskId } = resolvedParams;

  const task = await Task.findById(taskId).populate('listId');

  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    );
  }

  const boardId = task.listId.boardId;

  if (!canPerform(user, { _id: boardId }, 'viewBoard')) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  // Populate user information
  const comments = await Comment.find({ taskId })
    .populate('userId', 'name email')
    .sort({ createdAt: 1 });

  return NextResponse.json(
    { comments },
    { status: 200 }
  );
}

/*
|--------------------------------------------------------------------------
| CREATE COMMENT
|--------------------------------------------------------------------------
*/
export async function POST(req, { params }) {
  await connectToDatabase();

  const user = getUserFromToken(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const resolvedParams =
    params && typeof params.then === 'function'
      ? await params
      : params;

  const { id: taskId } = resolvedParams;

  /*
  |--------------------------------------------------------------------------
  | Find task
  |--------------------------------------------------------------------------
  */

  const task = await Task.findById(taskId)
    .populate('listId');

  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    );
  }

  const boardId = task.listId.boardId;

  /*
  |--------------------------------------------------------------------------
  | Check permission
  |--------------------------------------------------------------------------
  */

  if (!canPerform(user, { _id: boardId }, 'editTask')) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Read request body
  |--------------------------------------------------------------------------
  */

  const { content, parentId } = await req.json();

  if (!content || !content.trim()) {
    return NextResponse.json(
      { error: 'Content required' },
      { status: 400 }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Parse @mentions
  |--------------------------------------------------------------------------
  */

  const mentionRegex = /@(\w+)/g;

  const mentions = [];

  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];

    const mentionedUser = await User.findOne({
      name: new RegExp(`^${username}$`, 'i')
    });

    if (mentionedUser) {
      mentions.push(mentionedUser._id);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Create comment
  |--------------------------------------------------------------------------
  */

  const comment = await Comment.create({
    taskId: taskId,
    userId: user.id,
    content: content.trim(),
    mentions,
    parentId: parentId || null
  });

  /*
  |--------------------------------------------------------------------------
  | IMPORTANT:
  | Populate the newly created comment immediately.
  |
  | This makes the response have:
  |
  | userId: {
  |   _id: "...",
  |   name: "Aryan",
  |   email: "..."
  | }
  |
  | instead of:
  |
  | userId: "..."
  |--------------------------------------------------------------------------
  */

  const populatedComment = await Comment
    .findById(comment._id)
    .populate('userId', 'name email');

  /*
  |--------------------------------------------------------------------------
  | Get commenter
  |--------------------------------------------------------------------------
  */

  const commenter = await User.findById(user.id)
    .select('name email');

  /*
  |--------------------------------------------------------------------------
  | Create notifications for mentioned users
  |--------------------------------------------------------------------------
  */

  if (mentions.length > 0) {
    const notifications = mentions.map(
      mentionedUserId => ({
        userId: mentionedUserId,
        type: 'mention',
        title: 'You were mentioned in a comment',
        message: `${commenter?.name || commenter?.email || 'Someone'} mentioned you in a comment on "${task.title}"`,
        relatedTaskId: taskId,
        relatedBoardId: boardId
      })
    );

    const createdNotifications =
      await Notification.insertMany(notifications);

    /*
    |--------------------------------------------------------------------------
    | Broadcast notifications
    |--------------------------------------------------------------------------
    */

    try {
      for (const notification of createdNotifications) {
        await broadcastToUser({
          event: 'notification:created',

          userId: notification.userId,

          data: {
            notification
          }
        });
      }
    } catch (broadcastError) {
      console.error(
        'Failed to broadcast notification events:',
        broadcastError
      );

      // Do not fail comment creation
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Broadcast comment to everyone viewing the board
  |--------------------------------------------------------------------------
  */

  try {
    await broadcast({
      event: 'comment:created',

      boardId: boardId,

      data: {
        comment: {
          ...populatedComment.toObject(),

          // Make sure task title is available
          taskTitle: task.title
        }
      }
    });

  } catch (broadcastError) {
    console.error(
      'Failed to broadcast comment creation:',
      broadcastError
    );

    // Do not fail comment creation
  }

  /*
  |--------------------------------------------------------------------------
  | Return the POPULATED comment to the creator
  |--------------------------------------------------------------------------
  */

  return NextResponse.json(
    {
      success: true,
      comment: populatedComment
    },
    {
      status: 201
    }
  );
}