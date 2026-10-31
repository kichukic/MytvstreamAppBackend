import { rateLimit } from 'express-rate-limit';

// Sign-in attempts per address, so passwords can't be guessed at speed.
export const signInLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

// Lookups per address, so the whole service's address book can't be guessed
// through at speed.
export const lookupLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });

// Contact matching per address: a contact list at a time, a few times an hour,
// so it can't be used to sweep through numbers to see who's on ForUs.
export const contactsLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

// Profile picture changes per address: enough for a few tries, not a free
// image host.
export const avatarLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false });
