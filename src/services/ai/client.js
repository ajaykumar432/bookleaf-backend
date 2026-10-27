import { env } from '../../config/env.js';

export class AIUnavailableError extends Error {}

// Tiny circuit breaker: after 3 consecutive failures, skip the API for 60s so a provider outage
// doesn't add multi-second latency to every ticket.
const breaker = { fails: 0, openUntil: 0 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Free providers retire/rename models often. If the configured model 404s, we ask the provider which
// models it currently serves and switch to a suitable chat model automatically (and log what we picked).
let activeModel = env.ai.model;
const NOT_CHAT = /whisper|tts|guard|embed|orpheus|compound|moderation|safeguard|image|vision-preview/i;
const PREFERRED = [/^llama-3\.3-70b/, /^llama-3\.1-8b/, /llama-4/, /gemma/, /gpt-oss-120b/, /gpt-oss-20b/, /qwen/];
// Reasoning models burn part of max_tokens on hidden thinking, so give them more headroom.
const REASONING = /gpt-oss|qwen3|deepseek-r1|gemini-2\.5|gemini-3/i;

async function discoverModel() {
  const res = await fetch(`${env.ai.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${env.ai.apiKey}` }, signal: AbortSignal.timeout(env.ai.timeoutMs),
  });
  const body = await res.json().catch(() => ({}));
  const ids = (body.data ?? []).map((m) => String(m.id ?? m.name ?? '').replace(/^models\//, '')).filter((id) => id && !NOT_CHAT.test(id));
  const pick = PREFERRED.map((re) => ids.find((id) => re.test(id))).find(Boolean) ?? ids[0];
  if (!pick) throw new HttpError(404, `No usable chat models found for provider ${env.ai.provider}`);
  console.warn(`[ai] model "${activeModel}" unavailable; switching to "${pick}". Set AI_MODEL=${pick} in .env to make this permanent.`);
  activeModel = pick;
}

async function chat({ system, user, maxTokens, temperature }, { withEffort = true } = {}) {
  const body = {
    model: activeModel, max_tokens: REASONING.test(activeModel) ? maxTokens * 4 : maxTokens, temperature,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  // gpt-oss on Groq is a reasoning model; "low" effort keeps replies fast and cheap for triage/drafting.
  if (withEffort && env.ai.provider === 'groq' && /gpt-oss/i.test(activeModel)) body.reasoning_effort = 'low';
  const res = await fetch(`${env.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ai.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(env.ai.timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 400 && body.reasoning_effort && /reasoning/i.test(data?.error?.message || '')) {
      return chat({ system, user, maxTokens, temperature }, { withEffort: false }); // provider rejected the option
    }
    throw new HttpError(res.status, data?.error?.message || res.statusText);
  }
  return {
    text: (data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
    usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
    model: data.model || activeModel,
  };
}

/** OpenAI-compatible /chat/completions. Works for Groq, Gemini (OpenAI endpoint), OpenRouter, and others. */
async function callOpenAICompatible(args) {
  try {
    return await chat(args);
  } catch (err) {
    if (err.status !== 404 || !/model/i.test(err.message)) throw err;
    await discoverModel(); // throws if the provider can't list models
    return chat(args);
  }
}

let anthropic;
async function callAnthropic({ system, user, maxTokens, temperature }) {
  if (!anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: env.ai.apiKey, timeout: env.ai.timeoutMs, maxRetries: 0 });
  }
  const res = await anthropic.messages.create({ model: env.ai.model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] });
  return {
    text: res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim(),
    usage: { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 },
    model: res.model || env.ai.model,
  };
}

/**
 * Single choke-point for all LLM calls (provider-agnostic). Handles timeouts, retry with backoff
 * (429/5xx/network only), and the circuit breaker. Callers only ever see AIUnavailableError and fall back.
 */
export async function complete({ system, user, maxTokens, temperature = 0.2 }) {
  if (!env.ai.enabled) throw new AIUnavailableError('No AI_API_KEY configured');
  if (Date.now() < breaker.openUntil) throw new AIUnavailableError('AI paused after repeated failures');

  const call = env.ai.provider === 'anthropic' ? callAnthropic : callOpenAICompatible;
  let last;
  for (let attempt = 0; attempt <= env.ai.maxRetries; attempt++) {
    try {
      const out = await call({ system, user, maxTokens, temperature });
      if (!out.text) throw new HttpError(502, 'Empty response from model');
      breaker.fails = 0;
      return out;
    } catch (err) {
      last = err;
      const retryable = !err.status || err.status === 429 || err.status >= 500;
      if (!retryable || attempt === env.ai.maxRetries) break;
      await sleep(1000 * 2 ** attempt + Math.random() * 250);
    }
  }
  breaker.fails += 1;
  if (breaker.fails >= 3) breaker.openUntil = Date.now() + 60_000;
  throw new AIUnavailableError(`${env.ai.provider} request failed (${last?.status ?? 'network'}): ${last?.message}`);
}
