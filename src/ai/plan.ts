// Het opdrachtplan dat de coach maakt: schema, controle en verwerking in een opdracht.
import { normaliseerOnderwerp, nieuweStap, nieuweTestcase, nieuwTheorieOnderwerp } from '../data/model';
import type { Opdracht, Stap, Testcase, TheorieOnderwerp } from '../data/types';

export interface PlanTheorie {
  titel: string;
  uitleg: string;
  vragen: string[];
  alBehandeld: boolean;
  eerdereBron: string;
}

export interface Plan {
  titel: string;
  samenvatting: string;
  theorie: PlanTheorie[];
  stappen: { titel: string; aanwijzing: string }[];
  testcases: { beschrijving: string; verwacht: string }[];
  reflectievragen: string[];
}

const tekst = { type: 'string' } as const;
const tekstLijst = { type: 'array', items: tekst } as const;
function object(properties: Record<string, unknown>) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

/** JSON-schema voor gestructureerde uitvoer (alle objecten gesloten, alle velden verplicht). */
export const PLAN_SCHEMA: Record<string, unknown> = object({
  titel: tekst,
  samenvatting: tekst,
  theorie: {
    type: 'array',
    items: object({
      titel: tekst,
      uitleg: tekst,
      vragen: tekstLijst,
      alBehandeld: { type: 'boolean' },
      eerdereBron: tekst,
    }),
  },
  stappen: { type: 'array', items: object({ titel: tekst, aanwijzing: tekst }) },
  testcases: { type: 'array', items: object({ beschrijving: tekst, verwacht: tekst }) },
  reflectievragen: tekstLijst,
});

export class PlanFout extends Error {}

/** Haalt het JSON-object uit een antwoord (ook als er toch tekst of ```-blokken omheen staan). */
export function haalJsonUitTekst(antwoord: string): unknown {
  const zonderBlok = antwoord.replace(/```(?:json)?\s*([\s\S]*?)```/i, '$1');
  const begin = zonderBlok.indexOf('{');
  const eind = zonderBlok.lastIndexOf('}');
  if (begin === -1 || eind <= begin) throw new PlanFout('Het antwoord van de AI bevat geen plan.');
  try {
    return JSON.parse(zonderBlok.slice(begin, eind + 1));
  } catch {
    throw new PlanFout('Het plan van de AI kon niet worden gelezen. Probeer het opnieuw.');
  }
}

const str = (w: unknown) => (typeof w === 'string' ? w.trim() : '');
const strLijst = (w: unknown) => (Array.isArray(w) ? w.map(str).filter(Boolean) : []);
const lijst = (w: unknown) => (Array.isArray(w) ? w.filter((x) => x && typeof x === 'object') : []);

/** Controleert en normaliseert een plan; lege onderdelen worden weggelaten. */
export function leesPlan(antwoord: string): Plan {
  const ruw = haalJsonUitTekst(antwoord) as Record<string, unknown>;
  const plan: Plan = {
    titel: str(ruw.titel),
    samenvatting: str(ruw.samenvatting),
    theorie: lijst(ruw.theorie)
      .map((t: Record<string, unknown>) => ({
        titel: str(t.titel),
        uitleg: str(t.uitleg),
        vragen: strLijst(t.vragen),
        alBehandeld: t.alBehandeld === true,
        eerdereBron: str(t.eerdereBron),
      }))
      .filter((t) => t.titel),
    stappen: lijst(ruw.stappen)
      .map((s: Record<string, unknown>) => ({ titel: str(s.titel), aanwijzing: str(s.aanwijzing) }))
      .filter((s) => s.titel),
    testcases: lijst(ruw.testcases)
      .map((t: Record<string, unknown>) => ({ beschrijving: str(t.beschrijving), verwacht: str(t.verwacht) }))
      .filter((t) => t.beschrijving),
    reflectievragen: strLijst(ruw.reflectievragen),
  };
  if (!plan.theorie.length && !plan.stappen.length) {
    throw new PlanFout('Het plan van de AI was leeg. Probeer het opnieuw of geef meer uitleg bij de opdracht.');
  }
  return plan;
}

export interface BekendOnderwerp {
  onderwerp: string;
  bron: string;
}

/** Zoekt een eerder behandeld onderwerp met (bijna) dezelfde titel. */
export function zoekBekend(titel: string, bekend: BekendOnderwerp[]): BekendOnderwerp | undefined {
  const n = normaliseerOnderwerp(titel);
  if (!n) return undefined;
  return bekend.find((b) => {
    const m = normaliseerOnderwerp(b.onderwerp);
    return m === n || (m.length > 3 && n.length > 3 && (m.includes(n) || n.includes(m)));
  });
}

const heeftWerk = (o: { tekst: string; afbeeldingen: string[]; coach?: unknown[] }) =>
  o.tekst.trim() !== '' || o.afbeeldingen.length > 0;

/**
 * Verwerkt een plan in een opdracht. Onderdelen waar de student al aan gewerkt heeft
 * blijven staan; lege onderdelen worden vervangen door die uit het nieuwe plan.
 */
export function pasPlanToe(opdracht: Opdracht, plan: Plan, bekend: BekendOnderwerp[]): Opdracht {
  const behoudenTheorie = opdracht.theorie.filter(heeftWerk);
  const theorieTitels = new Set(behoudenTheorie.map((t) => normaliseerOnderwerp(t.titel)));
  const nieuweTheorie: TheorieOnderwerp[] = plan.theorie
    .filter((t) => !theorieTitels.has(normaliseerOnderwerp(t.titel)))
    .map((t) => {
      const lokaal = zoekBekend(t.titel, bekend);
      const alBehandeld = t.alBehandeld || Boolean(lokaal);
      return nieuwTheorieOnderwerp({
        titel: t.titel,
        uitleg: t.uitleg,
        vragen: t.vragen,
        status: alBehandeld ? 'overgeslagen' : 'actief',
        ...(alBehandeld ? { alBehandeldIn: t.eerdereBron || lokaal?.bron || 'een eerdere opdracht' } : {}),
      });
    });

  const behoudenStappen = opdracht.stappen.filter((s) => heeftWerk(s) || s.commandos.trim() !== '');
  const stapTitels = new Set(behoudenStappen.map((s) => normaliseerOnderwerp(s.titel)));
  const nieuweStappen: Stap[] = plan.stappen
    .filter((s) => !stapTitels.has(normaliseerOnderwerp(s.titel)))
    .map((s) => nieuweStap({ titel: s.titel, aanwijzing: s.aanwijzing }));

  const behoudenTests = opdracht.resultaat.testcases.filter((t) => t.werkelijk.trim() || t.geslaagd);
  const testTitels = new Set(behoudenTests.map((t) => normaliseerOnderwerp(t.beschrijving)));
  const nieuweTests: Testcase[] = plan.testcases
    .filter((t) => !testTitels.has(normaliseerOnderwerp(t.beschrijving)))
    .map((t) => nieuweTestcase({ beschrijving: t.beschrijving, verwacht: t.verwacht }));

  return {
    ...opdracht,
    titel: opdracht.titel || plan.titel,
    samenvatting: plan.samenvatting,
    planGemaaktOp: new Date().toISOString(),
    theorie: [...behoudenTheorie, ...nieuweTheorie],
    stappen: [...behoudenStappen, ...nieuweStappen],
    resultaat: {
      ...opdracht.resultaat,
      testcases: [...behoudenTests, ...nieuweTests],
      reflectievragen: plan.reflectievragen.length
        ? plan.reflectievragen
        : opdracht.resultaat.reflectievragen,
    },
  };
}
