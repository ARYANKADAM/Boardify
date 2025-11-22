import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './models/Task.js';
import Board from './models/Board.js';
import List from './models/List.js';

dotenv.config({ path: '.env.local' });

async function checkTasks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all boards
    const boards = await Board.find({}).select('_id name owner').limit(5);
    console.log('\nBoards:');
    boards.forEach(board => {
      console.log(`- ${board.name}: id=${board._id}, owner=${board.owner}`);
    });

    // Check tasks with due dates and their board associations
    const tasksWithDueDates = await Task.find({ dueDate: { $exists: true, $ne: null } })
      .select('title dueDate listId boardId')
      .populate('boardId', 'name')
      .populate('listId', 'title');

    console.log('\nTasks with due dates:');
    tasksWithDueDates.forEach(task => {
      console.log(`- "${task.title}": dueDate=${task.dueDate}, boardId=${task.boardId?._id || task.boardId}, boardName=${task.boardId?.name || 'N/A'}, listTitle=${task.listId?.title || 'N/A'}`);
    });

    // Check all tasks and their board associations
    const allTasks = await Task.find({}).select('title dueDate boardId listId').limit(10);
    console.log('\nAll tasks (sample):');
    allTasks.forEach(task => {
      console.log(`- "${task.title}": boardId=${task.boardId}, listId=${task.listId}, dueDate=${task.dueDate}`);
    });

    // Check lists
    const lists = await List.find({}).select('_id title boardId').limit(5);
    console.log('\nLists (sample):');
    lists.forEach(list => {
      console.log(`- "${list.title}": id=${list._id}, boardId=${list.boardId}`);
    });

    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

checkTasks();