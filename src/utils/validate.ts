// Reading request input against a schema, and the shapes shared by several
// controllers.
import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError } from './httpError.js';

export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? 'Invalid request.');
  return result.data;
}

export function objectId(value: unknown, what = 'id'): Types.ObjectId {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) throw new HttpError(400, `Invalid ${what}.`);
  return new Types.ObjectId(value);
}

// Emails are compared lower-case; phone numbers digits only.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.').max(254));

export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ''))
  .refine((s) => s.length >= 8 && s.length <= 15, 'Enter the phone number with its country code.');
