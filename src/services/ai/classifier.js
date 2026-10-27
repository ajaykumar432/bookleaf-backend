import { z } from 'zod';
import { CATEGORIES, PRIORITIES } from '../../constants.js';
import { complete } from './client.js';
import { applyPolicyFloor } from './classifier.policy.js';

const SYSTEM = `You are the triage engine for BookLeaf Publishing's author support desk.
Classify the author's ticket. Respond with ONLY a JSON object, no prose, no code fences:
{"category": <one of the categories>, "priority": <Critical|High|Medium|Low>, "confidence": <0-1>, "reason": <max 20 words>}

CATEGORIES
- Royalty & Payments: royalty amounts, missing/late payouts, bank details, payment calculations
- ISBN & Metadata Issues: wrong/duplicate ISBN, wrong book linked, title/description/metadata errors
- Printing & Quality: misprints, blurry images, binding defects, author copies, reprints
- Distribution & Availability: not listed / "unavailable" on Amazon, Flipkart, BookLeaf Store, stock sync
- Book Status & Production Updates: where the book is in production, delays, timelines
- General Inquiry: anything else (policy questions, profile updates, how-to)

PRIORITY RUBRIC
- Critical: money long overdue (e.g. no royalty for 6+ months), wrong content/ISBN already live and causing harm, legal/copyright threats, author threatening to leave or escalate publicly
- High: ISBN errors, missing/late payment (under 6 months), print defects, book unavailable while live, long unexplained production delay
- Medium: routine status questions, royalty amount clarifications, minor listing issues
- Low: informational questions, cosmetic or optional changes (e.g. update author bio)
Judge by urgency expressed in the text and the real-world impact, not by tone alone.`;

const outSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
  reason: z.string().max(300).catch(''),
});

const trim = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** One small call: subject + trimmed description + book title/status. No KB, no history (~250 input tokens). */
export async function classifyWithAI({ subject, description, book }) {
  const user = [
    book ? `Book: "${book.title}" (status: ${book.status})` : 'Book: General / Account Level',
    `Subject: ${trim(subject, 150)}`,
    `Description: ${trim(description, 1500)}`,
  ].join('\n');

  const res = await complete({ system: SYSTEM, user, maxTokens: 120, temperature: 0 });
  const match = res.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Classifier returned no JSON');
  const parsed = outSchema.parse(JSON.parse(match[0]));
  return { ...parsed, priority: applyPolicyFloor(parsed.category, parsed.priority), model: res.model };
}
