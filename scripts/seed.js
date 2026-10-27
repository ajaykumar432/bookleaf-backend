/**
 * Seeds the DB from data/bookleaf_sample_data.json.
 * Idempotent: wipes users/books/tickets and recreates them. Usage: npm run seed [-- --no-tickets]
 */
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Book } from '../src/models/Book.js';
import { Ticket, nextTicketNumber } from '../src/models/Ticket.js';
import { User } from '../src/models/User.js';

const AUTHOR_PASSWORD = 'Author@123';
const ADMINS = [
  { name: 'Riya (BookLeaf Ops)', email: 'admin@bookleaf.com', password: 'Admin@123' },
  { name: 'Karan (BookLeaf Ops)', email: 'ops@bookleaf.com', password: 'Admin@123' },
];

const data = JSON.parse(readFileSync(new URL('../data/bookleaf_sample_data.json', import.meta.url), 'utf8'));
const date = (v) => (v ? new Date(v) : null);

await connectDB();
await Promise.all([User.deleteMany({}), Book.deleteMany({}), Ticket.deleteMany({}), mongoose.connection.collection('counters').deleteMany({})]);

const authorHash = await bcrypt.hash(AUTHOR_PASSWORD, 10);
const adminUsers = [];
for (const a of ADMINS) {
  adminUsers.push(await User.create({ name: a.name, email: a.email, role: 'admin', passwordHash: await bcrypt.hash(a.password, 10) }));
}

const byAuthorId = {};
const bookDocs = {};
for (const a of data.authors) {
  const user = await User.create({
    name: a.name, email: a.email, role: 'author', passwordHash: authorHash, authorId: a.author_id,
    phone: a.phone, city: a.city, joinedDate: date(a.joined_date),
  });
  byAuthorId[a.author_id] = user;
  for (const b of a.books) {
    bookDocs[b.book_id] = await Book.create({
      bookId: b.book_id, author: user._id, title: b.title, isbn: b.isbn, genre: b.genre,
      publicationDate: date(b.publication_date), status: b.status, mrp: b.mrp, royaltyPerCopy: b.author_royalty_per_copy,
      totalCopiesSold: b.total_copies_sold, totalRoyaltyEarned: b.total_royalty_earned, royaltyPaid: b.royalty_paid,
      royaltyPending: b.royalty_pending, lastRoyaltyPayoutDate: date(b.last_royalty_payout_date),
      printPartner: b.print_partner, availableOn: b.available_on,
    });
  }
}

if (!process.argv.includes('--no-tickets')) {
  // Demo tickets that exercise the edge cases in the dataset. Pre-classified so the queue looks alive
  // even without an LLM key (source "ai" = as if triaged earlier).
  const demo = [
    { a: 'AUTH003', b: 'BK005', subject: "I haven't received any royalty yet", description: 'My book Between Two Temples has been live since July 2024 and I have sold copies, but I have not received a single royalty payment in over a year. Please tell me what is going on.', category: 'Royalty & Payments', priority: 'Critical', ageDays: 6 },
    { a: 'AUTH007', b: 'BK013', subject: 'When will Midnight in Mysore be ready?', description: 'My thriller is still at cover design. I approved the first concept weeks ago. When can I expect publication?', category: 'Book Status & Production Updates', priority: 'Medium', ageDays: 4 },
    { a: 'AUTH002', b: 'BK003', subject: 'Different ISBN on Amazon vs the printed copy', description: 'The ISBN on Amazon for Code & Karma does not match the one printed on the physical copy I hold.', category: 'ISBN & Metadata Issues', priority: 'High', ageDays: 3 },
    { a: 'AUTH006', b: 'BK010', subject: 'Royalty seems too low', description: 'I sold 88 copies of Turban Tales but my dashboard shows a very small amount. How is this calculated?', category: 'Royalty & Payments', priority: 'Medium', ageDays: 2 },
    { a: 'AUTH001', b: null, subject: 'Can I update my author bio?', description: 'I would like to change my author bio that appears on my book pages. How do I do that?', category: 'General Inquiry', priority: 'Low', ageDays: 1 },
  ];
  for (const d of demo) {
    const t = new Ticket({
      ticketNumber: await nextTicketNumber(), author: byAuthorId[d.a]._id, book: d.b ? bookDocs[d.b]._id : null,
      subject: d.subject, description: d.description, category: d.category, priority: d.priority,
      categorySource: 'ai', prioritySource: 'ai', aiMeta: { status: 'done', confidence: 0.9, reason: 'Seeded demo ticket', classifiedAt: new Date() },
    });
    t.createdAt = new Date(Date.now() - d.ageDays * 86400000);
    await t.save({ timestamps: false });
  }
}

console.log(`Seeded ${data.authors.length} authors, ${Object.keys(bookDocs).length} books, ${adminUsers.length} admins.`);
console.log(`Author login: <email from dataset> / ${AUTHOR_PASSWORD}   e.g. ananya.reddy@email.com`);
console.log(`Admin login : admin@bookleaf.com / Admin@123`);
await mongoose.disconnect();
