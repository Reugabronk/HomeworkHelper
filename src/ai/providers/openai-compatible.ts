// OpenAI-compatibele aanbieders (OpenAI, OpenRouter, Mistral, Groq, Ollama, LM Studio, ...)
// via de Chat Completions-API met een eigen basis-URL.
import { AiFout, foutVoorStatus, netwerkFout } from './errors';
import type { AanbiederConfig, AiAanbieder, AiBericht, AiVerzoek, ModelInfo } from './types';

type ChatInhoud =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface ChatBericht {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatInhoud[];
}

export function normaliseerBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function naarChatBerichten(systeem: string, berichten: AiBericht[]): ChatBericht[] {
  return [
    { role: 'system', content: systeem },
    ...berichten.map((b): ChatBericht => {
      const alleenTekst = b.inhoud.every((i) => i.type === 'tekst');
      if (alleenTekst || b.rol === 'assistant') {
        return {
          role: b.rol,
          content: b.inhoud.map((i) => (i.type === 'tekst' ? i.tekst : '')).join('\n\n'),
        };
      }
      return {
        role: b.rol,
        content: b.inhoud.map((i): ChatInhoud =>
          i.type === 'tekst'
            ? { type: 'text', text: i.tekst }
            : { type: 'image_url', image_url: { url: `data:${i.mediaType};base64,${i.base64}` } },
        ),
      };
    }),
  ];
}

export function bouwChatBody(model: string, verzoek: AiVerzoek, stream: boolean) {
  return {
    model,
    max_tokens: verzoek.maxTokens,
    stream,
    messages: naarChatBerichten(verzoek.systeem, verzoek.berichten),
  };
}

/** Leest een Server-Sent-Events-stroom en geeft elk `data:`-veld door. */
export async function leesSse(
  body: ReadableStream<Uint8Array>,
  opData: (data: string) => void,
): Promise<void> {
  const lezer = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await lezer.read();
    buffer += decoder.decode(value, { stream: !done });
    const gebeurtenissen = buffer.split(/\r?\n\r?\n/);
    buffer = done ? '' : (gebeurtenissen.pop() ?? '');
    for (const g of gebeurtenissen) {
      const data = g
        .split(/\r?\n/)
        .filter((r) => r.startsWith('data:'))
        .map((r) => r.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) opData(data);
    }
    if (done) return;
  }
}

async function foutUitAntwoord(antwoord: Response): Promise<AiFout> {
  let detail: string | undefined;
  let type: string | undefined;
  try {
    const json = (await antwoord.json()) as { error?: { message?: string; type?: string; code?: string } | string };
    if (typeof json.error === 'string') detail = json.error;
    else {
      detail = json.error?.message;
      type = json.error?.code ?? json.error?.type;
    }
  } catch {
    // geen JSON
  }
  return foutVoorStatus(antwoord.status, detail, type);
}

export class OpenAiCompatibeleAanbieder implements AiAanbieder {
  readonly id = 'openai';
  readonly naam = 'OpenAI-compatibel';
  private readonly baseUrl: string;

  constructor(private readonly config: AanbiederConfig) {
    this.baseUrl = normaliseerBaseUrl(config.baseUrl ?? '');
    if (!this.baseUrl) throw new AiFout('ongeldig-verzoek', 'Vul de basis-URL van de aanbieder in.');
    // Lokale servers (zoals Ollama) hebben vaak geen sleutel nodig.
    if (!config.sleutel && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(this.baseUrl)) {
      throw new AiFout('geen-sleutel');
    }
  }

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(this.config.sleutel ? { Authorization: `Bearer ${this.config.sleutel}` } : {}),
    };
  }

  private async haal(pad: string, init: RequestInit = {}): Promise<Response> {
    let antwoord: Response;
    try {
      antwoord = await fetch(`${this.baseUrl}${pad}`, { ...init, headers: this.headers() });
    } catch (fout) {
      if (fout instanceof DOMException && fout.name === 'AbortError') throw new AiFout('afgebroken');
      throw netwerkFout(fout instanceof Error ? fout.message : undefined);
    }
    if (!antwoord.ok) throw await foutUitAntwoord(antwoord);
    return antwoord;
  }

  async lijstModellen(): Promise<ModelInfo[]> {
    const antwoord = await this.haal('/models');
    const json = (await antwoord.json()) as { data?: { id: string; name?: string }[] };
    return (json.data ?? [])
      .map((m) => ({ id: m.id, naam: m.name || m.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async genereer(verzoek: AiVerzoek): Promise<string> {
    if (!this.config.model) throw new AiFout('model-onbekend', 'Kies eerst een model.');
    const stream = Boolean(verzoek.opTekst);
    const antwoord = await this.haal('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(bouwChatBody(this.config.model, verzoek, stream)),
      signal: verzoek.signal,
    });
    if (!stream || !antwoord.body) {
      const json = (await antwoord.json()) as {
        choices?: { message?: { content?: string; refusal?: string }; finish_reason?: string }[];
      };
      const keuze = json.choices?.[0];
      if (keuze?.message?.refusal) throw new AiFout('geweigerd', keuze.message.refusal);
      if (keuze?.finish_reason === 'length' && verzoek.jsonSchema) throw new AiFout('afgekapt');
      return keuze?.message?.content ?? '';
    }
    let totaal = '';
    let reden: string | undefined;
    try {
      await leesSse(antwoord.body, (data) => {
        if (data === '[DONE]') return;
        const deel = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
          error?: { message?: string };
        };
        if (deel.error) throw new AiFout('server', deel.error.message);
        const keuze = deel.choices?.[0];
        if (keuze?.delta?.content) {
          totaal += keuze.delta.content;
          verzoek.opTekst?.(totaal);
        }
        if (keuze?.finish_reason) reden = keuze.finish_reason;
      });
    } catch (fout) {
      if (fout instanceof AiFout) throw fout;
      if (fout instanceof DOMException && fout.name === 'AbortError') throw new AiFout('afgebroken');
      throw netwerkFout(fout instanceof Error ? fout.message : undefined);
    }
    if (reden === 'length' && verzoek.jsonSchema) throw new AiFout('afgekapt');
    return totaal;
  }

  async test(): Promise<string> {
    const antwoord = await this.genereer({
      systeem: 'Je test alleen of de verbinding werkt.',
      berichten: [{ rol: 'user', inhoud: [{ type: 'tekst', tekst: 'Antwoord met alleen het woord: OK' }] }],
      maxTokens: 512,
    });
    return `Verbinding werkt. ${this.config.model} antwoordde: "${antwoord.trim().slice(0, 40)}"`;
  }
}
