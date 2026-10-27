const id = (x) => (x ? String(x._id ?? x) : null);

const bookRef = (b) => (b && b._id ? { id: id(b), bookId: b.bookId, title: b.title, status: b.status } : null);

const responses = (t) =>
  (t.responses ?? []).map((r) => ({ id: id(r), role: r.role, senderName: r.senderName, message: r.message, createdAt: r.createdAt }));

/** What an author may see. Priority, AI metadata, drafts, assignee and internal notes NEVER leave via this view. */
export const authorView = (t) => ({
  id: id(t), ticketNumber: t.ticketNumber, subject: t.subject, description: t.description,
  attachments: t.attachments ?? [], book: bookRef(t.book), status: t.status, category: t.category,
  responses: responses(t), createdAt: t.createdAt, updatedAt: t.updatedAt,
});

export const adminView = (t) => ({
  ...authorView(t),
  priority: t.priority, categorySource: t.categorySource, prioritySource: t.prioritySource,
  ai: t.aiMeta ?? null,
  author: t.author?._id ? { id: id(t.author), name: t.author.name, email: t.author.email, authorId: t.author.authorId } : { id: id(t.author) },
  assignedTo: t.assignedTo?._id ? { id: id(t.assignedTo), name: t.assignedTo.name } : null,
  internalNotes: (t.internalNotes ?? []).map((n) => ({ id: id(n), adminName: n.adminName, note: n.note, createdAt: n.createdAt })),
  aiDraft: t.aiDraft?.text ? t.aiDraft : null,
});

export const serializeFor = (user) => (user.role === 'admin' ? adminView : authorView);
