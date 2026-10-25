// Confirming a phone number or an email with Phone.Email. The app shows their
// page, where the person gets a code by SMS or email; when it's right, the page
// hands the app a result, which it sends here. It is only believed once
// Phone.Email itself answers for it, and each result counts once.
//
//   phone: an access token, checked with their getuser API
//   email: a link to a JSON file on user.phone.email, which is downloaded here
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { UsedVerification } from '../models/usedVerification.model.js';
import { HttpError } from '../utils/httpError.js';

const GET_USER_URL = 'https://eapi.phone.email/getuser';
// Only Phone.Email's own result files are ever fetched.
const EMAIL_RESULT_URL = /^https:\/\/user\.phone\.email\/user_[A-Za-z0-9]+\.json$/;
const TIMEOUT_MS = 10000;
const FAILED = "That verification didn't go through. Please try again.";

export type VerifiedPhone = {
  // Digits only, country code first: 919876543210.
  phone: string;
  name?: string;
};

function assertConfigured() {
  if (!config.phoneEmailClientId) throw new HttpError(503, 'Verification is not set up on the server yet.');
}

/** Marks a verification as used; a second use is refused. */
async function useOnce(kind: string, value: string) {
  const key = createHash('sha256').update(`${kind}:${value}`).digest('hex');
  try {
    await UsedVerification.create({ key });
  } catch {
    throw new HttpError(401, 'That verification was already used. Please verify again.');
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return {};
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new HttpError(502, "Couldn't reach the verification service. Try again.");
  }
}

export async function verifyPhoneToken(accessToken: string): Promise<VerifiedPhone> {
  assertConfigured();
  const data = await fetchJson(GET_USER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: accessToken, client_id: config.phoneEmailClientId }),
  });
  const digits = `${data.country_code ?? ''}${data.phone_no ?? ''}`.replace(/\D/g, '');
  // A rejected token comes back as { status: 0 } with no number.
  if (!data.phone_no || digits.length < 8 || digits.length > 15) throw new HttpError(401, FAILED);
  await useOnce('phone', accessToken);
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  return { phone: digits, name: name || undefined };
}

export async function verifyEmailResult(resultUrl: string): Promise<{ email: string }> {
  assertConfigured();
  if (!EMAIL_RESULT_URL.test(resultUrl)) throw new HttpError(401, FAILED);
  const data = await fetchJson(resultUrl);
  const email = typeof data.user_email_id === 'string' ? data.user_email_id.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(401, FAILED);
  await useOnce('email', resultUrl);
  return { email };
}

// A new phone number or email gets a short-lived ticket, signed by us, so the
// app can ask for the person's name before the account is made, without
// verifying twice.
const TICKET_PURPOSE = 'signup';
const TICKET_TTL = '15m';

export type Verified = { phone: string } | { email: string };

export function signTicket(verified: Verified): string {
  return jwt.sign({ ...verified, purpose: TICKET_PURPOSE }, config.jwtSecret, { expiresIn: TICKET_TTL });
}

export function readTicket(ticket: string): Verified {
  try {
    const payload = jwt.verify(ticket, config.jwtSecret);
    if (typeof payload === 'object' && payload.purpose === TICKET_PURPOSE) {
      if (typeof payload.phone === 'string') return { phone: payload.phone };
      if (typeof payload.email === 'string') return { email: payload.email };
    }
  } catch {
    // Falls through: expired or forged.
  }
  throw new HttpError(401, 'That took too long. Please verify again.');
}
