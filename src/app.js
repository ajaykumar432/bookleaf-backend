import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.clientOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BookLeaf Backend API is running",
  });
});

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down', ai: env.ai.enabled ? 'configured' : 'disabled (fallback mode)' }));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

export default app;
