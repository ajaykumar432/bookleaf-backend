import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, authorId: u.authorId ?? null, city: u.city ?? null });

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // Same message for unknown email and wrong password => no account enumeration
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  res.json({ user: publicUser(user) });
});
