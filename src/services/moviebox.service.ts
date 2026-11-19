// Server-side MovieBox resolver. Ports the signing + play-info path so the
// app can ask the backend for a stream URL instead of resolving on-device.
import crypto from 'node:crypto';
import { utf8Bytes, md5Hex, hmacMd5Base64, hexBytes, base64 } from '../utils/md5.js';

const HOSTS = [
  'https://api6.aoneroom.com',
  'https://api5.aoneroom.com',
  'https://api4.aoneroom.com',
  'https://api6sg.aoneroom.com',
  'https://api.inmoviebox.com',
];

const SECRET = 'efa891974eecd3148df63aa611602defd101259ba521022c57ae0566bd8e';
const BFF = '/wefeed-mobile-bff';
const TIMEOUT_MS = 20000;
const STOCK_CERT_SHA256 = '03d4b741632d136bc23e2de4c6adcdb7712f1980b619c183221801730bbd0410';
const BUILD_TAG_SALT = 'oneroom';
const BUILD_TAG_INFO_KEY = 'X-Client-Build';

function randomHex(length: number): string {
  let out = '';
  while (out.length < length) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}
function randomId(): string {
  return `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`;
}

const device = {
  deviceId: randomHex(32),
  gaid: randomId(),
  userAgent: 'com.community.oneroom/50020134 (Linux; U; Android 13; en_US; M2012K11AG; Build/TQ2A.230405.003; Cronet/135.0.7012.3)',
};

function clientInfo(): string {
  return JSON.stringify({
    package_name: 'com.community.oneroom',
    version_name: '4.0.04.1112.03',
    version_code: 50020134,
    os: 'android',
    os_version: '13',
    install_ch: 'ps',
    device_id: device.deviceId,
    install_store: 'ps',
    gaid: device.gaid,
    brand: 'Xiaomi',
    model: 'M2012K11AG',
    system_language: 'en',
    net: 'NETWORK_WIFI',
    region: 'US',
    timezone: 'Asia/Kolkata',
    sp_code: '40401',
    'X-Play-Mode': '2',
  });
}

function forwardedFor(): string {
  return `103.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
}

function buildTagStamp(tsMs: number, randPart: number): string {
  const seconds = Math.floor(tsMs / 1000);
  const millis = String(tsMs % 1000).padStart(3, '0');
  return `${seconds}${millis}000${randPart}`;
}
function buildTagForCert(tsMs: number, randPart: number, certSha256Hex: string): string {
  const stamp = buildTagStamp(tsMs, randPart);
  const hash = md5Hex(`${certSha256Hex}${BUILD_TAG_SALT}${stamp}`);
  return `${stamp}.${hash}`;
}
function generateXClientBuild(tsMs: number): string {
  const randPart = Math.floor(Math.random() * 1000);
  return buildTagForCert(tsMs, randPart, STOCK_CERT_SHA256);
}
function withBuildTag(clientInfoJson: string, tag: string): string {
  try {
    const parsed = JSON.parse(clientInfoJson) as Record<string, unknown> | null;
    if (parsed && typeof parsed === 'object') {
      parsed[BUILD_TAG_INFO_KEY] = tag;
      return JSON.stringify(parsed);
    }
  } catch {}
  return clientInfoJson;
}

function canonicalQuery(params: [string, string][]): string {
  if (params.length === 0) return '';
  return params
    .map((param, index) => ({ key: param[0], value: param[1], index }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index))
    .map((part) => `${part.key}=${part.value}`)
    .join('&');
}

let token: string | null = null;
let signingIn: Promise<string> | null = null;

async function signIn(): Promise<string> {
  const body = await request<{ token: string }>('POST', `${BFF}/user-api/visitor-login`, [], {}, false);
  const fresh = body?.token;
  if (!fresh) throw new Error('MovieBox would not let the app in.');
  token = fresh;
  return fresh;
}

async function getToken(): Promise<string> {
  if (token) return token;
  if (!signingIn) {
    signingIn = signIn().finally(() => { signingIn = null; });
  }
  return signingIn;
}

function isNoticeVideo(url: string): boolean {
  return /notice|sample|trailer/i.test(url);
}

async function request<T>(method: 'GET' | 'POST', path: string, params: [string, string][] = [], body?: unknown, auth = true): Promise<T> {
  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  const fullPath = query ? `${path}?${query}` : path;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const ts = Date.now();
  const buildTag = generateXClientBuild(ts);
  const canonical = [
    method,
    'application/json',
    'application/json',
    payload === undefined ? '' : String(utf8Bytes(payload).length),
    String(ts),
    payload === undefined ? '' : md5Hex(payload),
    canonicalQuery(params) ? `${path}?${canonicalQuery(params)}` : path,
  ].join('\n');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Connection: 'keep-alive',
    'x-client-token': `${ts},${md5Hex(String(ts).split('').reverse().join(''))}`,
    'x-tr-signature': `${ts}|2|${hmacMd5Base64(hexBytes(SECRET), canonical)}`,
    'x-client-build': buildTag,
    'x-client-info': withBuildTag(clientInfo(), buildTag),
    'x-client-status': '0',
    'x-forwarded-for': forwardedFor(),
    'User-Agent': device.userAgent,
  };
  if (auth) headers.Authorization = `Bearer ${await getToken()}`;

  let lastError = 'Could not reach MovieBox.';
  for (const host of HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${host}${fullPath}`, { method, headers, body: payload, signal: controller.signal });
      if (res.status === 401 || res.status === 407) {
        token = null;
        return request<T>(method, path, params, body, auth);
      }
      if (!res.ok) { lastError = `MovieBox said ${res.status}.`; continue; }
      const json = await res.json();
      if (json && typeof json.code === 'number' && json.code !== 0) throw new Error(json.message || 'MovieBox turned the request away.');
      return (json?.data ?? json) as T;
    } catch (error) {
      if (error instanceof Error && error.message.includes('turned the request away')) throw error;
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError);
}

export async function resolveStream(subjectId: string, season: number, episode: number): Promise<{ url: string; resolution: number; size: number; headers?: Record<string, string> } | null> {
  try {
    const params: [string, string][] = [['subjectId', subjectId]];
    if (season > 0 && episode > 0) {
      params.push(['se', String(season)], ['ep', String(episode)]);
    }
    const data = await request<{ streams?: { url: string; size?: number; resolutions?: string; signCookie?: string }[] }>(
      'GET',
      `${BFF}/subject-api/play-info/v2`,
      params,
    );
    const streams = (data?.streams ?? []).filter((s) => s?.url && !isNoticeVideo(s.url));
    if (streams.length === 0) return null;
    const best = streams.reduce((pick, s) => {
      const r1 = Number(String(s.resolutions ?? '').split(',')[0]) || 0;
      const r2 = Number(String(pick.resolutions ?? '').split(',')[0]) || 0;
      return r1 > r2 ? s : pick;
    });
    const cookie = (best.signCookie ?? '').trim().replace(/;+$/, '');
    return {
      url: best.url,
      resolution: Number(String(best.resolutions ?? '').split(',')[0]) || 0,
      size: Number(best.size ?? 0),
      ...(cookie ? { headers: { Cookie: cookie } } : {}),
    };
  } catch {
    return null;
  }
}
