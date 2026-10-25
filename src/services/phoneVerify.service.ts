// Confirming a phone number with Phone.Email. The app shows their sign-in
// page, where the person gets an SMS code; when it's right, the page hands the
// app an access token. The app sends that here, and it is only believed once
// Phone.Email itself answers for it with the number it verified.
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

const GET_USER_URL = 'https://eapi.phone.email/getuser';
const TIMEOUT_MS = 10000;

export type VerifiedPhone = {
  // Digits only, country code first: 919876543210.
  phone: string;
  name?: string;
};

export async function verifyPhoneToken(accessToken: string): Promise<VerifiedPhone> {
  if (!config.phoneEmailClientId) throw new HttpError(503, 'Phone sign-in is not set up on the server yet.');

  let data: {
    status?: number | string;
    country_code?: string;
    phone_no?: string;
    first_name?: string;
    last_name?: string;
  };
  try {
    const res = await fetch(GET_USER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: accessToken, client_id: config.phoneEmailClientId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    data = await res.json();
  } catch {
    throw new HttpError(502, "Couldn't reach the phone verification service. Try again.");
  }

  const digits = `${data.country_code ?? ''}${data.phone_no ?? ''}`.replace(/\D/g, '');
  // A rejected or used-up token comes back as { status: 0 } with no number.
  if (!data.phone_no || digits.length < 8 || digits.length > 15) {
    throw new HttpError(401, "That phone verification didn't go through. Please try again.");
  }
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  return { phone: digits, name: name || undefined };
}

// A new phone number gets a short-lived ticket, signed by us, so the app can
// ask for the person's name before the account is made, without verifying the
// number twice.
const TICKET_PURPOSE = 'phone-signup';
const TICKET_TTL = '15m';

export function signPhoneTicket(phone: string): string {
  return jwt.sign({ phone, purpose: TICKET_PURPOSE }, config.jwtSecret, { expiresIn: TICKET_TTL });
}

export function readPhoneTicket(ticket: string): string {
  try {
    const payload = jwt.verify(ticket, config.jwtSecret);
    if (typeof payload === 'object' && payload.purpose === TICKET_PURPOSE && typeof payload.phone === 'string') {
      return payload.phone;
    }
  } catch {
    // Falls through: expired or forged.
  }
  throw new HttpError(401, 'That took too long. Verify your number again.');
}
