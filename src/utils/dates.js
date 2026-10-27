import { env } from '../config/env.js';

/** "Today" — overridable via REFERENCE_DATE so demos on 2025 sample data stay meaningful. */
export const today = () => (env.referenceDate ? new Date(`${env.referenceDate}T00:00:00Z`) : new Date());

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

/**
 * Royalty calendar derived from the KB: calendar quarters, payout within 45 days of quarter end.
 * Calendar quarters are an assumption (KB doesn't define fiscal quarters) — documented in README.
 */
export function royaltyCalendar(now = today()) {
  const y = now.getUTCFullYear();
  const q = Math.floor(now.getUTCMonth() / 3);
  const lastQuarterEnd = new Date(Date.UTC(y, q * 3, 0));
  const currentQuarterEnd = new Date(Date.UTC(y, q * 3 + 3, 0));
  const lastPayoutBy = addDays(lastQuarterEnd, 45);
  const nextPayoutBy = addDays(currentQuarterEnd, 45);
  return {
    lastQuarterEnd, lastPayoutBy, lastPayoutWindowPassed: lastPayoutBy < now,
    currentQuarterEnd, nextPayoutBy,
  };
}

export const monthsBetween = (from, to = today()) =>
  from ? Math.max(0, Math.floor((to - new Date(from)) / (30.44 * 86400000))) : null;
