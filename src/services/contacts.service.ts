// Which of someone's phone contacts are on ForUs. The app sends the numbers
// and emails from its contact list; they are matched against verified phone
// numbers and emails and then forgotten (nothing from the list is stored).
import type { Types } from 'mongoose';
import { Friendship, pairKey } from '../models/friendship.model.js';
import { User, publicUser } from '../models/user.model.js';
import { relationOf } from './friends.service.js';

// Numbers saved without a country code (most contacts) are taken to be in the
// searcher's own country, or this one if their number isn't known.
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? '91';

// Country codes that ForUs numbers start with, longest first, to tell where the
// searcher's own number is from.
const KNOWN_CODES = ['971', '966', '974', '968', '973', '965', '880', '977', '94', '92', '91', '65', '61', '49', '44', '1'];

function countryCodeOf(phone?: string | null): string {
  if (!phone) return DEFAULT_COUNTRY_CODE;
  return KNOWN_CODES.find((c) => phone.startsWith(c)) ?? DEFAULT_COUNTRY_CODE;
}

/** A number as written in a contact, in the stored form (digits, country code first). */
export function normalisePhone(raw: string, countryCode: string): string | null {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    // Already international.
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    // A national number with a trunk 0: 09876543210.
    digits = countryCode + digits.slice(1);
  } else if (digits.length === 10) {
    digits = countryCode + digits;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export async function matchContacts(self: Types.ObjectId, input: { phones: string[]; emails: string[] }) {
  const me = await User.findById(self, 'phone').lean();
  const cc = countryCodeOf(me?.phone);

  // Each stored form, mapped back to the first way it was written in the list.
  const phones = new Map<string, string>();
  for (const raw of input.phones) {
    const phone = normalisePhone(raw, cc);
    if (phone && !phones.has(phone)) phones.set(phone, raw);
  }
  const emails = new Map<string, string>();
  for (const raw of input.emails) {
    const email = raw.trim().toLowerCase();
    if (email.includes('@') && !emails.has(email)) emails.set(email, raw);
  }
  if (!phones.size && !emails.size) return [];

  const users = await User.find(
    {
      _id: { $ne: self },
      $or: [
        { phone: { $in: [...phones.keys()] } },
        // Only verified emails find someone.
        { email: { $in: [...emails.keys()] }, emailVerified: true },
      ],
    },
    'name email emailVerified phone',
  ).lean();
  if (!users.length) return [];

  const links = await Friendship.find({ pair: { $in: users.map((u) => pairKey(self, u._id)) } }).lean();
  const linkByPair = new Map(links.map((l) => [l.pair, l]));

  return users.map((u) => ({
    user: publicUser(u),
    status: relationOf(linkByPair.get(pairKey(self, u._id)) ?? null, self),
    // What matched, as it was written in the contact list, so the app can show
    // the contact's own name for them.
    matched: (u.phone && phones.get(u.phone)) || (u.email && emails.get(u.email)) || '',
  }));
}
