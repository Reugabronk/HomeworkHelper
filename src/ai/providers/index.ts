// Register van AI-aanbieders. Nieuwe aanbieder toevoegen? Implementeer `AiAanbieder`
// en voeg hem hieronder toe (en in `AanbiederId` in data/settings.ts).
import type { AanbiederId, Instellingen, Sleutels } from '../../data/settings';
import { ANTHROPIC_MODELLEN, AnthropicAanbieder } from './anthropic';
import { OpenAiCompatibeleAanbieder } from './openai-compatible';
import type { AanbiederConfig, AiAanbieder, ModelInfo } from './types';

export interface AanbiederBeschrijving {
  id: AanbiederId;
  naam: string;
  uitleg: string;
  sleutelUrl?: string;
  sleutelVoorbeeld: string;
  heeftBaseUrl: boolean;
  bekendeModellen: ModelInfo[];
  maak(config: AanbiederConfig): AiAanbieder;
}

export const AANBIEDERS: Record<AanbiederId, AanbiederBeschrijving> = {
  anthropic: {
    id: 'anthropic',
    naam: 'Anthropic (Claude)',
    uitleg: 'Claude-modellen van Anthropic. Maak een sleutel aan in de Claude Console.',
    sleutelUrl: 'https://platform.claude.com/settings/keys',
    sleutelVoorbeeld: 'sk-ant-…',
    heeftBaseUrl: false,
    bekendeModellen: ANTHROPIC_MODELLEN,
    maak: (config) => new AnthropicAanbieder(config),
  },
  openai: {
    id: 'openai',
    naam: 'OpenAI-compatibel (eigen adres)',
    uitleg:
      'Elke dienst met een OpenAI-compatibele API, zoals OpenAI, OpenRouter of een lokale Ollama/LM Studio. Vul de basis-URL in, bijvoorbeeld https://api.openai.com/v1.',
    sleutelVoorbeeld: 'sk-…',
    heeftBaseUrl: true,
    bekendeModellen: [],
    maak: (config) => new OpenAiCompatibeleAanbieder(config),
  },
};

/** Maakt de aanbieder die in de instellingen gekozen is. Gooit AiFout als er iets ontbreekt. */
export function maakAanbieder(instellingen: Instellingen, sleutels: Sleutels): AiAanbieder {
  const { aanbieder, model, baseUrl } = instellingen.ai;
  return AANBIEDERS[aanbieder].maak({
    sleutel: sleutels[aanbieder] ?? '',
    model: model[aanbieder],
    baseUrl,
  });
}

export type { AiAanbieder, AiBericht, AiInhoud, AiVerzoek, ModelInfo } from './types';
export { AiFout, foutMelding } from './errors';
