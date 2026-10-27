import { ROYALTY_MIN_PAYOUT } from '../../constants.js';
import { fmtDate, monthsBetween, royaltyCalendar, today } from '../../utils/dates.js';

const isLive = (b) => b.status === 'Published & Live';

function describeBook(b) {
  if (!isLive(b)) {
    return `"${b.title}" (${b.bookId}) is NOT yet published. Current production stage: ${b.status}. No sales or royalties exist yet. ISBN assigned: ${b.isbn || 'n/a'}.`;
  }
  const lines = [
    `"${b.title}" (${b.bookId}) | ${b.genre} | ISBN ${b.isbn} | status: ${b.status}`,
    `Published ${fmtDate(b.publicationDate)} (~${monthsBetween(b.publicationDate)} months ago) | MRP Rs ${b.mrp} | author royalty per copy Rs ${b.royaltyPerCopy}`,
    `Copies sold ${b.totalCopiesSold} | royalty earned Rs ${b.totalRoyaltyEarned} | paid Rs ${b.royaltyPaid} | pending Rs ${b.royaltyPending}`,
    `Last payout: ${b.lastRoyaltyPayoutDate ? fmtDate(b.lastRoyaltyPayoutDate) : 'NEVER (no payout made yet)'}`,
    `Print partner: ${b.printPartner} | Listed on: ${b.availableOn.join(', ') || 'none'}`,
  ];
  if (b.royaltyPending > 0 && b.royaltyPending < ROYALTY_MIN_PAYOUT) {
    lines.push(`NOTE: pending Rs ${b.royaltyPending} is BELOW the Rs ${ROYALTY_MIN_PAYOUT} minimum payout, so it rolls over to the next quarter.`);
  }
  if (b.royaltyPaid === 0 && b.royaltyPending > 0 && b.royaltyPending >= ROYALTY_MIN_PAYOUT) {
    lines.push('NOTE: royalty has accrued above the threshold but nothing has ever been paid; verify bank details and payout status.');
  }
  return lines.join('\n  ');
}

/**
 * Builds the compact, factual context block for the drafter:
 * - ticket's own book in full detail, OR a one-line-per-book summary for account-level tickets
 * - the computed royalty calendar (so the model quotes real dates instead of inventing them)
 */
export function buildFacts({ authorName, ticketBook, books }) {
  const cal = royaltyCalendar();
  const parts = [`Today: ${fmtDate(today())}`, `Author: ${authorName}`];

  if (ticketBook) {
    parts.push(`TICKET BOOK:\n  ${describeBook(ticketBook)}`);
  } else {
    const summary = books.map((b) =>
      isLive(b)
        ? `- "${b.title}": live, ${b.totalCopiesSold} sold, pending Rs ${b.royaltyPending}, paid Rs ${b.royaltyPaid}`
        : `- "${b.title}": in production (${b.status})`
    );
    parts.push(`AUTHOR'S BOOKS:\n${summary.join('\n') || '- none'}`);
  }

  parts.push(
    `ROYALTY CALENDAR (calendar quarters, payout within 45 days of quarter end):\n` +
      `- Last completed quarter ended ${fmtDate(cal.lastQuarterEnd)}; payout due by ${fmtDate(cal.lastPayoutBy)} (${cal.lastPayoutWindowPassed ? 'window has passed' : 'window still open'})\n` +
      `- Current quarter ends ${fmtDate(cal.currentQuarterEnd)}; payout due by ${fmtDate(cal.nextPayoutBy)}`
  );
  return parts.join('\n');
}
