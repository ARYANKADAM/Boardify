import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String },
  createdAt: { type: Date, default: Date.now },
  role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
