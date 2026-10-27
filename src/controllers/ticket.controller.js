import { asyncHandler } from '../utils/asyncHandler.js';
import * as svc from '../services/ticket.service.js';

export const create = asyncHandler(async (req, res) => res.status(201).json({ ticket: await svc.createTicket(req.user, req.body) }));
export const list = asyncHandler(async (req, res) => res.json(await svc.listTickets(req.user, req.query)));
export const get = asyncHandler(async (req, res) => res.json({ ticket: await svc.getTicket(req.user, req.params.id) }));
export const reply = asyncHandler(async (req, res) =>
  res.status(201).json({ ticket: await svc.addReply(req.user, req.params.id, req.body) }));
