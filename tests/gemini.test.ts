import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiAanbieder, bouwGeminiBody, kiesGeminiModel, vertaalGeminiFout } from '../src/ai/providers/gemini';
import { STANDAARD_INSTELLINGEN, normaliseerInstellingen } from '../src/data/settings';

const sse = (...delen: unknown[]) =>
  new Response(delen.map((d) => `data: ${JSON.stringify(d)}\r\n\r\n`).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } });

afterEach(() => vi.unstubAllGlobals());

describe('Gemini', () => {
  it('is de standaardaanbieder (gratis), maar bestaande keuzes blijven staan', () => {
    expect(STANDAARD_INSTELLINGEN.ai.aanbieder).toBe('gemini');
    expect(normaliseerInstellingen({ ai: { aanbieder: 'anthropic' } }).ai.aanbieder).toBe('anthropic');
    expect(normaliseerInstellingen({}).ai.model.gemini).toBe('gemini-flash-latest');
  });

  it('bouwt een verzoek met systeeminstructie, rollen en afbeeldingen', () => {
    const body = bouwGeminiBody({
      systeem: 'sys',
      maxTokens: 500,
      jsonSchema: { type: 'object' },
      berichten: [
        { rol: 'user', inhoud: [{ type: 'tekst', tekst: 'hoi' }, { type: 'afbeelding', mediaType: 'image/png', base64: 'QUJD' }] },
        { rol: 'assistant', inhoud: [{ type: 'tekst', tekst: 'dag' }] },
      ],
    });
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] });
    expect(body.contents[0]).toEqual({ role: 'user', parts: [{ text: 'hoi' }, { inline_data: { mime_type: 'image/png', data: 'QUJD' } }] });
    expect(body.contents[1].role).toBe('model');
    expect(body.generationConfig).toEqual({ maxOutputTokens: 500, responseMimeType: 'application/json' });
  });

  it('kiest de Flash-alias of anders de nieuwste stabiele Flash', () => {
    const m = (...ids: string[]) => ids.map((id) => ({ id, naam: id }));
    expect(kiesGeminiModel(m('gemini-3.6-flash', 'gemini-flash-latest'))).toBe('gemini-flash-latest');
    expect(kiesGeminiModel(m('gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash-preview', 'gemini-3.5-flash-lite'))).toBe('gemini-3.6-flash');
  });

  it('vertaalt fouten naar begrijpelijke meldingen', () => {
    expect(vertaalGeminiFout(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } }).soort).toBe('ongeldige-sleutel');
    expect(vertaalGeminiFout(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }).soort).toBe('limiet');
    expect(vertaalGeminiFout(400, { error: { status: 'FAILED_PRECONDITION', message: 'User location is not supported' } }).soort).toBe('geen-toegang');
    expect(vertaalGeminiFout(503, { error: { status: 'UNAVAILABLE' } }).soort).toBe('overbelast');
    expect(vertaalGeminiFout(404, undefined).soort).toBe('model-onbekend');
  });

  it('streamt tekst, slaat "gedachten" over en stuurt de sleutel in een header', async () => {
    const fetchMock = vi.fn(async () =>
      sse(
        { candidates: [{ content: { parts: [{ text: 'denken…', thought: true }] } }] },
        { candidates: [{ content: { parts: [{ text: 'Hallo ' }] } }] },
        { candidates: [{ content: { parts: [{ text: 'student' }] }, finishReason: 'STOP' }] },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const live: string[] = [];
    const tekst = await new GeminiAanbieder({ sleutel: 'AIzaTEST', model: 'gemini-flash-latest' }).genereer({
      systeem: 's',
      maxTokens: 100,
      berichten: [{ rol: 'user', inhoud: [{ type: 'tekst', tekst: 'hoi' }] }],
      opTekst: (t) => live.push(t),
    });
    expect(tekst).toBe('Hallo student');
    expect(live.at(-1)).toBe('Hallo student');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaTEST');
    expect(url).not.toContain('AIzaTEST');
  });

  it('meldt een geblokkeerd antwoord als weigering', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse({ promptFeedback: { blockReason: 'SAFETY' } })));
    await expect(
      new GeminiAanbieder({ sleutel: 'k', model: 'm' }).genereer({ systeem: 's', maxTokens: 10, berichten: [{ rol: 'user', inhoud: [{ type: 'tekst', tekst: 'x' }] }] }),
    ).rejects.toMatchObject({ soort: 'geweigerd' });
  });

  it('haalt alleen tekstmodellen op', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          models: [
            { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
            { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
          ],
        }),
      ),
    );
    const lijst = await new GeminiAanbieder({ sleutel: 'k', model: 'm' }).lijstModellen();
    expect(lijst.map((m) => m.id)).toEqual(['gemini-flash-latest']);
  });
});
