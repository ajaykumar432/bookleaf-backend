import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authenticateStream, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as auth from '../controllers/auth.controller.js';
import * as books from '../controllers/book.controller.js';
import * as tickets from '../controllers/ticket.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { addClient } from '../services/events.js';
import * as s from './schemas.js';

const api = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in a few minutes.' } } });
// Protects LLM spend from a runaway client
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please slow down.' } } });

// ---- Auth (only public routes in the API) ----
api.post('/auth/login', loginLimiter, validate(s.loginBody), auth.login);
api.get('/auth/me', authenticate, auth.me);

// ---- Real-time stream (SSE) ----
api.get('/events/stream', authenticateStream, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  addClient(res, req.user);
});

// ---- Everything below requires a valid JWT ----
api.use(authenticate);

api.get('/books', validate(s.bookListQuery, 'query'), books.listBooks);
api.get('/books/:id', validate(s.idParam, 'params'), books.getBook);

api.get('/tickets', validate(s.listQuery, 'query'), tickets.list);
api.post('/tickets', requireRole('author'), validate(s.createTicketBody), tickets.create);
api.get('/tickets/:id', validate(s.idParam, 'params'), tickets.get);
api.post('/tickets/:id/replies', validate(s.idParam, 'params'), validate(s.replyBody), tickets.reply);

// ---- Admin only ----
const adminRouter = Router();
adminRouter.use(requireRole('admin'));
adminRouter.get('/stats', admin.stats);
adminRouter.patch('/tickets/:id', validate(s.idParam, 'params'), validate(s.adminPatchBody), admin.update);
adminRouter.post('/tickets/:id/notes', validate(s.idParam, 'params'), validate(s.noteBody), admin.addNote);
adminRouter.post('/tickets/:id/draft', aiLimiter, validate(s.idParam, 'params'), validate(s.draftBody), admin.draft);
adminRouter.post('/tickets/:id/reclassify', aiLimiter, validate(s.idParam, 'params'), validate(s.reclassifyBody), admin.reclassify);
api.use('/admin', adminRouter);

export default api;
