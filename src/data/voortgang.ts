// Berekent hoe ver een verslag is (alleen voor het overzicht).
import type { Opdracht } from './types';

export interface Voortgang {
  klaar: number;
  totaal: number;
  procent: number;
}

export function berekenVoortgang(o: Opdracht): Voortgang {
  const gevuld = (t: string) => t.trim().length >= 20;
  const onderdelen = [
    ...o.theorie.filter((t) => t.status === 'actief').map((t) => gevuld(t.tekst)),
    ...o.stappen.map((s) => gevuld(s.tekst)),
    gevuld(o.resultaat.eindresultaat.tekst),
    o.resultaat.testcases.length > 0 && o.resultaat.testcases.every((t) => t.werkelijk.trim() && t.geslaagd),
    gevuld(o.resultaat.reflectie.tekst),
  ];
  const klaar = onderdelen.filter(Boolean).length;
  const totaal = onderdelen.length;
  return { klaar, totaal, procent: totaal ? Math.round((klaar / totaal) * 100) : 0 };
}
