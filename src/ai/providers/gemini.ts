// Google Gemini via de REST-API (Google AI Studio). Heeft een gratis laag, zodat
// studenten zonder tegoed kunnen beginnen. Werkt rechtstreeks vanuit de browser.
import { AiFout, foutVoorStatus, netwerkFout } from './errors';
import { leesSse } from './openai-compatible';
import type { AanbiederConfig, AiAanbieder, AiBericht, AiVerzoek, ModelInfo } from './types';

export const GEMINI_BASIS = 'https://generativelanguage.googleapis.com/v1beta';

/** Alias die Google laat wijzen naar het nieuwste Flash-model (snel en met gratis laag). */
export const GEMINI_STANDAARD_MODEL = 'gemini-flash-latest';

export const GEMINI_MODELLEN: ModelInfo[] = [
  { id: GEMINI_STANDAARD_MODEL, naam: 'Gemini Flash (nieuwste, gratis laag)', afbeeldingen: true },
  { id: 'gemini-flash-lite-latest', naam: 'Gemini Flash-Lite (nieuwste, sneller)', afbeeldingen: true },
];

type GeminiDeel = { text: string } | { inline_data: { mime_type: string; data: string } };

function naarGeminiInhoud(berichten: AiBericht[]) {
  return berichten.map((b) => ({
    role: b.rol === 'assistant' ? 'model' : 'user',
    parts: b.inhoud.map((i): GeminiDeel => (i.type === 'tekst' ? { text: i.tekst } : { inline_data: { mime_type: i.mediaType, data: i.base64 } })),
  }));
}

/** Bouwt de body voor generateContent (los gezet zodat het te testen is). */
export function bouwGeminiBody(verzoek: AiVerzoek) {
  return {
    systemInstruction: { parts: [{ text: verzoek.systeem }] },
    contents: naarGeminiInhoud(verzoek.berichten),
    generationConfig: {
      maxOutputTokens: verzoek.maxTokens,
      ...(verzoek.jsonSchema ? { responseMimeType: 'application/json' } : {}),
    },
  };
}

interface GeminiFout {
  error?: { code?: number; message?: string; status?: string; details?: { reason?: string }[] };
}

/** Zet een Gemini-foutantwoord om naar een begrijpelijke AiFout. */
export function vertaalGeminiFout(status: number, json: GeminiFout | undefined): AiFout {
  const e = json?.error;
  const bericht = e?.message ?? '';
  const redenen = (e?.details ?? []).map((d) => d.reason ?? '');
  if (redenen.includes('API_KEY_INVALID') || /API key not valid|API key expired/i.test(bericht)) {
    return new AiFout('ongeldige-sleutel', bericht, status);
  }
  if (e?.status === 'RESOURCE_EXHAUSTED' || status === 429) return new AiFout('limiet', bericht, status);
  if (e?.status === 'FAILED_PRECONDITION' && /location|region|country/i.test(bericht)) {
    return new AiFout('geen-toegang', 'Gemini is niet beschikbaar in jouw land of regio.', status);
  }
  if (e?.status === 'PERMISSION_DENIED' || status === 403) return new AiFout('geen-toegang', bericht, status);
  if (e?.status === 'UNAVAILABLE') return new AiFout('overbelast', bericht, status);
  return foutVoorStatus(status, bericht || undefined);
}

/** Kiest het beste beschikbare model: de Flash-alias, anders de nieuwste stabiele Flash. */
export function kiesGeminiModel(modellen: ModelInfo[]): string | undefined {
  const ids = modellen.map((m) => m.id);
  if (ids.includes(GEMINI_STANDAARD_MODEL)) return GEMINI_STANDAARD_MODEL;
  const versie = (id: string) => Number(id.match(/^gemini-(\d+(?:\.\d+)?)-flash$/)?.[1] ?? NaN);
  const stabiel = ids.filter((id) => !Number.isNaN(versie(id))).sort((a, b) => versie(b) - versie(a));
  return stabiel[0] ?? ids.find((id) => id.includes('flash') && !/lite|preview|exp/.test(id)) ?? ids[0];
}

