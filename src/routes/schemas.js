import { z } from 'zod';
import { CATEGORIES, PRIORITIES, STATUSES } from '../constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParam = z.object({ id: objectId });

export const loginBody = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export const createTicketBody = z.object({
  bookId: objectId.nullish().transform((v) => v || null), // null/omitted => General / Account Level
  subject: z.string().trim().min(3, 'Subject is too short').max(150),
  description: z.string().trim().min(10, 'Please describe the issue in more detail').max(5000),
  attachments: z.array(z.object({ name: z.string().max(200), size: z.number().int().nonnegative().max(26214400) })).max(5).optional(),
});

export const replyBody = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(5000),
  status: z.enum(STATUSES).optional(), // honoured for admins only
  fromDraft: z.boolean().optional(),
});

export const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigned: z.enum(['me', 'unassigned']).optional(),
  authorId: objectId.optional(),
  q: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['urgency', 'newest', 'oldest']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminPatchBody = z
  .object({
    status: z.enum(STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignedTo: z.union([z.literal('me'), z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const noteBody = z.object({ note: z.string().trim().min(1).max(2000) });
export const draftBody = z.object({ regenerate: z.boolean().optional(), instruction: z.string().trim().max(300).optional() }).default({});
export const reclassifyBody = z.object({ force: z.boolean().optional() }).default({});
export const bookListQuery = z.object({ authorId: objectId.optional() });
