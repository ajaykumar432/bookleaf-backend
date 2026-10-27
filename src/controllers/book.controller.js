import { Book } from '../models/Book.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listBooks = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'author' ? { author: req.user.id } : req.query.authorId ? { author: req.query.authorId } : {};
  const books = await Book.find(filter).sort({ publicationDate: -1, createdAt: -1 }).lean({ virtuals: true });
  res.json({ items: books.map((b) => ({ ...b, id: String(b._id), isPublished: b.status === 'Published & Live' })) });
});

export const getBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).lean();
  if (!book || (req.user.role === 'author' && String(book.author) !== req.user.id)) throw new AppError(404, 'Book not found', 'BOOK_NOT_FOUND');
  res.json({ book: { ...book, id: String(book._id), isPublished: book.status === 'Published & Live' } });
});
