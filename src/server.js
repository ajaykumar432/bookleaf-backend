import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import mongoose from 'mongoose';

await connectDB();
const server = app.listen(env.port, () =>
  console.log(`[server] http://localhost:${env.port} (${env.nodeEnv}) | AI: ${env.ai.enabled ? env.ai.model : 'disabled -> fallback mode'}`));

const shutdown = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
