import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { bouwAnthropicParams, ondersteuntTerugval, vertaalAnthropicFout } from '../src/ai/providers/anthropic';
import { AiFout, foutVoorStatus } from '../src/ai/providers/errors';
import { bouwChatBody, leesSse, normaliseerBaseUrl } from '../src/ai/providers/openai-compatible';
import { maakAanbieder } from '../src/ai/providers';
import { STANDAARD_INSTELLINGEN } from '../src/data/settings';
import type { AiVerzoek } from '../src/ai/providers/types';

const verzoek: AiVerzoek = {
  systeem: 'systeem',
  maxTokens: 1000,
  berichten: [
    {
      rol: 'user',
      inhoud: [
        { type: 'tekst', tekst: 'Kijk hiernaar' },
        { type: 'afbeelding', mediaType: 'image/png', base64: 'QUJD' },
      ],
    },
  ],
};

describe('Anthropic', () => {
  it('bouwt een Messages-verzoek met afbeelding en systeemprompt', () => {
    const p = bouwAnthropicParams('claude-opus-5-5', { ...verzoek, jsonSchema: { type: 'object' } });
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.system).toBe('systeem');
    expect(p.messages[0].content).toEqual([
      { type: 'text', text: 'Kijk hiernaar' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
    ]);
    expect(p.output_config?.format).toEqual({ type: 'json_schema', schema: { type: 'object' } });
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    // Geen temperature of andere sampling-parameters (worden door nieuwe modellen geweigerd).
    expect(p).not.toHaveProperty('temperature');
  });

  it('stuurt geen terugval of JSON-schema naar oudere modellen', () => {
    expect(ondersteuntTerugval('claude-haiku-4-5')).toBe(false);
    const p = bouwAnthropicParams('claude-3-7-sonnet-20250219', { ...verzoek, jsonSchema: { type: 'object' } });
    expect(p.fallbacks).toBeUndefined();
    expect(p.output_config).toBeUndefined();
  });

  it('vertaalt fouten naar begrijpelijke meldingen', () => {
    const fout = (status: number, type: string) =>
      vertaalAnthropicFout(Anthropic.APIError.generate(status, { type: 'error', error: { type, message: 'x' } }, 'x', new Headers()));
    expect(fout(401, 'authentication_error').soort).toBe('ongeldige-sleutel');
    expect(fout(429, 'rate_limit_error').soort).toBe('limiet');
    expect(fout(529, 'overloaded_error').soort).toBe('overbelast');
    expect(fout(402, 'billing_error').soort).toBe('tegoed');
    expect(fout(404, 'not_found_error').soort).toBe('model-onbekend');
    expect(vertaalAnthropicFout(new Anthropic.APIConnectionError({ message: 'weg' })).soort).toMatch(/netwerk|offline/);
    expect(vertaalAnthropicFout(new Anthropic.APIUserAbortError()).soort).toBe('afgebroken');
  });

  it('meldt een ontbrekende sleutel', () => {
    expect(() => maakAanbieder(STANDAARD_INSTELLINGEN, {})).toThrowError(AiFout);
    try {
      maakAanbieder(STANDAARD_INSTELLINGEN, {});
    } catch (f) {
      expect((f as AiFout).soort).toBe('geen-sleutel');
      expect((f as AiFout).message).toMatch(/Instellingen/);
    }
  });
});

describe('foutmeldingen', () => {
  it('geeft Nederlandse meldingen per status', () => {
    expect(foutVoorStatus(401).message).toMatch(/sleutel/i);
    expect(foutVoorStatus(429).message).toMatch(/limiet/);
    expect(foutVoorStatus(400, 'Your credit balance is too low').soort).toBe('tegoed');
    expect(foutVoorStatus(500).soort).toBe('server');
  });
});

describe('OpenAI-compatibel', () => {
  it('zet afbeeldingen om naar data-URL\'s', () => {
    const body = bouwChatBody('gpt-x', verzoek, true);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'systeem' });
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'Kijk hiernaar' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
    ]);
  });

  it('normaliseert de basis-URL', () => {
    expect(normaliseerBaseUrl(' https://api.example.com/v1/ ')).toBe('https://api.example.com/v1');
  });

  it('leest een SSE-stroom die over stukken verdeeld binnenkomt', async () => {
    const stukken = ['data: {"a":1}\n', '\ndata: {"a":', '2}\n\ndata: [DONE]\n\n'];
    const stroom = new ReadableStream<Uint8Array>({
      start(c) {
        for (const s of stukken) c.enqueue(new TextEncoder().encode(s));
        c.close();
      },
    });
    const gezien: string[] = [];
    await leesSse(stroom, (d) => gezien.push(d));
    expect(gezien).toEqual(['{"a":1}', '{"a":2}', '[DONE]']);
  });
});
