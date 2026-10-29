// De coachfuncties die de interface gebruikt: plan maken, feedback, op weg helpen,
// vragen beantwoorden en chatten. Laadt de benodigde afbeeldingen uit de opslag.
import { naarBase64 } from '../data/base64';
import { alleEerdereTheorie, alleOpdrachten, haalAfbeeldingen } from '../data/db';
import type { Instellingen, Sleutels } from '../data/settings';
import type { ChatBericht, HoofdstukId, Opdracht } from '../data/types';
import { PLAN_SCHEMA, leesPlan, type BekendOnderwerp, type Plan } from './plan';
import {
  MAX_TOKENS,
  bouwChatBerichten,
  bouwOnderdeelBerichten,
  bouwPlanBerichten,
  bouwSysteemPrompt,
  type GeladenAfbeelding,
  type OnderdeelContext,
} from './prompts';
import { maakAanbieder } from './providers';

export interface CoachOmgeving {
  instellingen: Instellingen;
  sleutels: Sleutels;
}

export interface VerzoekOpties {
  signal?: AbortSignal;
  opTekst?: (totaal: string) => void;
}

export async function laadAfbeeldingenVoorAi(ids: string[]): Promise<GeladenAfbeelding[]> {
  const afbeeldingen = await haalAfbeeldingen(ids);
  return afbeeldingen.map((a) => ({
    mediaType: a.mediaType,
    base64: naarBase64(a.data),
    bijschrift: a.bijschrift || undefined,
  }));
}

/** Theorie uit andere opdrachten (actief en met tekst) plus geïmporteerde onderwerpen. */
export async function verzamelBekendeTheorie(behalveOpdrachtId?: string): Promise<BekendOnderwerp[]> {
  const [opdrachten, eerdere] = await Promise.all([alleOpdrachten(), alleEerdereTheorie()]);
  const uitOpdrachten = opdrachten
    .filter((o) => o.id !== behalveOpdrachtId)
    .flatMap((o) =>
      o.theorie
        .filter((t) => t.status === 'actief' && t.titel.trim())
        .map((t) => ({ onderwerp: t.titel, bron: `${o.vak ? `${o.vak}: ` : ''}${o.titel}` })),
    );
  const geimporteerd = eerdere.map((t) => ({ onderwerp: t.onderwerp, bron: t.bron }));
  return [...uitOpdrachten, ...geimporteerd];
}

export async function maakPlan(
  omgeving: CoachOmgeving,
  opdracht: Opdracht,
  opties: VerzoekOpties = {},
): Promise<{ plan: Plan; bekend: BekendOnderwerp[] }> {
  const { instellingen } = omgeving;
  const aanbieder = maakAanbieder(instellingen, omgeving.sleutels);
  const bekend = await verzamelBekendeTheorie(opdracht.id);
  const antwoord = await aanbieder.genereer({
    systeem: bouwSysteemPrompt(instellingen.coach, 'plan'),
    berichten: bouwPlanBerichten({
      opdracht,
      diepgang: opdracht.diepgang,
      eerdereTheorie: bekend,
      afbeeldingen: await laadAfbeeldingenVoorAi(opdracht.opdrachtAfbeeldingen),
      maxAfbeeldingen: instellingen.ai.maxAfbeeldingen,
    }),
    maxTokens: MAX_TOKENS.plan,
    jsonSchema: PLAN_SCHEMA,
    ...opties,
  });
  return { plan: leesPlan(antwoord), bekend };
}

export async function vraagCoachOverOnderdeel(
  omgeving: CoachOmgeving,
  taak: 'feedback' | 'opweg' | 'vraag',
  opdracht: Opdracht,
  onderdeel: OnderdeelContext,
  afbeeldingIds: string[],
  vraag: string | undefined,
  opties: VerzoekOpties = {},
): Promise<string> {
  const { instellingen } = omgeving;
  const aanbieder = maakAanbieder(instellingen, omgeving.sleutels);
  const afbeeldingen = taak === 'opweg' ? [] : await laadAfbeeldingenVoorAi(afbeeldingIds);
  return aanbieder.genereer({
    systeem: bouwSysteemPrompt(instellingen.coach, taak),
    berichten: bouwOnderdeelBerichten(taak, {
      opdracht,
      onderdeel,
      afbeeldingen,
      maxAfbeeldingen: instellingen.ai.maxAfbeeldingen,
      vraag,
    }),
    maxTokens: MAX_TOKENS[taak],
    ...opties,
  });
}

export async function chatMetCoach(
  omgeving: CoachOmgeving,
  opdracht: Opdracht,
  hoofdstuk: HoofdstukId,
  geschiedenis: ChatBericht[],
  opties: VerzoekOpties = {},
): Promise<string> {
  const { instellingen } = omgeving;
  const aanbieder = maakAanbieder(instellingen, omgeving.sleutels);
  return aanbieder.genereer({
    systeem: bouwSysteemPrompt(instellingen.coach, 'chat'),
    berichten: bouwChatBerichten(opdracht, hoofdstuk, geschiedenis),
    maxTokens: MAX_TOKENS.chat,
    ...opties,
  });
}
