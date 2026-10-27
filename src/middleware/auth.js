import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const load = async (token) => {
  const payload = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(payload.sub).select('name email role authorId').lean();
  if (!user) throw new AppError(401, 'Account no longer exists', 'INVALID_TOKEN');
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, authorId: user.authorId };
};

/** Standard Bearer-token auth. Applied to every non-public route. */
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
  req.user = await load(header.slice(7));
  next();
});

/** EventSource cannot set headers, so the SSE endpoint (only) accepts ?token=. */
export const authenticateStream = asyncHandler(async (req, res, next) => {
  const token = req.query.token;
  if (!token) throw new AppError(401, 'Authentication required', 'AUTH_REQUIRED');
  req.user = await load(String(token));
  next();
});

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : next(new AppError(403, 'You do not have permission to perform this action', 'FORBIDDEN'));
