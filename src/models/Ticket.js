import mongoose from 'mongoose';
import { ACTIVE_STATUSES, CATEGORIES, PRIORITIES, PRIORITY_RANK, STATUSES } from '../constants.js';

const { Schema } = mongoose;

const responseSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    role: { type: String, enum: ['author', 'admin'], required: true },
    message: { type: String, required: true, maxlength: 5000 },
    fromDraft: { type: Boolean, default: false }, // admin started from an AI draft
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const noteSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: { type: String, required: true },
    note: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ticketSchema = new Schema(
  {
    ticketNumber: { type: String, unique: true, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    book: { type: Schema.Types.ObjectId, ref: 'Book', default: null }, // null => General / Account Level
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, maxlength: 5000 },
    attachments: [{ _id: false, name: String, size: Number }], // metadata only (UI-level support)

    status: { type: String, enum: STATUSES, default: 'Open' },
    category: { type: String, enum: CATEGORIES, default: 'General Inquiry' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    // Provenance lets the UI show "AI suggested" vs "set by admin", and protects overrides from being clobbered.
    categorySource: { type: String, enum: ['pending', 'ai', 'fallback', 'admin'], default: 'pending' },
    prioritySource: { type: String, enum: ['pending', 'ai', 'fallback', 'admin'], default: 'pending' },
    aiMeta: {
      status: { type: String, enum: ['pending', 'done', 'fallback'], default: 'pending' },
      confidence: Number,
      reason: String,
      model: String,
      error: String,
      classifiedAt: Date,
    },

    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    responses: [responseSchema],
    internalNotes: [noteSchema],

    // Cached so re-opening a ticket never re-bills an LLM call. Cleared when category changes.
    aiDraft: {
      text: String,
      source: { type: String, enum: ['ai', 'template'] },
      model: String,
      tokens: { input: Number, output: Number },
      generatedAt: Date,
    },

    // Denormalised for fast "urgent + oldest first" sorting
    priorityRank: { type: Number, default: 2 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ticketSchema.pre('save', function (next) {
  this.priorityRank = PRIORITY_RANK[this.priority] ?? 2;
  this.isActive = ACTIVE_STATUSES.includes(this.status);
  next();
});

ticketSchema.index({ author: 1, createdAt: -1 });
ticketSchema.index({ isActive: -1, priorityRank: -1, createdAt: 1 });
ticketSchema.index({ status: 1, category: 1 });

export const Ticket = mongoose.model('Ticket', ticketSchema);

const Counter = mongoose.model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));

/** Atomic, race-free human-friendly ticket numbers: BL-0001, BL-0002... */
export async function nextTicketNumber() {
  const c = await Counter.findByIdAndUpdate('ticket', { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `BL-${String(c.seq).padStart(4, '0')}`;
}
