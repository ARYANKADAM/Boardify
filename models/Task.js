import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dueDate: { type: Date },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  position: { type: Number, required: true },
  integrations: {
    google: {
      eventId: { type: String }
    },
    outlook: {
      eventId: { type: String }
    }
  }
});

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
