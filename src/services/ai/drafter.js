import { complete, AIUnavailableError } from './client.js';
import { CATEGORY_GUIDANCE, kbFor } from './knowledgeBase.js';
import { buildFacts } from './context.js';
import { templateDraft } from './fallback.js';

const SYSTEM_BASE = `You are a senior author-support representative at BookLeaf Publishing, drafting a reply for a human teammate to review and send.

RULES
- Write the reply body only: start with "Hi <first name>,", end with "Warm regards,\\nBookLeaf Author Support". No subject line, no markdown, no bullet symbols unless listing 3+ items.
- Use ONLY the policies and FACTS provided. Quote real numbers, dates and statuses from FACTS. NEVER invent figures, dates, tracking numbers or policies.
- If a needed fact is missing, say the team will verify and confirm within 48 hours, and put "[ADMIN: ...]" where a human must fill something in.
- Do not promise outcomes the policies don't support (e.g. refunds, free services not in policy).
- Keep it 110-190 words, warm and direct, in plain English. No filler like "I hope this email finds you well".
- Acknowledge the concern first, own BookLeaf's mistakes plainly, give a concrete timeline, and finish with one clear next step.`;

const trim = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Builds a token-lean prompt:
 *  - KB slice for this ticket's category only
 *  - facts for the ticket's own book only
 *  - last 4 messages of thread, each truncated
 */
export function buildDraftPrompt({ ticket, author, ticketBook, books, instruction }) {
  const system = `${SYSTEM_BASE}\n\nKNOWLEDGE BASE\n${kbFor(ticket.category)}\n\nCATEGORY GUIDANCE (${ticket.category})\n${CATEGORY_GUIDANCE[ticket.category]}`;

  const history = (ticket.responses ?? []).slice(-4).map((r) => `${r.role === 'admin' ? 'BookLeaf' : 'Author'}: ${trim(r.message, 500)}`);
  const user = [
    `FACTS\n${buildFacts({ authorName: author.name, ticketBook, books })}`,
    `TICKET ${ticket.ticketNumber} (priority ${ticket.priority})\nSubject: ${trim(ticket.subject, 150)}\nAuthor's message: ${trim(ticket.description, 2000)}`,
    history.length ? `CONVERSATION SO FAR (latest last)\n${history.join('\n')}` : null,
    instruction ? `ADMIN INSTRUCTION FOR THIS DRAFT: ${trim(instruction, 300)}` : null,
    'Write the reply now.',
  ].filter(Boolean).join('\n\n');
  return { system, user };
}

export async function draftReply(args) {
  const firstName = args.author.name.split(' ')[0];
  try {
    const { system, user } = buildDraftPrompt(args);
    const res = await complete({ system, user, maxTokens: 450, temperature: 0.4 });
    if (res.text.length < 40) throw new AIUnavailableError('Draft too short');
    return { text: res.text, source: 'ai', model: res.model, tokens: res.usage };
  } catch (err) {
    console.warn(`[ai] draft fallback for ${args.ticket.ticketNumber}: ${err.message}`);
    return { text: templateDraft(args.ticket.category, firstName), source: 'template', model: null, tokens: null };
  }
}
