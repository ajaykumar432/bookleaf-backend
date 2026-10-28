import 'dotenv/config';

const need = (key) => {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  return process.env[key];
};

const PROVIDERS = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  anthropic: { baseUrl: null, model: 'claude-haiku-5-5' },
};
const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();
if (!PROVIDERS[provider]) throw new Error(`AI_PROVIDER must be one of: ${Object.keys(PROVIDERS).join(', ')}`);
const apiKey = process.env.AI_API_KEY || (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : '') || '';

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: need('MONGODB_URI'),
  jwtSecret: need('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: (process.env.CLIENT_URL || 'https://bookleaf-frontend-2wwm.vercel.app/').split(',').map((s) => s.trim()),
  referenceDate: process.env.REFERENCE_DATE || null,
  ai: Object.freeze({
    provider,
    apiKey,
    enabled: Boolean(apiKey),
    baseUrl: process.env.AI_BASE_URL || PROVIDERS[provider].baseUrl,
    model: process.env.AI_MODEL || PROVIDERS[provider].model,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 15000,
    maxRetries: Number(process.env.AI_MAX_RETRIES ?? 2),
  }),
});
