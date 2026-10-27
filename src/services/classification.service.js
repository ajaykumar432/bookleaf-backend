import { Ticket } from '../models/Ticket.js';
import { classifyWithAI } from './ai/classifier.js';
import { heuristicClassify } from './ai/fallback.js';
import { publish } from './events.js';

/**
 * Runs after the ticket is already saved + returned to the author, so an AI outage can never block ticket
 * creation. Falls back to keyword triage. Admin overrides are never clobbered (checked on a fresh read).
 */
export async function classifyTicketById(id, { force = false } = {}) {
  const seed = await Ticket.findById(id).populate('book', 'title status').lean();
  if (!seed) return;

  let result;
  let error;
  try {
    result = { ...(await classifyWithAI(seed)), source: 'ai' };
  } catch (err) {
    error = err.message;
    console.warn(`[ai] classify fallback for ${seed.ticketNumber}: ${error}`);
    result = { ...heuristicClassify(`${seed.subject}\n${seed.description}`), source: 'fallback' };
  }

  const t = await Ticket.findById(id); // fresh: admin may have overridden while the LLM call was in flight
  if (force || t.categorySource !== 'admin') {
    if (t.category !== result.category) t.aiDraft = undefined; // cached draft was for a different KB slice
    t.category = result.category;
    t.categorySource = result.source;
  }
  if (force || t.prioritySource !== 'admin') {
    t.priority = result.priority;
    t.prioritySource = result.source;
  }
  t.aiMeta = {
    status: result.source === 'ai' ? 'done' : 'fallback',
    confidence: result.confidence, reason: result.reason, model: result.model, error, classifiedAt: new Date(),
  };
  await t.save();
  publish('ticket.updated', { ticketId: String(t._id), ticketNumber: t.ticketNumber, kind: 'classified' }, { userId: t.author, admins: true });
  return t;
}
