// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bouwBackup, leesBackup, maakBackupBestand, zetBackupTerug } from '../src/data/backup';
import {
  alleOpdrachten,
  bewaarAfbeelding,
  bewaarOpdracht,
  bewaarSjabloon,
  haalAfbeeldingen,
  haalOpdracht,
  leesAlles,
  verwijderOpdracht,
  wisAlles,
} from '../src/data/db';
import { nieuweOpdracht, nieuweStap } from '../src/data/model';
import {
  API_SLEUTELS_SLEUTEL,
  STANDAARD_INSTELLINGEN,
  bewaarInstellingen,
  bewaarSleutel,
  laadInstellingen,
  laadSleutels,
  normaliseerInstellingen,
} from '../src/data/settings';
import type { Afbeelding } from '../src/data/types';
import { schaal } from '../src/images/resize';

function afbeelding(id: string): Afbeelding {
  return {
    id,
    mediaType: 'image/png',
    breedte: 2,
    hoogte: 2,
    data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]).buffer,
    bijschrift: '',
    aangemaakt: new Date().toISOString(),
  };
}

beforeEach(async () => {
  localStorage.clear();
  await wisAlles();
});
afterEach(async () => {
  await wisAlles();
});

describe('IndexedDB-opslag', () => {
  it('bewaart en leest een opdracht', async () => {
    const o = nieuweOpdracht({ vak: 'Netwerken', titel: 'VLAN instellen' });
    await bewaarOpdracht(o);
    const terug = await haalOpdracht(o.id);
    expect(terug?.titel).toBe('VLAN instellen');
    expect(await alleOpdrachten()).toHaveLength(1);
  });

  it('verwijdert bij een opdracht alleen afbeeldingen die nergens anders gebruikt worden', async () => {
    await bewaarAfbeelding(afbeelding('a1'));
    await bewaarAfbeelding(afbeelding('gedeeld'));
    const o1 = nieuweOpdracht({ vak: 'X', titel: 'Een' });
    o1.stappen = [nieuweStap({ afbeeldingen: ['a1', 'gedeeld'] })];
    const o2 = nieuweOpdracht({ vak: 'X', titel: 'Twee' });
    o2.opdrachtAfbeeldingen = ['gedeeld'];
    await bewaarOpdracht(o1);
    await bewaarOpdracht(o2);
    await verwijderOpdracht(o1.id);
    const over = await haalAfbeeldingen(['a1', 'gedeeld']);
    expect(over.map((a) => a.id)).toEqual(['gedeeld']);
  });
});

describe('instellingen en API-sleutel', () => {
  it('vult ontbrekende of kapotte instellingen aan met standaardwaarden', () => {
    const s = normaliseerInstellingen({ coach: { strengheid: 'extreem' }, ai: { maxAfbeeldingen: 500 } });
    expect(s.coach.strengheid).toBe('normaal');
    expect(s.coach.taal).toBe('Nederlands');
    expect(s.coach.taalniveau).toBe('B1');
    expect(s.ai.maxAfbeeldingen).toBe(20);
  });

  it('bewaart de sleutel apart van de instellingen', () => {
    bewaarInstellingen({ ...STANDAARD_INSTELLINGEN, profiel: { naam: 'Sam', klas: '2B', school: 'ROC' } });
    bewaarSleutel('anthropic', '  sk-ant-geheim-123456  ');
    expect(laadSleutels().anthropic).toBe('sk-ant-geheim-123456');
    expect(laadInstellingen().profiel.naam).toBe('Sam');
    expect(localStorage.getItem('verslagcoach.instellingen')).not.toContain('sk-ant');
    bewaarSleutel('anthropic', '');
    expect(localStorage.getItem(API_SLEUTELS_SLEUTEL)).toBeNull();
  });
});

describe('back-up', () => {
  it('bevat nooit de API-sleutel', async () => {
    bewaarSleutel('anthropic', 'sk-ant-zeer-geheim-999');
    await bewaarOpdracht(nieuweOpdracht({ vak: 'X', titel: 'T' }));
    const blob = await maakBackupBestand(laadInstellingen());
    const tekst = await blob.text();
    expect(tekst).not.toContain('sk-ant-zeer-geheim-999');
    expect(tekst).not.toContain(API_SLEUTELS_SLEUTEL);
  });

  it('zet opdrachten, afbeeldingen en sjabloon volledig terug', async () => {
    const o = nieuweOpdracht({ vak: 'Linux', titel: 'Webserver' });
    o.opdrachtAfbeeldingen = ['img1'];
    await bewaarOpdracht(o);
    await bewaarAfbeelding(afbeelding('img1'));
    await bewaarSjabloon({ naam: 'school.dotx', data: new Uint8Array([1, 2, 3]).buffer, geupload: 'nu' });
    const backup = JSON.stringify(bouwBackup(await leesAlles(), STANDAARD_INSTELLINGEN));

    await wisAlles();
    expect(await alleOpdrachten()).toHaveLength(0);

    await zetBackupTerug(backup, true);
    const alles = await leesAlles();
    expect(alles.opdrachten[0].titel).toBe('Webserver');
    expect(new Uint8Array(alles.afbeeldingen[0].data)).toEqual(
      new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
    );
    expect(alles.sjabloon?.naam).toBe('school.dotx');
  });

  it('weigert een bestand dat geen back-up is', () => {
    expect(() => leesBackup('{"hallo":1}')).toThrow(/geen back-up/);
    expect(() => leesBackup('geen json')).toThrow(/geen geldige/);
  });
});

describe('afbeeldingen verkleinen', () => {
  it('schaalt met behoud van verhouding tot de maximale zijde', () => {
    expect(schaal(3200, 1800)).toEqual({ breedte: 1600, hoogte: 900 });
    expect(schaal(800, 600)).toEqual({ breedte: 800, hoogte: 600 });
    expect(schaal(1000, 4000, 1000)).toEqual({ breedte: 250, hoogte: 1000 });
  });
});
