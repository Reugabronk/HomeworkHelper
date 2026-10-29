// Back-up van alle gegevens als één JSON-bestand. API-sleutels gaan er NOOIT in mee.
import { naarBase64, vanBase64 } from './base64';
import { leesAlles, schrijfAlles, type DatabaseInhoud } from './db';
import { normaliseerInstellingen, type Instellingen } from './settings';
import type { Afbeelding, EerdereTheorie, Opdracht } from './types';

export const BACKUP_FORMAAT = 1;

interface BackupAfbeelding extends Omit<Afbeelding, 'data'> {
  data: string; // base64
}

export interface Backup {
  app: 'verslagcoach';
  formaat: number;
  gemaakt: string;
  instellingen: Instellingen;
  opdrachten: Opdracht[];
  afbeeldingen: BackupAfbeelding[];
  eerdereTheorie: EerdereTheorie[];
  sjabloon?: { naam: string; geupload: string; data: string };
}

/** Bouwt het back-upobject. De instellingen bevatten geen sleutels (die staan apart). */
export function bouwBackup(inhoud: DatabaseInhoud, instellingen: Instellingen): Backup {
  return {
    app: 'verslagcoach',
    formaat: BACKUP_FORMAAT,
    gemaakt: new Date().toISOString(),
    instellingen: normaliseerInstellingen(instellingen),
    opdrachten: inhoud.opdrachten,
    afbeeldingen: inhoud.afbeeldingen.map((a) => ({ ...a, data: naarBase64(a.data) })),
    eerdereTheorie: inhoud.eerdereTheorie,
    ...(inhoud.sjabloon
      ? {
          sjabloon: {
            naam: inhoud.sjabloon.naam,
            geupload: inhoud.sjabloon.geupload,
            data: naarBase64(inhoud.sjabloon.data),
          },
        }
      : {}),
  };
}

export async function maakBackupBestand(instellingen: Instellingen): Promise<Blob> {
  const backup = bouwBackup(await leesAlles(), instellingen);
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export class BackupFout extends Error {}

/** Controleert een ingelezen back-up en zet hem om naar database-inhoud. */
export function leesBackup(tekst: string): { inhoud: DatabaseInhoud; instellingen: Instellingen } {
  let ruw: unknown;
  try {
    ruw = JSON.parse(tekst);
  } catch {
    throw new BackupFout('Dit bestand is geen geldige back-up (geen JSON).');
  }
  const b = ruw as Partial<Backup>;
  if (!b || b.app !== 'verslagcoach') {
    throw new BackupFout('Dit bestand is geen back-up van Verslagcoach.');
  }
  if (typeof b.formaat !== 'number' || b.formaat > BACKUP_FORMAAT) {
    throw new BackupFout('Deze back-up is gemaakt met een nieuwere versie van Verslagcoach.');
  }
  if (!Array.isArray(b.opdrachten) || !Array.isArray(b.afbeeldingen)) {
    throw new BackupFout('De back-up is onvolledig of beschadigd.');
  }
  const afbeeldingen: Afbeelding[] = b.afbeeldingen.map((a) => ({
    ...a,
    bijschrift: a.bijschrift ?? '',
    data: vanBase64(a.data),
  }));
  return {
    inhoud: {
      opdrachten: b.opdrachten,
      afbeeldingen,
      eerdereTheorie: Array.isArray(b.eerdereTheorie) ? b.eerdereTheorie : [],
      ...(b.sjabloon
        ? {
            sjabloon: {
              naam: b.sjabloon.naam,
              geupload: b.sjabloon.geupload,
              data: vanBase64(b.sjabloon.data),
            },
          }
        : {}),
    },
    instellingen: normaliseerInstellingen(b.instellingen),
  };
}

/**
 * Zet een back-up terug. Bij `vervangen` worden de huidige gegevens eerst gewist;
 * anders worden opdrachten met hetzelfde id overschreven en de rest aangevuld.
 */
export async function zetBackupTerug(tekst: string, vervangen: boolean): Promise<Instellingen> {
  const { inhoud, instellingen } = leesBackup(tekst);
  await schrijfAlles(inhoud, vervangen);
  return instellingen;
}
