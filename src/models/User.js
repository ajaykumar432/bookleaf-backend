import mongoose from 'mongoose';
import { ROLES } from '../constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, index: true },
    // Author-only profile fields (from the sample dataset)
    authorId: { type: String, unique: true, sparse: true },
    phone: String,
    city: String,
    joinedDate: Date,
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
