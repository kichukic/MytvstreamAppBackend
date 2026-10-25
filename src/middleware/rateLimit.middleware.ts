import { rateLimit } from 'express-rate-limit';

// Sign-in attempts per address, so passwords can't be guessed at speed.
export const signInLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

// Lookups per address, so the whole service's address book can't be guessed
// through at speed.
export const lookupLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });
