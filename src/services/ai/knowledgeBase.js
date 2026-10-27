/**
 * BookLeaf Knowledge Base, split into small sections so each LLM call only receives
 * what its ticket category needs (cost control) instead of the whole KB every time.
 */
export const KB = {
  company: `BookLeaf Publishing is a self-publishing company in India and the US. Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid, with marketing and distribution add-ons). We handle cover design, typesetting, ISBN assignment, printing, distribution and royalty management. In-house printing facility and warehouse are in Delhi; print partners are Repro India and Epitome Books.`,

  royalty: `ROYALTY POLICY
- 80/20 split: 80% of net profit per book to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is Rs 1,000; below that, royalties roll over to the next quarter.
- Payouts are by bank transfer to the account linked in the author's dashboard.
- Authors can see a detailed royalty breakdown (sales per platform) in their dashboard.`,

  isbn: `ISBN POLICY
- Every book gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.
- An ISBN under the author's own imprint must be obtained by the author independently.
- ISBN errors (duplicate, wrong book linked) are HIGH PRIORITY and escalated to the production team.`,

  printing: `PRINTING & QUALITY
- In-house printing handles most orders; overflow or specific formats go to Repro India or Epitome Books.
- Standard print turnaround is 5-7 business days from order confirmation.
- For quality issues (misprints, binding defects, colour inconsistency) BookLeaf arranges a FREE reprint after verification. The author may need to share photos of the defective copy.`,

  distribution: `DISTRIBUTION & AVAILABILITY
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings usually go live 7-10 business days after publication is complete.
- A book showing "unavailable" on a platform usually means a stock sync issue; the team can trigger a re-sync within 24-48 hours.`,

  production: `PRODUCTION STAGES
Manuscript Received > Editing (if opted) > Cover Design > Typesetting > Proofreading > ISBN Assignment > Printing > Distribution Setup > Published & Live.
Authors are emailed at each stage. Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).
Metadata updates (e.g. book description on Amazon) can be submitted via the dashboard or by emailing the team; changes reflect on platforms in 3-5 business days.`,

  tone: `TONE GUIDELINES
- Empathetic and professional; authors are partners, not customers to be managed.
- Acknowledge the concern BEFORE offering solutions.
- Be specific: use the actual numbers, dates and statuses provided; no vague reassurance.
- If it is BookLeaf's fault (delayed royalty, ISBN error), own it directly. No corporate deflection.
- If escalation or investigation is needed, give a clear timeline (e.g. "within 48 hours"), never open-ended promises.
- Never blame the author for delays, even when the delay is on their side; frame it collaboratively.
- Always end with a clear next step for the author and/or the BookLeaf team.`,
};

/** Which KB sections each category needs, beyond the always-on `company` + `tone`. */
export const CATEGORY_SECTIONS = {
  'Royalty & Payments': ['royalty'],
  'ISBN & Metadata Issues': ['isbn', 'production'],
  'Printing & Quality': ['printing'],
  'Distribution & Availability': ['distribution'],
  'Book Status & Production Updates': ['production'],
  'General Inquiry': ['production', 'royalty'],
};

/** Calibration examples from the assignment brief, one per category (only the relevant one is sent). */
export const CATEGORY_GUIDANCE = {
  'Royalty & Payments': `Acknowledge the frustration. If no royalty received: explain the quarterly cycle and 45-day window, give the specific next payout date, mention the bank-details check, and if genuinely overdue escalate with a 48-hour resolution timeline. If the amount seems low: explain net profit (MRP minus printing, platform commission, shipping) and offer a line-by-line breakdown. Never be defensive; offer transparency.`,
  'ISBN & Metadata Issues': `Treat as high priority. Acknowledge it is a serious data issue, confirm escalation to the production team immediately, and give a 48-hour resolution timeline.`,
  'Printing & Quality': `Apologise sincerely. Ask for photos of the defective copies. Confirm a free reprint once verified, with a 5-7 business day timeline.`,
  'Distribution & Availability': `Explain this is typically a stock sync issue. Confirm you are triggering a re-sync with the distribution team. Set expectation: 24-48 hours.`,
  'Book Status & Production Updates': `Use the actual production status provided. If delayed, be honest about why (e.g. waiting on proof approval) without blaming the author. Give a specific updated timeline. If the book is still in production, no sales or royalties exist yet.`,
  'General Inquiry': `Answer the question directly from the policies provided. If it is not covered, say the team will confirm within 48 hours rather than guessing.`,
};

export const kbFor = (category) => {
  const keys = CATEGORY_SECTIONS[category] ?? CATEGORY_SECTIONS['General Inquiry'];
  return [KB.company, ...keys.map((k) => KB[k]), KB.tone].join('\n\n');
};
