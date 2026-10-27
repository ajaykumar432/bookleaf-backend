import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

export const notFound = (req, res, next) =>
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again.';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Request validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err.name === 'CastError') {
    status = 400; code = 'INVALID_ID'; message = `Invalid ${err.path}`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401; code = 'INVALID_TOKEN'; message = 'Session expired or invalid. Please log in again.';
  } else if (err.code === 11000) {
    status = 409; code = 'DUPLICATE'; message = 'Duplicate value';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'BAD_JSON'; message = 'Malformed JSON body';
  } else {
    console.error('[error]', err);
  }

  res.status(status).json({ error: { code, message, ...(details && { details }) } });
}
