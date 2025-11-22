import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './models/Task.js';

dotenv.config({ path: '.env.local' });

async function checkTasks() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const tasks = await Task.find({}).select('title dueDate listId boardId').limit(10);
    console.log('Sample tasks:');
    tasks.forEach(task => {
      console.log(`- ${task.title}: dueDate=${task.dueDate}, listId=${task.listId}, boardId=${task.boardId}`);
    });

    const tasksWithDueDates = await Task.countDocuments({ dueDate: { $exists: true, $ne: null } });
    console.log(`Total tasks with due dates: ${tasksWithDueDates}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
checkTasks();