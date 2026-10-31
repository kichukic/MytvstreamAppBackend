import type { Request, Response } from 'express';
import { z } from 'zod';
import { parse } from '../utils/validate.js';

// Fast, high-quota models first (flash-lite series), then standard flash and gemma fallbacks.
const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemma-4-31b-it',
];
const MODEL_ATTEMPTS = 2;
const PER_REQUEST_TIMEOUT_MS = 12000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class AiBusyError extends Error {}

/**
 * Asks Gemini for one JSON object, trying the fast models first. Everything
 * that isn't JSON is treated as a failed attempt, so a bad answer from one
 * model doesn't reach the app.
 */
async function generateJson(apiKey: string, instruction: string, prompt: string, temperature: number): Promise<unknown> {
  let lastError: Error | null = null;
  let busy = false;
  // Newer Google API keys authenticate with a header; the ?key= query form is
  // no longer accepted for them.
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };

  for (const model of GEMINI_MODELS) {
    // A model can be momentarily saturated (503) or still provisioning (404);
    // retry with a short backoff before falling through to the next name.
    for (let attempt = 1; attempt <= MODEL_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${endpoint}/models/${model}:generateContent`, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${instruction}\n\n${prompt}` }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini ${model} error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const rawText = (data?.candidates?.[0]?.content?.parts ?? [])
          .map((part: { text?: string }) => part?.text ?? '')
          .join('')
          .trim();
        if (!rawText) throw new Error('Empty response from Gemini');

        // A model occasionally wraps JSON in a Markdown fence despite the
        // responseMimeType setting.
        const json = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        return JSON.parse(json);
      } catch (err) {
        lastError = err as Error;
        // A saturated/timed-out model is worth retrying, and flags the caller
        // to say "busy" rather than a generic failure; a 404 means the name is
        // wrong for this key, so move on to the next one.
        if (/\((503|429)\)/.test(lastError.message) || (err as Error).name === 'AbortError') {
          busy = true;
        }
        if (attempt < MODEL_ATTEMPTS && /\((503|429)\)/.test(lastError.message)) {
          await sleep(attempt * 700);
          continue;
        }
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // A saturated service is a retry-later situation, not a broken request.
  if (busy) throw new AiBusyError('The AI service is busy right now. Please try again in a moment.');
  throw lastError ?? new Error('Failed to generate a recommendation from Gemini.');
}

function sendAiFailure(res: Response, error: unknown) {
  if (error instanceof AiBusyError) {
    return res.status(503).json({ error: error.message });
  }
  return res.status(502).json({
    error: (error as Error)?.message || 'Failed to generate recommendations from Gemini.',
  });
}

function missingKey(res: Response) {
  return res.status(503).json({
    error: 'GEMINI_API_KEY is not set on the backend server. Add GEMINI_API_KEY to your environment.',
  });
}

export async function aiSearch(req: Request, res: Response) {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length < 2) {
    return res.status(400).json({ error: 'Prompt is required (min 2 characters)' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return missingKey(res);

  const systemInstruction = `You are a film and television recommendation engine.
Analyze the user's natural language vibe, mood, theme, or description.
Suggest 5 to 8 specific, real, well-known movies or television series that best match the requested vibe.
Always return accurate release years.
Return valid JSON only in this format:
{
  "results": [
    {
      "title": "Exact Title",
      "year": 2014,
      "reason": "1 concise sentence why this matches the vibe"
    }
  ]
}`;

  try {
    const parsed = await generateJson(apiKey, systemInstruction, `User vibe request: "${prompt}"`, 0.7);
    const results = Array.isArray((parsed as { results?: unknown })?.results)
      ? ((parsed as { results: unknown[] }).results)
      : [];
    return res.json({ results });
  } catch (error) {
    return sendAiFailure(res, error);
  }
}

const tonightBody = z.object({
  mood: z.string().trim().max(100).optional(),
  minutes: z.number().int().min(20).max(300).optional(),
  company: z.enum(['alone', 'partner', 'friends', 'family']).optional(),
  language: z.string().trim().max(40).optional(),
  recentTitles: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
});

const COMPANY: Record<string, string> = {
  alone: 'watching alone',
  partner: 'watching with a partner',
  friends: 'watching with friends',
  family: 'watching with family',
};

/** One film or series picked for the mood, time and company someone chose. */
export async function aiTonight(req: Request, res: Response) {
  const prefs = parse(tonightBody, req.body ?? {});

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return missingKey(res);

  const mood = prefs.mood?.trim() || 'surprise me';
  const minutes = prefs.minutes ? `about ${prefs.minutes} minutes` : 'any length';
  const company = prefs.company ? COMPANY[prefs.company] : 'with whoever is around';
  const language = prefs.language?.trim() || 'any language';
  // Keep the recent list short; it is only a hint, not the main request.
  const recent = [...new Set((prefs.recentTitles ?? []).map((title) => title.trim()).filter(Boolean))].slice(0, 8);

  const systemInstruction = `You are ForUs's Tonight concierge. Your job is to end the endless scrolling with exactly one great pick.
Choose one real, released film or television series that fits the person's mood, available time, company and language.
Be specific and popular enough that people are likely to find it: no obscure direct-to-video titles, no unreleased films, and never invent a title.
Respect the runtime when one is given. For family viewing, pick something suitable for all ages. For a partner, lean romantic or absorbing. For friends, lean fun and shareable. For someone alone, lean immersive.
The reason should feel personal and concrete, not generic marketing copy. Keep it under 30 words.
Return valid JSON only, with no Markdown, in this format:
{"title":"Exact Title","year":2024,"kind":"movie","reason":"Why this is the right pick tonight."}
kind must be either "movie" or "series". The year must be the actual release year.`;

  const prompt = `Tonight's mood: ${mood}
Time available: ${minutes}
Company: ${company}
Language: ${language}${
    recent.length ? `\nRecently watched (do not recommend these again): ${recent.join('; ')}` : ''
  }`;

  try {
    const raw = await generateJson(apiKey, systemInstruction, prompt, 0.85);
    const object = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const first = Array.isArray(object.results) ? object.results[0] : object.pick ?? object.result ?? object;
    const pick = first && typeof first === 'object' ? (first as Record<string, unknown>) : {};
    const title = typeof pick.title === 'string' ? pick.title.trim().slice(0, 200) : '';
    if (!title) throw new Error('Gemini did not return a title for tonight.');

    const yearNumber = Number(pick.year);
    const year = Number.isInteger(yearNumber) && yearNumber >= 1888 && yearNumber <= 2100 ? yearNumber : undefined;
    const kind = pick.kind === 'series' ? 'series' : 'movie';
    const reason = typeof pick.reason === 'string' ? pick.reason.trim().slice(0, 320) : '';

    return res.json({ pick: { title, year, kind, reason } });
  } catch (error) {
    return sendAiFailure(res, error);
  }
}
