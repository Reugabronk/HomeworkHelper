// Anthropic (Claude) via de officiële SDK, rechtstreeks vanuit de browser.
// `dangerouslyAllowBrowser` zorgt dat de SDK de header
// "anthropic-dangerous-direct-browser-access: true" meestuurt. Dat is hier bewust:
// iedere gebruiker gebruikt zijn eigen sleutel, die alleen op zijn eigen apparaat staat.
import Anthropic from '@anthropic-ai/sdk';
import type { AanbiederConfig, AiAanbieder, AiBericht, AiVerzoek, ModelInfo } from './types';
import { AiFout, foutVoorStatus, netwerkFout } from './errors';

/** Bekende modellen, voor als de modellenlijst (nog) niet is opgehaald. */
export const ANTHROPIC_MODELLEN: ModelInfo[] = [
  { id: 'claude-opus-5-5', naam: 'Claude Opus 5.5 (beste kwaliteit)', afbeeldingen: true },
  { id: 'claude-sonnet-5-5', naam: 'Claude Sonnet 5.5 (snel en goedkoper)', afbeeldingen: true },
  { id: 'claude-haiku-5-5', naam: 'Claude Haiku 5.5 (snelst en goedkoopst)', afbeeldingen: true },
  { id: 'claude-fable-5-1', naam: 'Claude Fable 5.1 (krachtigst, duurst)', afbeeldingen: true },
];

/**
 * Modellen van de 5-generatie ondersteunen server-side terugval: als het model om
 * beleidsredenen weigert, probeert de API het verzoek op een ander model.
 */
export function ondersteuntTerugval(model: string): boolean {
  return /^claude-(opus|sonnet|haiku|fable|mythos)-5(-|$)/.test(model);
}

/** Modellen die gestructureerde JSON-uitvoer (output_config.format) ondersteunen. */
export function ondersteuntJsonSchema(model: string): boolean {
  return /^claude-(opus|sonnet|haiku)-4-[5-9]|^claude-(opus|sonnet|haiku|fable|mythos)-5/.test(model);
}

type BetaParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

function naarAnthropicBerichten(berichten: AiBericht[]): Anthropic.Beta.BetaMessageParam[] {
  return berichten.map((b) => ({
    role: b.rol,
    content: b.inhoud.map((i): Anthropic.Beta.BetaContentBlockParam =>
      i.type === 'tekst'
        ? { type: 'text', text: i.tekst }
        : { type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.base64 } },
    ),
  }));
}

/** Bouwt de parameters voor de Messages API (los gezet zodat het te testen is). */
export function bouwAnthropicParams(model: string, verzoek: AiVerzoek): BetaParams {
  const params: BetaParams = {
    model,
    max_tokens: verzoek.maxTokens,
    system: verzoek.systeem,
    messages: naarAnthropicBerichten(verzoek.berichten),
  };
  if (verzoek.jsonSchema && ondersteuntJsonSchema(model)) {
    params.output_config = { format: { type: 'json_schema', schema: verzoek.jsonSchema } };
  }
  if (ondersteuntTerugval(model)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

/** Zet fouten van de SDK om naar een begrijpelijke AiFout. */
export function vertaalAnthropicFout(fout: unknown): AiFout {
  if (fout instanceof AiFout) return fout;
  if (fout instanceof Anthropic.APIUserAbortError) return new AiFout('afgebroken');
  // APIConnectionError is een subklasse van APIError: eerst controleren.
  if (fout instanceof Anthropic.APIConnectionError) return netwerkFout(fout.message);
  if (fout instanceof Anthropic.APIError) {
    const body = fout.error as { error?: { type?: string; message?: string } } | undefined;
    const detail = body?.error?.message ?? fout.message;
    return foutVoorStatus(fout.status ?? 0, detail, body?.error?.type);
  }
  if (fout instanceof DOMException && fout.name === 'AbortError') return new AiFout('afgebroken');
  if (fout instanceof TypeError) return netwerkFout(fout.message);
  return new AiFout('onbekend', fout instanceof Error ? fout.message : String(fout));
}

export class AnthropicAanbieder implements AiAanbieder {
  readonly id = 'anthropic';
  readonly naam = 'Anthropic (Claude)';
  private readonly client: Anthropic;

  constructor(private readonly config: AanbiederConfig) {
    if (!config.sleutel) throw new AiFout('geen-sleutel');
    this.client = new Anthropic({
      apiKey: config.sleutel,
      dangerouslyAllowBrowser: true,
      maxRetries: 2,
    });
  }

  async lijstModellen(): Promise<ModelInfo[]> {
    try {
      const modellen: ModelInfo[] = [];
      for await (const m of this.client.models.list({ limit: 100 })) {
        modellen.push({
          id: m.id,
          naam: m.display_name || m.id,
          afbeeldingen: m.capabilities?.image_input?.supported,
        });
      }
      return modellen;
    } catch (fout) {
      throw vertaalAnthropicFout(fout);
    }
  }

  async genereer(verzoek: AiVerzoek): Promise<string> {
    try {
      // Streaming voorkomt time-outs bij lange antwoorden en laat de tekst live zien.
      const stream = this.client.beta.messages.stream(bouwAnthropicParams(this.config.model, verzoek), {
        signal: verzoek.signal,
      });
      if (verzoek.opTekst) {
        const opTekst = verzoek.opTekst;
        stream.on('text', (_delta, totaal) => opTekst(totaal));
      }
      const bericht = await stream.finalMessage();
      if (bericht.stop_reason === 'refusal') {
        throw new AiFout('geweigerd', bericht.stop_details?.explanation ?? undefined);
      }
      const tekst = bericht.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      if (bericht.stop_reason === 'max_tokens' && (verzoek.jsonSchema || !tekst.trim())) {
        throw new AiFout('afgekapt');
      }
      return tekst;
    } catch (fout) {
      throw vertaalAnthropicFout(fout);
    }
  }

  async test(): Promise<string> {
    try {
      const model = await this.client.models.retrieve(this.config.model);
      const antwoord = await this.genereer({
        systeem: 'Je test alleen of de verbinding werkt.',
        berichten: [{ rol: 'user', inhoud: [{ type: 'tekst', tekst: 'Antwoord met alleen het woord: OK' }] }],
        maxTokens: 2048,
      });
      return `Verbinding werkt. ${model.display_name || model.id} antwoordde: "${antwoord.trim().slice(0, 40)}"`;
    } catch (fout) {
      throw vertaalAnthropicFout(fout);
    }
  }
}
