// Bouwt alle prompts op uit de coach-instellingen en de opdracht. Pure functies,
// zodat ze goed te testen zijn. De teksten zelf staan in standaard-instructies.ts.
import type { ChatBericht, Diepgang, HoofdstukId, Opdracht, Testcase } from '../data/types';
import type { AiBericht, AiInhoud } from './providers/types';
import type { BekendOnderwerp } from './plan';
import {
  DIEPGANG,
  EIGEN_INSTRUCTIES_KOP,
  HOOFDSTUK_NAMEN,
  MAATSTAF_KOP,
  NIVEAUS,
  ROL,
  STRENGHEID,
  TAAK_CHAT,
  TAAK_FEEDBACK,
  TAAK_OPWEG,
  TAAK_PLAN,
  TAAK_VRAAG,
  VASTE_REGEL,
  VERSLAGOPBOUW,
  taalInstructie,
  type CoachInstellingen,
} from './standaard-instructies';

export type CoachTaak = 'plan' | 'feedback' | 'opweg' | 'vraag' | 'chat';

const TAKEN: Record<CoachTaak, string> = {
  plan: TAAK_PLAN,
  feedback: TAAK_FEEDBACK,
  opweg: TAAK_OPWEG,
  vraag: TAAK_VRAAG,
  chat: TAAK_CHAT,
};

/** Maximaal aantal tokens per taak (inclusief eventueel "nadenken" van het model). */
export const MAX_TOKENS: Record<CoachTaak, number> = {
  plan: 16000,
  feedback: 8000,
  opweg: 4000,
  vraag: 4000,
  chat: 8000,
};

/** Aantal chatberichten dat de coach terugleest. */
export const CHAT_GEHEUGEN = 30;

/** Een afbeelding die al als base64 is geladen. */
export interface GeladenAfbeelding {
  mediaType: 'image/png' | 'image/jpeg';
  base64: string;
  bijschrift?: string;
}

function blok(tag: string, inhoud: string): string {
  return `<${tag}>\n${inhoud.trim()}\n</${tag}>`;
}

/** De systeemprompt: vaste regel + instellingen + taak. */
export function bouwSysteemPrompt(coach: CoachInstellingen, taak: CoachTaak): string {
  const delen = [
    ROL,
    VASTE_REGEL,
    VERSLAGOPBOUW,
    NIVEAUS[coach.niveau].tekst,
    taalInstructie(coach.taal, coach.taalniveau),
    STRENGHEID[coach.strengheid].tekst,
  ];
  if (coach.eigenInstructies.trim()) {
    delen.push(`${EIGEN_INSTRUCTIES_KOP}\n${blok('eigen_instructies', coach.eigenInstructies)}`);
  }
  if (coach.maatstaf.trim()) {
    delen.push(`${MAATSTAF_KOP}\n${blok('maatstaf', coach.maatstaf)}`);
  }
  delen.push(TAKEN[taak]);
  // Herhaling aan het eind: de vaste regel gaat altijd voor.
  delen.push(
    'Onthoud: de VASTE REGEL gaat altijd voor. Schrijf geen kant-en-klare verslagtekst voor de student.',
  );
  return delen.join('\n\n');
}

/** Kiest welke afbeeldingen meegaan, rekening houdend met het maximum per verzoek. */
export function beperkAfbeeldingen<T>(afbeeldingen: T[], max: number): { mee: T[]; weggelaten: number } {
  const grens = Math.max(0, Math.floor(max));
  return { mee: afbeeldingen.slice(0, grens), weggelaten: Math.max(0, afbeeldingen.length - grens) };
}

function afbeeldingInhoud(
  afbeeldingen: GeladenAfbeelding[],
  max: number,
  naam: string,
): { inhoud: AiInhoud[]; notitie: string } {
  const { mee, weggelaten } = beperkAfbeeldingen(afbeeldingen, max);
  const inhoud: AiInhoud[] = [];
  mee.forEach((a, i) => {
    inhoud.push({
      type: 'tekst',
      tekst: `${naam} ${i + 1}${a.bijschrift ? ` (bijschrift: ${a.bijschrift})` : ''}:`,
    });
    inhoud.push({ type: 'afbeelding', mediaType: a.mediaType, base64: a.base64 });
  });
  let notitie = '';
  if (afbeeldingen.length === 0) notitie = `Er zijn geen ${naam.toLowerCase()}s toegevoegd.`;
  else if (weggelaten > 0) {
    notitie = `Er zijn ${afbeeldingen.length} ${naam.toLowerCase()}s; alleen de eerste ${mee.length} zijn meegestuurd (limiet per verzoek).`;
  }
  return { inhoud, notitie };
}

