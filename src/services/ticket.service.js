import { Book } from '../models/Book.js';
import { Ticket, nextTicketNumber } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { classifyTicketById } from './classification.service.js';
import { draftReply } from './ai/drafter.js';
import { publish } from './events.js';
import { serializeFor } from './serializers.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const populate = (q) =>
  q.populate('author', 'name email authorId').populate('book', 'bookId title status').populate('assignedTo', 'name');

const SORTS = {
  urgency: { isActive: -1, priorityRank: -1, createdAt: 1 }, // active first, most urgent, then oldest
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
};

/** Loads a ticket enforcing ownership: authors get 404 (not 403) for other people's tickets to avoid id probing. */
async function loadTicket(user, ticketId, { lean = false } = {}) {
  const q = populate(Ticket.findById(ticketId));
  const ticket = await (lean ? q.lean() : q);
  const ownerId = String(ticket?.author?._id ?? ticket?.author);
  if (!ticket || (user.role === 'author' && ownerId !== user.id)) throw new AppError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
  return ticket;
}

export async function createTicket(user, input) {
  let book = null;
  if (input.bookId) {
    book = await Book.findOne({ _id: input.bookId, author: user.id });
    if (!book) throw new AppError(404, 'Book not found on your account', 'BOOK_NOT_FOUND');
  }
  const ticket = await Ticket.create({
    ticketNumber: await nextTicketNumber(), author: user.id, book: book?._id ?? null,
    subject: input.subject, description: input.description, attachments: input.attachments ?? [],
  });
  publish('ticket.created', { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber }, { userId: user.id, admins: true });
  setImmediate(() => classifyTicketById(ticket._id).catch((e) => console.error('[classify]', e)));
  return serializeFor(user)(await loadTicket(user, ticket._id));
}

export async function listTickets(user, q) {
  const filter = {};
  if (user.role === 'author') filter.author = user.id;
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = q.category;
  if (user.role === 'admin') {
    if (q.priority) filter.priority = q.priority;
    if (q.assigned === 'me') filter.assignedTo = user.id;
    if (q.assigned === 'unassigned') filter.assignedTo = null;
    if (q.authorId) filter.author = q.authorId;
  }
  if (q.from || q.to) filter.createdAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: new Date(q.to.getTime() + 86399999) }) };
  if (q.q) {
    const re = new RegExp(escapeRe(q.q), 'i');
    filter.$or = [{ subject: re }, { ticketNumber: re }];
  }
  const sort = SORTS[q.sort ?? (user.role === 'admin' ? 'urgency' : 'newest')];
  const [items, total] = await Promise.all([
    populate(Ticket.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit)).lean(),
    Ticket.countDocuments(filter),
  ]);
  const view = serializeFor(user);
  return { items: items.map(view), page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) };
}

export async function getTicket(user, id) {
  return serializeFor(user)(await loadTicket(user, id, { lean: true }));
}

export async function addReply(user, id, { message, status, fromDraft }) {
  const t = await loadTicket(user, id);
  if (t.status === 'Closed') throw new AppError(409, 'This ticket is closed. Please open a new query.', 'TICKET_CLOSED');

  t.responses.push({ sender: user.id, senderName: user.name, role: user.role, message, fromDraft: Boolean(fromDraft) });

  if (user.role === 'admin') {
    if (!t.assignedTo) t.assignedTo = user.id;
    t.status = status ?? (t.status === 'Open' ? 'In Progress' : t.status);
  } else if (t.status === 'Resolved') {
    t.status = 'Open'; // author replied after resolution => reopen
  }
  await t.save();
  publish('ticket.updated', { ticketId: String(t._id), ticketNumber: t.ticketNumber, kind: 'reply' }, { userId: t.author._id, admins: true });
  return serializeFor(user)(await loadTicket(user, id, { lean: true }));
}

/* ----------------------------- admin operations ----------------------------- */

export async function adminUpdateTicket(admin, id, patch) {
  const t = await loadTicket(admin, id);
  if (patch.status) t.status = patch.status;
  if (patch.category && patch.category !== t.category) {
    t.category = patch.category; t.categorySource = 'admin';
    t.aiDraft = undefined; // different category => different KB slice => stale draft
  }
  if (patch.priority) { t.priority = patch.priority; t.prioritySource = 'admin'; }
  if (patch.assignedTo === 'me') t.assignedTo = admin.id;
  if (patch.assignedTo === null) t.assignedTo = null;
  await t.save();
  publish('ticket.updated', { ticketId: String(t._id), ticketNumber: t.ticketNumber, kind: 'updated' }, { userId: t.author._id, admins: true });
  return serializeFor(admin)(await loadTicket(admin, id, { lean: true }));
}

export async function addInternalNote(admin, id, note) {
  const t = await loadTicket(admin, id);
  t.internalNotes.push({ admin: admin.id, adminName: admin.name, note });
  await t.save();
  publish('ticket.updated', { ticketId: String(t._id), ticketNumber: t.ticketNumber, kind: 'note' }, { admins: true }); // admins only
  return serializeFor(admin)(await loadTicket(admin, id, { lean: true }));
}

/** Returns the cached draft unless `regenerate` is set. Drafts are generated lazily on first open, not on ticket creation. */
export async function getOrCreateDraft(admin, id, { regenerate = false, instruction } = {}) {
  const t = await loadTicket(admin, id);
  if (t.aiDraft?.text && !regenerate && !instruction) return { ...t.toObject().aiDraft, cached: true };

  const [author, ticketBook, books] = await Promise.all([
    User.findById(t.author._id).select('name').lean(),
    t.book ? Book.findById(t.book._id).lean() : null,
    t.book ? [] : Book.find({ author: t.author._id }).lean(),
  ]);
  const draft = await draftReply({ ticket: t, author, ticketBook, books, instruction });
  t.aiDraft = { ...draft, generatedAt: new Date() };
  await t.save();
  return { ...t.toObject().aiDraft, cached: false };
}

export async function reclassify(admin, id, { force }) {
  await loadTicket(admin, id);
  await classifyTicketById(id, { force });
  return getTicket(admin, id);
}

export async function stats() {
  const [byStatus, activeByPriority, unassigned, oldest] = await Promise.all([
    Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Ticket.countDocuments({ isActive: true, assignedTo: null }),
    Ticket.findOne({ isActive: true }).sort({ createdAt: 1 }).select('createdAt ticketNumber').lean(),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  return { byStatus: toMap(byStatus), activeByPriority: toMap(activeByPriority), unassignedActive: unassigned, oldestActive: oldest };
}
