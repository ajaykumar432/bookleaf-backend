import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';

let connecting;

export default async function handler(req, res) {
  try {
    connecting ??= connectDB();
    await connecting;
  } catch (err) {
    connecting = undefined;
    console.error('[db] connection failed', err.message);
    return res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database unavailable. Please try again shortly.' } });
  }
  return app(req, res);
}