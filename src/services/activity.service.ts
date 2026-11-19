import type { Types } from 'mongoose';
import { Activity } from '../models/activity.model.js';

const MAX_WATCHES = 400;
const MAX_SEARCHES = 200;
const MAX_FAVORITES = 500;
const MAX_DOWNLOADS = 500;
const MAX_OPENS = 600;

type Watch = { id?: string; source?: string; title?: string; at?: string | number; [k: string]: unknown };
type Search = { query?: string; at?: string | number; [k: string]: unknown };
type Fav = { id?: string; source?: string; title?: string; at?: string | number; [k: string]: unknown };
type Dl = { id?: string; source?: string; title?: string; at?: string | number; [k: string]: unknown };
type Open = { id?: string; source?: string; title?: string; at?: string | number; [k: string]: unknown };

function keyOfWatch(w: Watch) { return `w:${w.source}:${w.id}`; }
function keyOfFav(f: Fav) { return `f:${f.source}:${f.id}`; }
function keyOfDl(d: Dl) { return `d:${d.source}:${d.id}`; }
function keyOfOpen(o: Open) { return `o:${o.source}:${o.id}`; }

function toTime(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  if (v instanceof Date) return v.getTime();
  return 0;
}

function mergeByKey<T extends { at?: unknown }>(
  existing: T[],
  incoming: T[],
  keyFn: (x: T) => string,
  max: number,
): T[] {
  const map = new Map<string, T>();
  for (const e of existing) map.set(keyFn(e), e);
  for (const e of incoming) {
    const k = keyFn(e);
    const prev = map.get(k);
    if (!prev || toTime(e.at) >= toTime(prev.at)) map.set(k, e);
  }
  const out = [...map.values()].sort((a, b) => toTime(b.at) - toTime(a.at));
  return out.slice(0, max);
}

function mergeSearches(existing: Search[], incoming: Search[], max: number): Search[] {
  const map = new Map<string, Search>();
  for (const e of existing) {
    const k = (e.query ?? '').toLowerCase().trim();
    const prev = map.get(k);
    if (!prev || toTime(e.at) >= toTime(prev.at)) map.set(k, e);
  }
  for (const e of incoming) {
    const k = (e.query ?? '').toLowerCase().trim();
    if (!k) continue;
    const prev = map.get(k);
    if (!prev || toTime(e.at) >= toTime(prev.at)) map.set(k, e);
  }
  const out = [...map.values()].sort((a, b) => toTime(b.at) - toTime(a.at));
  return out.slice(0, max);
}

export async function getActivity(user: Types.ObjectId) {
  const doc = await Activity.findOne({ user }).lean();
  if (!doc) return { watches: [], searches: [], favorites: [], downloads: [], opens: [], updatedAt: null };
  return {
    watches: doc.watches ?? [],
    searches: doc.searches ?? [],
    favorites: doc.favorites ?? [],
    downloads: doc.downloads ?? [],
    opens: doc.opens ?? [],
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export type IncomingActivity = {
  watches?: Record<string, unknown>[];
  searches?: Record<string, unknown>[];
  favorites?: Record<string, unknown>[];
  downloads?: Record<string, unknown>[];
  opens?: Record<string, unknown>[];
};

export async function mergeActivity(user: Types.ObjectId, incoming: IncomingActivity) {
  const doc = await Activity.findOne({ user });
  const existing = doc
    ? { watches: doc.watches ?? [], searches: doc.searches ?? [], favorites: doc.favorites ?? [], downloads: doc.downloads ?? [], opens: doc.opens ?? [] }
    : { watches: [], searches: [], favorites: [], downloads: [], opens: [] };

  const watches = mergeByKey(existing.watches as Watch[], (incoming.watches ?? []) as Watch[], keyOfWatch, MAX_WATCHES);
  const searches = mergeSearches(existing.searches as Search[], (incoming.searches ?? []) as Search[], MAX_SEARCHES);
  const favorites = mergeByKey(existing.favorites as Fav[], (incoming.favorites ?? []) as Fav[], keyOfFav, MAX_FAVORITES);
  const downloads = mergeByKey(existing.downloads as Dl[], (incoming.downloads ?? []) as Dl[], keyOfDl, MAX_DOWNLOADS);
  const opens = mergeByKey(existing.opens as Open[], (incoming.opens ?? []) as Open[], keyOfOpen, MAX_OPENS);

  if (doc) {
    doc.watches = watches;
    doc.searches = searches;
    doc.favorites = favorites;
    doc.downloads = downloads;
    doc.opens = opens;
    doc.updatedAt = new Date();
    await doc.save();
  } else {
    await Activity.create({ user, watches, searches, favorites, downloads, opens, updatedAt: new Date() });
  }
  return { watches, searches, favorites, downloads, opens, updatedAt: new Date().toISOString() };
}

export async function clearActivity(user: Types.ObjectId) {
  await Activity.deleteMany({ user });
}
