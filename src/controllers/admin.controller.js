import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import * as svc from '../services/ticket.service.js';

export const update = asyncHandler(async (req, res) => res.json({ ticket: await svc.adminUpdateTicket(req.user, req.params.id, req.body) }));
export const addNote = asyncHandler(async (req, res) => res.status(201).json({ ticket: await svc.addInternalNote(req.user, req.params.id, req.body.note) }));
export const draft = asyncHandler(async (req, res) =>
  res.json({ draft: await svc.getOrCreateDraft(req.user, req.params.id, req.body), aiEnabled: env.ai.enabled }));
export const reclassify = asyncHandler(async (req, res) => res.json({ ticket: await svc.reclassify(req.user, req.params.id, req.body) }));
export const stats = asyncHandler(async (req, res) => res.json(await svc.stats()));
