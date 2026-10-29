// Hulpfuncties om nieuwe (lege) onderdelen van het gegevensmodel te maken.
import type {
  ChatBericht,
  CoachAntwoord,
  Diepgang,
  Onderdeel,
  Opdracht,
  Stap,
  Testcase,
  TheorieOnderwerp,
} from './types';

export function nieuwId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nu(): string {
  return new Date().toISOString();
}

export function nieuwOnderdeel(): Onderdeel {
  return { id: nieuwId(), tekst: '', afbeeldingen: [], coach: [] };
}

export function nieuwTheorieOnderwerp(velden: Partial<TheorieOnderwerp> = {}): TheorieOnderwerp {
  return {
    ...nieuwOnderdeel(),
    titel: '',
    uitleg: '',
    vragen: [],
    status: 'actief',
    ...velden,
  };
}

export function nieuweStap(velden: Partial<Stap> = {}): Stap {
  return { ...nieuwOnderdeel(), titel: '', aanwijzing: '', commandos: '', ...velden };
}

export function nieuweTestcase(velden: Partial<Testcase> = {}): Testcase {
  return { id: nieuwId(), beschrijving: '', verwacht: '', werkelijk: '', geslaagd: '', ...velden };
}

export function nieuweOpdracht(velden: {
  vak: string;
  titel: string;
  opdrachtTekst?: string;
  opdrachtAfbeeldingen?: string[];
  diepgang?: Diepgang;
}): Opdracht {
  const tijd = nu();
  return {
    id: nieuwId(),
    vak: velden.vak.trim(),
    titel: velden.titel.trim(),
    opdrachtTekst: velden.opdrachtTekst ?? '',
    opdrachtAfbeeldingen: velden.opdrachtAfbeeldingen ?? [],
    status: 'bezig',
    diepgang: velden.diepgang ?? 'basis',
    samenvatting: '',
    theorie: [],
    stappen: [],
    resultaat: {
      eindresultaat: nieuwOnderdeel(),
      testcases: [],
      testcasesCoach: [],
      reflectievragen: [],
      reflectie: nieuwOnderdeel(),
    },
    chat: [],
    aangemaakt: tijd,
    gewijzigd: tijd,
  };
}

export function nieuwCoachAntwoord(
  soort: CoachAntwoord['soort'],
  tekst: string,
  vraag?: string,
): CoachAntwoord {
  return { id: nieuwId(), soort, tekst, datum: nu(), ...(vraag ? { vraag } : {}) };
}

export function nieuwChatBericht(
  rol: ChatBericht['rol'],
  tekst: string,
  hoofdstuk?: ChatBericht['hoofdstuk'],
): ChatBericht {
  return { id: nieuwId(), rol, tekst, datum: nu(), ...(hoofdstuk ? { hoofdstuk } : {}) };
}

/** Alle afbeelding-id's die een opdracht gebruikt. */
export function afbeeldingenVanOpdracht(opdracht: Opdracht): string[] {
  const ids = [
    ...opdracht.opdrachtAfbeeldingen,
    ...opdracht.theorie.flatMap((t) => t.afbeeldingen),
    ...opdracht.stappen.flatMap((s) => s.afbeeldingen),
    ...opdracht.resultaat.eindresultaat.afbeeldingen,
    ...opdracht.resultaat.reflectie.afbeeldingen,
  ];
  return [...new Set(ids)];
}

/** Maakt een titel vergelijkbaar: kleine letters, zonder leestekens en dubbele spaties. */
export function normaliseerOnderwerp(titel: string): string {
  return titel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