export function beschrijfOpdracht(opdracht: Pick<Opdracht, 'vak' | 'titel' | 'opdrachtTekst' | 'samenvatting'>): string {
  const regels = [
    `Vak: ${opdracht.vak || '(onbekend)'}`,
    `Titel: ${opdracht.titel || '(nog geen titel)'}`,
  ];
  if (opdracht.samenvatting) regels.push(`Samenvatting: ${opdracht.samenvatting}`);
  regels.push('', blok('opdrachttekst', opdracht.opdrachtTekst || '(geen tekst geplakt)'));
  return regels.join('\n');
}

// ---- Plan ----------------------------------------------------------------

export interface PlanInvoer {
  opdracht: Pick<Opdracht, 'vak' | 'titel' | 'opdrachtTekst' | 'samenvatting'>;
  diepgang: Diepgang;
  eerdereTheorie: BekendOnderwerp[];
  afbeeldingen: GeladenAfbeelding[];
  maxAfbeeldingen: number;
}

export function bouwPlanBerichten(invoer: PlanInvoer): AiBericht[] {
  const bekend = invoer.eerdereTheorie.length
    ? invoer.eerdereTheorie.map((t) => `- ${t.onderwerp} (in: ${t.bron})`).join('\n')
    : '(nog geen eerder behandelde theorie bekend)';
  const { inhoud, notitie } = afbeeldingInhoud(invoer.afbeeldingen, invoer.maxAfbeeldingen, 'Afbeelding bij de opdracht');
  const tekst = [
    DIEPGANG[invoer.diepgang].tekst,
    '',
    beschrijfOpdracht(invoer.opdracht),
    '',
    blok('eerder_behandelde_theorie', bekend),
    invoer.afbeeldingen.length ? notitie : '',
  ]
    .join('\n')
    .trim();
  return [{ rol: 'user', inhoud: [{ type: 'tekst', tekst }, ...inhoud] }];
}

// ---- Onderdelen (feedback, op weg, vraag) ----------------------------------

export type OnderdeelSoort = 'theorie' | 'stap' | 'eindresultaat' | 'testcases' | 'reflectie';

export interface OnderdeelContext {
  soort: OnderdeelSoort;
  titel: string;
  /** Uitleg/aanwijzing van de coach bij dit onderdeel. */
  aanwijzing?: string;
  vragen?: string[];
  tekst: string;
  commandos?: string;
  testcases?: Testcase[];
}

const SOORT_NAMEN: Record<OnderdeelSoort, string> = {
  theorie: 'Theorie-onderwerp (hoofdstuk 1)',
  stap: 'Stap van de uitwerking (hoofdstuk 2)',
  eindresultaat: 'Eindresultaat (hoofdstuk 3)',
  testcases: 'Testcases (hoofdstuk 3)',
  reflectie: 'Reflectie (hoofdstuk 3)',
};

export function testcasesAlsTekst(testcases: Testcase[]): string {
  if (!testcases.length) return '(nog geen testcases)';
  return testcases
    .map(
      (t, i) =>
        `${i + 1}. ${t.beschrijving || '(geen beschrijving)'}\n   Verwacht: ${t.verwacht || '-'}\n   Werkelijk: ${t.werkelijk || '-'}\n   Geslaagd: ${t.geslaagd || 'nog niet ingevuld'}`,
    )
    .join('\n');
}

export function beschrijfOnderdeel(o: OnderdeelContext): string {
  const regels = [`Onderdeel: ${SOORT_NAMEN[o.soort]}`, `Titel: ${o.titel || '(geen titel)'}`];
  if (o.aanwijzing?.trim()) regels.push(blok('aanwijzing_van_de_coach', o.aanwijzing));
  if (o.vragen?.length) regels.push(blok('vragen_die_beantwoord_moeten_worden', o.vragen.map((v) => `- ${v}`).join('\n')));
  if (o.soort === 'testcases') regels.push(blok('testcases', testcasesAlsTekst(o.testcases ?? [])));
  else regels.push(blok('tekst_van_de_student', o.tekst.trim() || '(nog leeg)'));
  if (o.commandos !== undefined) regels.push(blok('commandos', o.commandos.trim() || '(geen commando\'s)'));
  return regels.join('\n');
}