interface GeminiDeelAntwoord {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: GeminiFout['error'];
}

const GEBLOKKEERD = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY'];

export class GeminiAanbieder implements AiAanbieder {
  readonly id = 'gemini';
  readonly naam = 'Google Gemini';

  constructor(private readonly config: AanbiederConfig) {
    if (!config.sleutel) throw new AiFout('geen-sleutel');
  }

  private async haal(pad: string, init: RequestInit = {}): Promise<Response> {
    let antwoord: Response;
    try {
      antwoord = await fetch(`${GEMINI_BASIS}${pad}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.config.sleutel },
      });
    } catch (fout) {
      if (fout instanceof DOMException && fout.name === 'AbortError') throw new AiFout('afgebroken');
      throw netwerkFout(fout instanceof Error ? fout.message : undefined);
    }
    if (!antwoord.ok) {
      const json = (await antwoord.json().catch(() => undefined)) as GeminiFout | undefined;
      throw vertaalGeminiFout(antwoord.status, json);
    }
    return antwoord;
  }

  async lijstModellen(): Promise<ModelInfo[]> {
    const modellen: ModelInfo[] = [];
    let pagina = '';
    do {
      const antwoord = await this.haal(`/models?pageSize=200${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ''}`);
      const json = (await antwoord.json()) as {
        models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
        nextPageToken?: string;
      };
      for (const m of json.models ?? []) {
        const id = m.name.replace(/^models\//, '');
        if (!m.supportedGenerationMethods?.includes('generateContent')) continue;
        if (!id.startsWith('gemini') || /tts|image|embedding|audio|live|robotics|computer-use/.test(id)) continue;
        modellen.push({ id, naam: m.displayName || id, afbeeldingen: true });
      }
      pagina = json.nextPageToken ?? '';
    } while (pagina);
    return modellen.sort((a, b) => a.id.localeCompare(b.id));
  }

  async genereer(verzoek: AiVerzoek): Promise<string> {
    const model = encodeURIComponent(this.config.model || GEMINI_STANDAARD_MODEL);
    const antwoord = await this.haal(`/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      body: JSON.stringify(bouwGeminiBody(verzoek)),
      signal: verzoek.signal,
    });
    if (!antwoord.body) throw new AiFout('netwerk', 'Geen antwoord ontvangen.');
    let totaal = '';
    let reden: string | undefined;
    let blokkade: string | undefined;
    try {
      await leesSse(antwoord.body, (data) => {
        const deel = JSON.parse(data) as GeminiDeelAntwoord;
        if (deel.error) throw vertaalGeminiFout(deel.error.code ?? 500, { error: deel.error });
        if (deel.promptFeedback?.blockReason) blokkade = deel.promptFeedback.blockReason;
        const kandidaat = deel.candidates?.[0];
        for (const p of kandidaat?.content?.parts ?? []) {
          if (p.text && !p.thought) totaal += p.text;
        }
        if (kandidaat?.finishReason) reden = kandidaat.finishReason;
        verzoek.opTekst?.(totaal);
      });
    } catch (fout) {
      if (fout instanceof AiFout) throw fout;
      if (fout instanceof DOMException && fout.name === 'AbortError') throw new AiFout('afgebroken');
      throw netwerkFout(fout instanceof Error ? fout.message : undefined);
    }
    if (blokkade || (reden && GEBLOKKEERD.includes(reden))) throw new AiFout('geweigerd', blokkade ?? reden);
    if (reden === 'MAX_TOKENS' && (verzoek.jsonSchema || !totaal.trim())) throw new AiFout('afgekapt');
    return totaal;
  }

  async test(): Promise<string> {
    const antwoord = await this.genereer({
      systeem: 'Je test alleen of de verbinding werkt.',
      berichten: [{ rol: 'user', inhoud: [{ type: 'tekst', tekst: 'Antwoord met alleen het woord: OK' }] }],
      maxTokens: 1024,
    });
    return `Verbinding werkt. ${this.config.model || GEMINI_STANDAARD_MODEL} antwoordde: "${antwoord.trim().slice(0, 40)}"`;
  }
}
