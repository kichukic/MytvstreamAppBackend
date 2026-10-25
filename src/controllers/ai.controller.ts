import type { Request, Response } from 'express';

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

export async function aiSearch(req: Request, res: Response) {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length < 2) {
    return res.status(400).json({ error: 'Prompt is required (min 2 characters)' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not set on the backend server. Add GEMINI_API_KEY to your environment.',
    });
  }

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
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\nUser vibe request: "${prompt}"` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini ${model} error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Empty response from Gemini');

        const parsed = JSON.parse(rawText);
        const results = Array.isArray(parsed?.results) ? parsed.results : [];
        return res.json({ results });
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
  if (busy) {
    return res.status(503).json({ error: 'The AI service is busy right now. Please try again in a moment.' });
  }
  return res.status(502).json({
    error: lastError?.message || 'Failed to generate recommendations from Gemini.',
  });
}
