import { applyPolicyFloor } from './classifier.policy.js';

/**
 * Deterministic keyword triage used when the AI is down / unconfigured / returns junk.
 * Cruder than the LLM but keeps the queue usable: every ticket still gets a category + priority.
 */
const RULES = [
  ['ISBN & Metadata Issues', /\bisbn\b|metadata|barcode|wrong book/i],
  ['Royalty & Payments', /royalt|payout|payment|paid|earning|bank|transfer|commission/i],
  ['Printing & Quality', /print|blurry|misalign|binding|misprint|reprint|damaged|colou?r|author cop/i],
  ['Distribution & Availability', /unavailable|amazon|flipkart|listing|listed|stock|not showing|distribution/i],
  ['Book Status & Production Updates', /typeset|proof|cover design|production|status|when will|how long|stuck|delay/i],
];

export function heuristicClassify(text) {
  const category = RULES.find(([, re]) => re.test(text))?.[0] ?? 'General Inquiry';
  let priority = 'Medium';
  if (/legal|lawyer|fraud|scam|plagiar|copyright|never received|not received|haven'?t received|\b([3-9]|1[0-2]) months?\b|urgent|immediately/i.test(text)) priority = 'High';
  if (/\b([6-9]|1[0-2]) months?\b.*(royalt|payment)|(royalt|payment).*\b([6-9]|1[0-2]) months?\b|legal action|lawyer/i.test(text)) priority = 'Critical';
  if (/update.*(bio|description)|how (do|can) i|can i (change|update)|just wondering|^hi\b/i.test(text) && priority === 'Medium') priority = 'Low';
  return { category, priority: applyPolicyFloor(category, priority), confidence: 0.4, reason: 'Keyword-based fallback (AI unavailable)' };
}

const TEMPLATES = {
  'Royalty & Payments': `Thank you for reaching out about your royalties, and I understand how important clarity on this is.\n\nRoyalties are calculated quarterly and paid by bank transfer within 45 days of the quarter ending (minimum payout Rs 1,000; smaller balances roll over). [Add the author's specific figures / next payout date here.]\n\nI have asked our accounts team to review your account, and we will get back to you within 48 hours with a clear update.`,
  'ISBN & Metadata Issues': `Thank you for flagging this. An ISBN problem is a serious data issue and we treat it as high priority.\n\nI am escalating it to our production team right now and we will confirm the resolution within 48 hours.`,
  'Printing & Quality': `I am sorry about the quality of your copies; that is not the standard we want for your book.\n\nCould you please share photos of the defective pages? Once verified, we will arrange a free reprint, which takes 5-7 business days.`,
  'Distribution & Availability': `Thank you for letting us know. A book showing as unavailable is usually a stock sync issue.\n\nI am asking our distribution team to trigger a re-sync now; it should be live again within 24-48 hours.`,
  'Book Status & Production Updates': `Thank you for checking in on your book. [Add the current production stage and what is pending here.]\n\nI will make sure our team shares a confirmed updated timeline with you within 48 hours.`,
  'General Inquiry': `Thank you for reaching out. [Add the answer here.]\n\nIf there is anything else you need, reply here and our team will help within 48 hours.`,
};

export const templateDraft = (category, firstName) =>
  `Hi ${firstName},\n\n${TEMPLATES[category] ?? TEMPLATES['General Inquiry']}\n\nWarm regards,\nBookLeaf Author Support`;
