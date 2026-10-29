// Instellingen in localStorage. De API-sleutels staan apart en gaan NOOIT mee in een back-up.
import { GEMINI_STANDAARD_MODEL } from '../ai/providers/gemini';
import { STANDAARD_COACH_INSTELLINGEN, type CoachInstellingen } from '../ai/standaard-instructies';

export type AanbiederId = 'gemini' | 'anthropic' | 'openai';
export const AANBIEDER_IDS: readonly AanbiederId[] = ['gemini', 'anthropic', 'openai'];
export type Thema = 'auto' | 'licht' | 'donker';

export interface Profiel {
  naam: string;
  klas: string;
  school: string;
}

export interface AiInstellingen {
  aanbieder: AanbiederId;
  /** Gekozen model per aanbieder. */
  model: Record<AanbiederId, string>;
  /** Basis-URL voor OpenAI-compatibele aanbieders, bijv. https://api.openai.com/v1 */
  baseUrl: string;
  /** Maximaal aantal afbeeldingen dat per verzoek naar het model gaat. */
  maxAfbeeldingen: number;
}

export interface Instellingen {
  versie: 1;
  profiel: Profiel;
  ai: AiInstellingen;
  coach: CoachInstellingen;
  thema: Thema;
}

export type Sleutels = Partial<Record<AanbiederId, string>>;

export const INSTELLINGEN_SLEUTEL = 'verslagcoach.instellingen';
export const API_SLEUTELS_SLEUTEL = 'verslagcoach.apiSleutels';

export const STANDAARD_MODEL: Record<AanbiederId, string> = {
  gemini: GEMINI_STANDAARD_MODEL,
  anthropic: 'claude-opus-5-5',
  openai: '',
};

export const STANDAARD_INSTELLINGEN: Instellingen = {
  versie: 1,
  profiel: { naam: '', klas: '', school: '' },
  ai: {
    // Gemini heeft een gratis laag: zo kan iedereen zonder tegoed beginnen.
    aanbieder: 'gemini',
    model: { ...STANDAARD_MODEL },
    baseUrl: 'https://api.openai.com/v1',
    maxAfbeeldingen: 6,
  },
  coach: { ...STANDAARD_COACH_INSTELLINGEN },
  thema: 'auto',
};

export const MAX_AFBEELDINGEN_GRENS = 20;

function opslag(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // bijv. als cookies/opslag geblokkeerd zijn
  }
}

function leesJson(sleutel: string): unknown {
  try {
    const ruw = opslag()?.getItem(sleutel);
    return ruw ? JSON.parse(ruw) : undefined;
  } catch {
    return undefined;
  }
}

function isObject(w: unknown): w is Record<string, unknown> {
  return typeof w === 'object' && w !== null && !Array.isArray(w);
}

/** Vult ontbrekende velden aan met standaardwaarden en gooit onbekende/kapotte waarden weg. */
export function normaliseerInstellingen(ruw: unknown): Instellingen {
  const s = STANDAARD_INSTELLINGEN;
  if (!isObject(ruw)) return structuredClone(s);
  const tekst = (w: unknown, standaard: string) => (typeof w === 'string' ? w : standaard);
  const keuze = <T extends string>(w: unknown, opties: readonly T[], standaard: T): T =>
    opties.includes(w as T) ? (w as T) : standaard;

  const profiel = isObject(ruw.profiel) ? ruw.profiel : {};
  const ai = isObject(ruw.ai) ? ruw.ai : {};
  const model = isObject(ai.model) ? ai.model : {};
  const coach = isObject(ruw.coach) ? ruw.coach : {};
  const sc = s.coach;
  const max = Number(ai.maxAfbeeldingen);

  return {
    versie: 1,
    profiel: {
      naam: tekst(profiel.naam, ''),
      klas: tekst(profiel.klas, ''),
      school: tekst(profiel.school, ''),
    },
    ai: {
      aanbieder: keuze(ai.aanbieder, AANBIEDER_IDS, s.ai.aanbieder),
      model: {
        gemini: tekst(model.gemini, s.ai.model.gemini) || s.ai.model.gemini,
        anthropic: tekst(model.anthropic, s.ai.model.anthropic) || s.ai.model.anthropic,
        openai: tekst(model.openai, s.ai.model.openai),
      },
      baseUrl: tekst(ai.baseUrl, s.ai.baseUrl),
      maxAfbeeldingen:
        Number.isFinite(max) && max >= 0
          ? Math.min(Math.round(max), MAX_AFBEELDINGEN_GRENS)
          : s.ai.maxAfbeeldingen,
    },
    coach: {
      strengheid: keuze(coach.strengheid, ['mild', 'normaal', 'streng'] as const, sc.strengheid),
      niveau: keuze(coach.niveau, ['mbo2', 'mbo3', 'mbo4', 'hbo'] as const, sc.niveau),
      taal: tekst(coach.taal, sc.taal).trim() || sc.taal,
      taalniveau: keuze(coach.taalniveau, ['A2', 'B1', 'B2', 'C1'] as const, sc.taalniveau),
      eigenInstructies: tekst(coach.eigenInstructies, sc.eigenInstructies),
      maatstaf: tekst(coach.maatstaf, sc.maatstaf),
    },
    thema: keuze(ruw.thema, ['auto', 'licht', 'donker'] as const, s.thema),
  };
}

export function laadInstellingen(): Instellingen {
  return normaliseerInstellingen(leesJson(INSTELLINGEN_SLEUTEL));
}

export function bewaarInstellingen(instellingen: Instellingen): void {
  opslag()?.setItem(INSTELLINGEN_SLEUTEL, JSON.stringify(normaliseerInstellingen(instellingen)));
}

// ---- API-sleutels: alleen op dit apparaat ----

export function laadSleutels(): Sleutels {
  const ruw = leesJson(API_SLEUTELS_SLEUTEL);
  if (!isObject(ruw)) return {};
  const sleutels: Sleutels = {};
  for (const id of AANBIEDER_IDS) {
    if (typeof ruw[id] === 'string' && ruw[id]) sleutels[id] = (ruw[id] as string).trim();
  }
  return sleutels;
}

export function bewaarSleutel(aanbieder: AanbiederId, sleutel: string): void {
  const sleutels = laadSleutels();
  const schoon = sleutel.trim();
  if (schoon) sleutels[aanbieder] = schoon;
  else delete sleutels[aanbieder];
  const st = opslag();
  if (!st) return;
  if (Object.keys(sleutels).length === 0) st.removeItem(API_SLEUTELS_SLEUTEL);
  else st.setItem(API_SLEUTELS_SLEUTEL, JSON.stringify(sleutels));
}

export function wisSleutels(): void {
  opslag()?.removeItem(API_SLEUTELS_SLEUTEL);
}

/** Toont alleen het begin en eind van een sleutel, bijv. "sk-ant-…3f9a". */
export function maskeerSleutel(sleutel: string): string {
  if (sleutel.length <= 12) return '••••';
  return `${sleutel.slice(0, 7)}…${sleutel.slice(-4)}`;
}
