// Stappen (met screenshots) kopiëren uit een eerdere opdracht.
import { bewaarAfbeelding, haalAfbeeldingen } from './db';
import { nieuweStap, nieuwId, nu } from './model';
import type { Stap } from './types';

/** Maakt kopieën van afbeeldingen (nieuwe id's), zodat de opdrachten los van elkaar staan. */
export async function kopieerAfbeeldingen(ids: string[]): Promise<string[]> {
  const origineel = await haalAfbeeldingen(ids);
  const nieuweIds: string[] = [];
  for (const a of origineel) {
    const kopie = { ...a, id: nieuwId(), data: a.data.slice(0), aangemaakt: nu() };
    await bewaarAfbeelding(kopie);
    nieuweIds.push(kopie.id);
  }
  return nieuweIds;
}

export async function kopieerStappen(stappen: Stap[], metAfbeeldingen: boolean): Promise<Stap[]> {
  const kopieen: Stap[] = [];
  for (const s of stappen) {
    kopieen.push(
      nieuweStap({
        titel: s.titel,
        aanwijzing: s.aanwijzing,
        tekst: s.tekst,
        commandos: s.commandos,
        afbeeldingen: metAfbeeldingen ? await kopieerAfbeeldingen(s.afbeeldingen) : [],
      }),
    );
  }
  return kopieen;
}
