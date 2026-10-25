// Turns a thrown problem into a JSON error the app can show.
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError.js';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found.' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // A body that isn't valid JSON.
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'Invalid request.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
}
