// Een opdracht exporteren naar Word: gegevens verzamelen en het sjabloon invullen.
import { haalAfbeeldingen, haalSjabloon } from '../data/db';
import type { Profiel } from '../data/settings';
import type { Opdracht } from '../data/types';
import type { ExportAfbeelding, ExportInhoud, ExportOpties } from './content';
import { maakStandaardSjabloon } from './default-template';
import { vulSjabloon, type Placeholder, type VulResultaat } from './template';

export function formatteerDatum(datum: Date): string {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(datum);
}

export function placeholderWaarden(opdracht: Opdracht, profiel: Profiel, datum = new Date()): Record<Placeholder, string> {
  return {
    TITEL: opdracht.titel.trim() || 'Verslag',
    VAK: opdracht.vak.trim(),
    NAAM: profiel.naam.trim(),
    KLAS: profiel.klas.trim(),
    SCHOOL: profiel.school.trim(),
    DATUM: formatteerDatum(datum),
  };
}

/** Zet een opdracht om naar de inhoud voor Word (alleen actieve theorie). */
export async function verzamelInhoud(opdracht: Opdracht, laad = haalAfbeeldingen): Promise<ExportInhoud> {
  const afb = async (ids: string[]): Promise<ExportAfbeelding[]> =>
    (await laad(ids)).map((a) => ({ data: a.data, mediaType: a.mediaType, breedte: a.breedte, hoogte: a.hoogte, bijschrift: a.bijschrift }));
  const r = opdracht.resultaat;
  return {
    theorie: await Promise.all(
      opdracht.theorie
        .filter((t) => t.status === 'actief')
        .map(async (t) => ({ titel: t.titel, tekst: t.tekst, afbeeldingen: await afb(t.afbeeldingen) })),
    ),
    stappen: await Promise.all(
      opdracht.stappen.map(async (s) => ({ titel: s.titel, tekst: s.tekst, commandos: s.commandos, afbeeldingen: await afb(s.afbeeldingen) })),
    ),
    eindresultaat: { tekst: r.eindresultaat.tekst, afbeeldingen: await afb(r.eindresultaat.afbeeldingen) },
    testcases: r.testcases.filter((t) => t.beschrijving.trim() || t.verwacht.trim() || t.werkelijk.trim()),
    reflectie: r.reflectie.tekst,
  };
}

export interface ExportKeuzes {
  opties: ExportOpties;
  /** true = het eigen sjabloon (als dat er is), false = standaardsjabloon. */
  eigenSjabloon: boolean;
}

export async function exporteerNaarWord(opdracht: Opdracht, profiel: Profiel, keuzes: ExportKeuzes): Promise<VulResultaat> {
  const eigen = keuzes.eigenSjabloon ? await haalSjabloon() : undefined;
  const sjabloon = eigen?.data ?? (await maakStandaardSjabloon());
  return vulSjabloon(sjabloon, {
    waarden: placeholderWaarden(opdracht, profiel),
    inhoud: await verzamelInhoud(opdracht),
    opties: keuzes.opties,
  });
}
