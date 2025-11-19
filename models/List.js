import mongoose from 'mongoose';

const ListSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  title: { type: String, required: true },
  position: { type: Number, required: true },
  tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }]
});

export default mongoose.models.List || mongoose.model('List', ListSchema);