export interface OnderdeelInvoer {
  opdracht: Pick<Opdracht, 'vak' | 'titel' | 'opdrachtTekst' | 'samenvatting'>;
  onderdeel: OnderdeelContext;
  afbeeldingen: GeladenAfbeelding[];
  maxAfbeeldingen: number;
  /** Alleen bij taak 'vraag'. */
  vraag?: string;
}

export function bouwOnderdeelBerichten(taak: 'feedback' | 'opweg' | 'vraag', invoer: OnderdeelInvoer): AiBericht[] {
  // Screenshots zijn vooral nodig bij feedback; bij "op weg" en vragen alleen als er een vraag over is.
  const metAfbeeldingen = taak === 'feedback' || taak === 'vraag';
  const { inhoud, notitie } = metAfbeeldingen
    ? afbeeldingInhoud(invoer.afbeeldingen, invoer.maxAfbeeldingen, 'Screenshot')
    : { inhoud: [], notitie: '' };
  const delen = [
    blok('opdracht', beschrijfOpdracht(invoer.opdracht)),
    blok('onderdeel', beschrijfOnderdeel(invoer.onderdeel)),
  ];
  if (notitie) delen.push(notitie);
  if (taak === 'vraag') delen.push(blok('vraag_van_de_student', invoer.vraag ?? ''));
  return [{ rol: 'user', inhoud: [{ type: 'tekst', tekst: delen.join('\n\n') }, ...inhoud] }];
}

// ---- Chat ----------------------------------------------------------------

/** Korte weergave van wat de student in een hoofdstuk heeft staan. */
export function beschrijfHoofdstuk(opdracht: Opdracht, hoofdstuk: HoofdstukId): string {
  switch (hoofdstuk) {
    case 'opdracht':
      return 'De student bekijkt de opdracht en het plan.';
    case 'theorie': {
      const actief = opdracht.theorie.filter((t) => t.status === 'actief');
      if (!actief.length) return 'Er zijn nog geen theorie-onderwerpen.';
      return actief
        .map((t) => `## ${t.titel}\n${t.tekst.trim() || '(nog geen tekst)'}${t.afbeeldingen.length ? `\n[${t.afbeeldingen.length} afbeelding(en)]` : ''}`)
        .join('\n\n');
    }
    case 'uitwerking':
      if (!opdracht.stappen.length) return 'Er zijn nog geen stappen.';
      return opdracht.stappen
        .map(
          (s, i) =>
            `## Stap ${i + 1}: ${s.titel}\n${s.tekst.trim() || '(nog geen tekst)'}${s.commandos.trim() ? `\nCommando's:\n${s.commandos.trim()}` : ''}${s.afbeeldingen.length ? `\n[${s.afbeeldingen.length} screenshot(s)]` : ''}`,
        )
        .join('\n\n');
    case 'resultaat': {
      const r = opdracht.resultaat;
      return [
        `## Eindresultaat\n${r.eindresultaat.tekst.trim() || '(nog geen tekst)'}`,
        `## Testcases\n${testcasesAlsTekst(r.testcases)}`,
        `## Reflectie\n${r.reflectie.tekst.trim() || '(nog geen tekst)'}`,
      ].join('\n\n');
    }
  }
}

export function bouwChatBerichten(opdracht: Opdracht, hoofdstuk: HoofdstukId, geschiedenis: ChatBericht[]): AiBericht[] {
  const recent = geschiedenis.slice(-CHAT_GEHEUGEN);
  // De eerste beurt moet van de student zijn.
  while (recent.length && recent[0].rol !== 'student') recent.shift();
  if (!recent.length) return [];
  const context = [
    blok('opdracht', beschrijfOpdracht(opdracht)),
    `De student zit nu in: ${HOOFDSTUK_NAMEN[hoofdstuk]}.`,
    blok('inhoud_van_dit_hoofdstuk', beschrijfHoofdstuk(opdracht, hoofdstuk)),
  ].join('\n\n');

  const berichten: AiBericht[] = [];
  recent.forEach((b, i) => {
    const rol = b.rol === 'student' ? 'user' : 'assistant';
    const isLaatste = i === recent.length - 1;
    const tekst = isLaatste && rol === 'user' ? `${blok('context', context)}\n\n${b.tekst}` : b.tekst;
    const vorige = berichten[berichten.length - 1];
    if (vorige && vorige.rol === rol) {
      vorige.inhoud.push({ type: 'tekst', tekst });
    } else {
      berichten.push({ rol, inhoud: [{ type: 'tekst', tekst }] });
    }
  });
  return berichten;
}
