import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './models/Task.js';
import Board from './models/Board.js';
import List from './models/List.js';

dotenv.config({ path: '.env.local' });

async function debugCalendar() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the board (assuming the user is viewing the first board)
    const boards = await Board.find({}).limit(1);
    if (boards.length === 0) {
      console.log('No boards found!');
      return;
    }
    const board = boards[0];
    console.log(`\nChecking board: ${board.name} (id: ${board._id})`);

    // Get lists for this board
    const lists = await List.find({ boardId: board._id }).select('_id title');
    console.log(`\nLists in this board (${lists.length}):`);
    lists.forEach(list => {
      console.log(`- ${list.title}: id=${list._id}`);
    });

    // Get tasks with due dates
    const tasksWithDueDates = await Task.find({
      dueDate: { $exists: true, $ne: null }
    }).select('title dueDate listId').populate('listId', 'title boardId');

    console.log(`\nTasks with due dates (${tasksWithDueDates.length}):`);
    tasksWithDueDates.forEach(task => {
      const listBelongsToBoard = task.listId && String(task.listId.boardId) === String(board._id);
      console.log(`- "${task.title}": dueDate=${task.dueDate}, listId=${task.listId?._id || 'null'}, listTitle=${task.listId?.title || 'N/A'}, belongsToBoard=${listBelongsToBoard}`);
    });

    // Check what the calendar API would return for this board
    const calendarTasks = await Task.find({ dueDate: { $exists: true, $ne: null } })
      .populate({
        path: 'listId',
        match: { boardId: board._id },
        select: 'boardId title'
      })
      .select('title dueDate listId')
      .then(tasks => tasks.filter(task => task.listId !== null));

    console.log(`\nCalendar API would return ${calendarTasks.length} tasks for board ${board.name}:`);
    calendarTasks.forEach(task => {
      console.log(`- "${task.title}": ${task.dueDate}`);
    });

    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

debugCalendar();