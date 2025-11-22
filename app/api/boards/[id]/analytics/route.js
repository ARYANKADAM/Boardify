import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../lib/mongodb';
import Task from '../../../../../models/Task';
import List from '../../../../../models/List';
import Activity from '../../../../../models/Activity';
import Board from '../../../../../models/Board';
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

export async function GET(req, context) {
  await connectToDatabase();

  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: boardId } = await context.params;

  // Check permissions
  const board = await Board.findById(boardId);
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  if (!canPerform(user, board, 'viewBoard')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Get all lists for this board with populated tasks (this matches what the frontend shows)
    const lists = await List.find({ boardId }).populate('tasks');
    const listIds = lists.map(list => list._id);

    // Debug: Log list information
    console.log('Analytics Debug - Lists found:', lists.map(l => ({ id: l._id, title: l.title, taskCount: l.tasks?.length || 0 })));

    // Use tasks from populated lists instead of separate query (matches frontend exactly)
    const allTasks = lists.flatMap(list => list.tasks || []);
    const tasks = await Promise.all(
      allTasks.map(async (task) => {
        // Populate assignedTo for each task
        if (task.assignedTo && task.assignedTo.length > 0) {
          const populatedTask = await Task.findById(task._id).populate('assignedTo', 'name email');
          return populatedTask;
        }
        return task;
      })
    );

    console.log('Analytics Debug - Tasks found:', tasks.length);
    console.log('Analytics Debug - Task details:', tasks.map(t => ({
      title: t.title,
      listId: t.listId?.toString(),
      _id: t._id?.toString()
    })));

    // Debug: Log detailed list information with task details
    console.log('Analytics Debug - Detailed Lists with Tasks:');
    lists.forEach(list => {
      console.log(`  List: "${list.title}" (ID: ${list._id.toString()})`);
      console.log(`    Tasks: ${(list.tasks || []).map(t => `"${t.title}" (ID: ${t._id.toString()})`).join(', ') || 'None'}`);
    });

    // Define completed lists (lists that indicate completion)
    const completedListTitles = ['done', 'completed', 'finished', 'complete', 'archive', 'archived'];
    const completedListIds = lists
      .filter(list => {
        const listTitle = list.title.toLowerCase().trim();
        // More precise matching: check if the list title exactly matches or starts with completion keywords
        const isCompleted = completedListTitles.some(title =>
          listTitle === title || listTitle.startsWith(title + ' ') || listTitle.endsWith(' ' + title) || listTitle.includes(' ' + title + ' ')
        );
        console.log(`Analytics Debug - Checking list "${list.title}" (normalized: "${listTitle}") - isCompleted: ${isCompleted}`);
        return isCompleted;
      })
      .map(list => list._id);

    console.log('Analytics Debug - Completed list titles:', completedListTitles);
    console.log('Analytics Debug - Completed list IDs:', completedListIds.map(id => id.toString()));
    console.log('Analytics Debug - All list titles:', lists.map(l => ({ title: l.title, id: l._id.toString() })));

    // Calculate analytics data
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => {
      const taskListId = task.listId.toString();
      const isCompleted = completedListIds.some(id => id.toString() === taskListId);
      return isCompleted;
    }).length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    console.log('Analytics Debug - Total tasks:', totalTasks);
    console.log('Analytics Debug - Completed tasks:', completedTasks);
    console.log('Analytics Debug - Completion rate:', completionRate);

    // Task completion over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activities = await Activity.find({
      boardId,
      timestamp: { $gte: thirtyDaysAgo }
    }).sort({ timestamp: 1 });

    // Group activities by date for completion tracking
    const completionData = {};
    activities.forEach(activity => {
      const date = activity.timestamp.toISOString().split('T')[0];
      if (!completionData[date]) {
        completionData[date] = { completed: 0, created: 0 };
      }
      if (activity.action === 'task.created') completionData[date].created++;
      // Note: We can't easily track completion from activities since completion is list-based
    });

    // For burndown chart, we need to track tasks over time
    // This is a simplified version - in a real app, you'd track historical data
    const burndownData = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // For demo purposes, we'll simulate burndown data
      // In a real implementation, you'd store historical snapshots
      const remainingTasks = Math.max(0, totalTasks - completedTasks - Math.floor(Math.random() * 5));
      burndownData.push({
        date: dateStr,
        remaining: remainingTasks,
        completed: completedTasks
      });
    }

    // Team productivity metrics
    const teamMetrics = {};
    tasks.forEach(task => {
      if (task.assignedTo && task.assignedTo.length > 0) {
        task.assignedTo.forEach(user => {
          if (!teamMetrics[user._id]) {
            teamMetrics[user._id] = {
              name: user.name,
              email: user.email,
              totalTasks: 0,
              completedTasks: 0
            };
          }
          teamMetrics[user._id].totalTasks++;
          if (completedListIds.includes(task.listId)) {
            teamMetrics[user._id].completedTasks++;
          }
        });
      }
    });

    const teamProductivity = Object.values(teamMetrics).map(member => ({
      ...member,
      completionRate: member.totalTasks > 0 ? (member.completedTasks / member.totalTasks) * 100 : 0
    }));

    // Priority distribution
    const priorityStats = {
      high: tasks.filter(task => task.priority === 'high').length,
      medium: tasks.filter(task => task.priority === 'medium').length,
      low: tasks.filter(task => task.priority === 'low').length
    };

    // Due date analysis
    const nowDate = new Date();
    const overdueTasks = tasks.filter(task =>
      task.dueDate && task.dueDate < nowDate && !completedListIds.includes(task.listId)
    ).length;

    const dueSoonTasks = tasks.filter(task => {
      if (!task.dueDate || completedListIds.includes(task.listId)) return false;
      const dueDate = new Date(task.dueDate);
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      return dueDate >= nowDate && dueDate <= sevenDaysFromNow;
    }).length;

    return NextResponse.json({
      overview: {
        totalTasks,
        completedTasks,
        completionRate: Math.round(completionRate * 100) / 100,
        overdueTasks,
        dueSoonTasks
      },
      burndownData,
      teamProductivity,
      priorityStats,
      completionTrend: Object.entries(completionData).map(([date, data]) => ({
        date,
        ...data
      }))
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}