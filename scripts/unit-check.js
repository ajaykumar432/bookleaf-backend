/** DB-free sanity checks for the pure logic (no framework): run with `npm run test:unit` */
process.env.MONGODB_URI ||= 'mongodb://x'; process.env.JWT_SECRET ||= 'x'; process.env.REFERENCE_DATE ||= '2026-10-25';
import assert from 'node:assert/strict';
const { heuristicClassify, templateDraft } = await import('../src/services/ai/fallback.js');
const { applyPolicyFloor } = await import('../src/services/ai/classifier.policy.js');
const { buildFacts } = await import('../src/services/ai/context.js');
const { buildDraftPrompt } = await import('../src/services/ai/drafter.js');
const { royaltyCalendar } = await import('../src/utils/dates.js');
const { complete, AIUnavailableError } = await import('../src/services/ai/client.js');

assert.equal(heuristicClassify('I have not received any royalty payment for 7 months').priority, 'Critical');
assert.equal(heuristicClassify('Different ISBN on Amazon than the printed copy').category, 'ISBN & Metadata Issues');
assert.ok(['High', 'Critical'].includes(heuristicClassify('wrong isbn').priority));
assert.equal(heuristicClassify('Can I update my author bio?').priority, 'Low');
assert.equal(applyPolicyFloor('ISBN & Metadata Issues', 'Low'), 'High');
assert.equal(applyPolicyFloor('Royalty & Payments', 'Low'), 'Low');

const cal = royaltyCalendar(new Date('2026-10-25T00:00:00Z'));
assert.equal(cal.lastQuarterEnd.toISOString().slice(0, 10), '2026-09-30');
assert.equal(cal.lastPayoutBy.toISOString().slice(0, 10), '2026-11-14');

const prod = { bookId: 'BK015', title: 'Raising Roots', status: 'In Production - Typesetting', isbn: 'x', availableOn: [] };
assert.match(buildFacts({ authorName: 'Kavita', ticketBook: prod, books: [] }), /NOT yet published/);
const live = { bookId: 'BK010', title: 'T', status: 'Published & Live', genre: 'g', isbn: 'i', publicationDate: '2024-09-10', mrp: 325, royaltyPerCopy: 28, totalCopiesSold: 88, totalRoyaltyEarned: 2464, royaltyPaid: 0, royaltyPending: 2464, lastRoyaltyPayoutDate: null, printPartner: 'In-House', availableOn: ['Amazon India'] };
assert.match(buildFacts({ authorName: 'A', ticketBook: live, books: [] }), /NEVER/);

const { system, user } = buildDraftPrompt({ ticket: { ticketNumber: 'BL-1', category: 'Printing & Quality', priority: 'High', subject: 's', description: 'blurry', responses: [] }, author: { name: 'Arjun M' }, ticketBook: live, books: [] });
assert.ok(system.includes('PRINTING & QUALITY') && !system.includes('ROYALTY POLICY'), 'only the relevant KB slice is sent');
assert.ok(user.includes('FACTS'));
assert.match(templateDraft('Printing & Quality', 'Arjun'), /^Hi Arjun/);

await assert.rejects(() => complete({ system: 's', user: 'u', maxTokens: 10 }), AIUnavailableError); // no key => graceful
console.log('unit checks passed');
