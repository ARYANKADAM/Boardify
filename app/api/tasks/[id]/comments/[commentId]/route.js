import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../lib/mongodb';
import Comment from '../../../../../../models/Comment';
import Task from '../../../../../../models/Task';
import Notification from '../../../../../../models/Notification';
import jwt from 'jsonwebtoken';
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

export async function DELETE(req, { params }) {
  await connectToDatabase();
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = params && typeof params.then === 'function' ? await params : params;
  const { id: taskId, commentId } = resolvedParams;

  if (!commentId) return NextResponse.json({ error: 'Comment ID required' }, { status: 400 });

  const task = await Task.findById(taskId).populate('listId');
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const boardId = task.listId.boardId;
  if (!canPerform(user, { _id: boardId }, 'viewBoard')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Find the comment
  const comment = await Comment.findById(commentId);
  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

  // Check if user can delete (comment author or board admin/owner)
  const isCommentAuthor = String(comment.userId) === String(user.id);
  const Board = (await import('../../../../../../models/Board')).default;
  const board = await Board.findById(boardId);
  const isAdmin = canPerform(user, board, 'deleteTask'); // Using deleteTask permission as proxy for admin rights

  if (!isCommentAuthor && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden: You can only delete your own comments' }, { status: 403 });
  }

  // Delete related notifications
  if (comment.mentions && comment.mentions.length > 0) {
    await Notification.deleteMany({
      userId: { $in: comment.mentions },
      type: 'mention',
      relatedTaskId: taskId
    });
  }

  // Delete the comment
  await Comment.findByIdAndDelete(commentId);

  // Broadcast comment deletion to all users in the board room
  try {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:4001';
    await fetch(`${socketUrl}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'comment:deleted',
        boardId: boardId,
        data: {
          commentId: commentId,
          taskId: taskId
        }
      })
    });
  } catch (socketError) {
    console.error('Failed to broadcast comment deletion:', socketError);
    // Don't fail the request if socket broadcast fails
  }

  return NextResponse.json({ success: true }, { status: 200 });
}