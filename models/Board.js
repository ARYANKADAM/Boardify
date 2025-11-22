import mongoose from 'mongoose';

const BoardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // members: array with per-board roles: { user: ObjectId, role: 'member'|'viewer'|'admin' }
  members: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, role: { type: String, enum: ['member','viewer','admin'], default: 'member' } }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Board || mongoose.model('Board', BoardSchema);
