import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/mongodb';
import Task from '../../../../../models/Task';
import List from '../../../../../models/List';
import Board from '../../../../../models/Board';
import User from '../../../../../models/User';
import jwt from 'jsonwebtoken';
import { broadcast } from '../../../../../lib/broadcast';

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

function isOwnerOrAdmin(user, board) {
  const userId = String(user.id || user._id);

  // Board owner
  if (String(board.owner) === userId) {
    return true;
  }

  // Global admin
  if (String(user.role).toLowerCase() === 'admin') {
    return true;
  }

  // Board admin
  if (Array.isArray(board.members)) {
    const member = board.members.find(
      m => String(m.user?._id || m.user) === userId
    );

    if (
      member &&
      String(member.role || '').toLowerCase() === 'admin'
    ) {
      return true;
    }
  }

  return false;
}

function isBoardMember(board, userId) {
  const id = String(userId);

  // Owner is automatically a board member
  if (String(board.owner) === id) {
    return true;
  }

  if (!Array.isArray(board.members)) {
    return false;
  }

  return board.members.some(
    member => String(member.user?._id || member.user) === id
  );
}


// ======================================================
// ADD ASSIGNEE
// POST /api/tasks/[id]/assignees
// ======================================================

export async function POST(req, context) {
  await connectToDatabase();

  const user = getUserFromToken(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { error: 'Missing task id' },
      { status: 400 }
    );
  }

  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: 'Email is required' },
      { status: 400 }
    );
  }

  // Find task
  const task = await Task.findById(id);

  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    );
  }

  // Find board
  const list = await List.findById(task.listId);

  if (!list) {
    return NextResponse.json(
      { error: 'List not found' },
      { status: 404 }
    );
  }

  const board = await Board.findById(list.boardId);

  if (!board) {
    return NextResponse.json(
      { error: 'Board not found' },
      { status: 404 }
    );
  }

  // Only owner/admin can assign
  if (!isOwnerOrAdmin(user, board)) {
    return NextResponse.json(
      { error: 'Only board owner or admin can assign members' },
      { status: 403 }
    );
  }

  // Find user by Gmail/email
  const targetUser = await User.findOne({
    email: email.trim().toLowerCase()
  }).select('_id name email avatar');

  if (!targetUser) {
    return NextResponse.json(
      { error: 'No user found with this email' },
      { status: 404 }
    );
  }

  // IMPORTANT:
  // User must belong to THIS board
  if (!isBoardMember(board, targetUser._id)) {
    return NextResponse.json(
      {
        error: 'This user is not a member of this board'
      },
      { status: 400 }
    );
  }

  // Prevent duplicate assignment
  const alreadyAssigned = task.assignedTo.some(
    assignedId =>
      String(assignedId) === String(targetUser._id)
  );

  if (alreadyAssigned) {
    return NextResponse.json(
      { error: 'User is already assigned to this task' },
      { status: 400 }
    );
  }

  // Add user
  task.assignedTo.push(targetUser._id);

  await task.save();

  // Get complete task with user information
  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', '_id name email avatar');

  // Realtime update
  await broadcast({
    event: 'task:updated',
    boardId: String(board._id),
    data: {
      taskId: String(task._id),
      updates: {
        assignedTo: populatedTask.assignedTo
      }
    }
  });

  return NextResponse.json(
    {
      success: true,
      user: targetUser,
      assignedTo: populatedTask.assignedTo
    },
    { status: 200 }
  );
}


// ======================================================
// REMOVE ASSIGNEE
// DELETE /api/tasks/[id]/assignees
// ======================================================

export async function DELETE(req, context) {
  await connectToDatabase();

  const user = getUserFromToken(req);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required' },
      { status: 400 }
    );
  }

  const task = await Task.findById(id);

  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    );
  }

  const list = await List.findById(task.listId);
  const board = await Board.findById(list?.boardId);

  if (!board) {
    return NextResponse.json(
      { error: 'Board not found' },
      { status: 404 }
    );
  }

  if (!isOwnerOrAdmin(user, board)) {
    return NextResponse.json(
      { error: 'Only board owner or admin can remove members' },
      { status: 403 }
    );
  }

  task.assignedTo = task.assignedTo.filter(
    assignedId => String(assignedId) !== String(userId)
  );

  await task.save();

  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', '_id name email avatar');

  await broadcast({
    event: 'task:updated',
    boardId: String(board._id),
    data: {
      taskId: String(task._id),
      updates: {
        assignedTo: populatedTask.assignedTo
      }
    }
  });

  return NextResponse.json({
    success: true,
    assignedTo: populatedTask.assignedTo
  });
}