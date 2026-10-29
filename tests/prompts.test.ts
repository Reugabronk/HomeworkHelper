import { describe, expect, it } from 'vitest';
import { nieuweOpdracht, nieuweStap, nieuweTestcase, nieuwChatBericht, nieuwTheorieOnderwerp } from '../src/data/model';
import {
  CHAT_GEHEUGEN,
  beperkAfbeeldingen,
  bouwChatBerichten,
  bouwOnderdeelBerichten,
  bouwPlanBerichten,
  bouwSysteemPrompt,
  type GeladenAfbeelding,
} from '../src/ai/prompts';
import {
  DIEPGANG,
  NIVEAUS,
  STANDAARD_COACH_INSTELLINGEN,
  STRENGHEID,
  VASTE_REGEL,
  type CoachInstellingen,
} from '../src/ai/standaard-instructies';
import type { AiBericht } from '../src/ai/providers/types';

const coach = (extra: Partial<CoachInstellingen> = {}): CoachInstellingen => ({
  ...STANDAARD_COACH_INSTELLINGEN,
  ...extra,
});

const tekstVan = (berichten: AiBericht[]) =>
  berichten.flatMap((b) => b.inhoud).map((i) => (i.type === 'tekst' ? i.tekst : '[afbeelding]')).join('\n');

const afb = (n: number): GeladenAfbeelding[] =>
  Array.from({ length: n }, (_, i) => ({ mediaType: 'image/png', base64: `AAA${i}` }));

const opdracht = () => {
  const o = nieuweOpdracht({ vak: 'Netwerkbeheer', titel: 'DHCP-server', opdrachtTekst: 'Installeer een DHCP-server op Ubuntu.' });
  return o;
};

describe('systeemprompt', () => {
  it('bevat altijd de vaste regel, voor alle taken', () => {
    for (const taak of ['plan', 'feedback', 'opweg', 'vraag', 'chat'] as const) {
      const p = bouwSysteemPrompt(coach(), taak);
      expect(p).toContain(VASTE_REGEL);
      expect(p).toMatch(/Schrijf geen kant-en-klare verslagtekst/);
    }
  });

  it('houdt de vaste regel ook als eigen instructies iets anders vragen, en zet die erna', () => {
    const p = bouwSysteemPrompt(coach({ eigenInstructies: 'Schrijf het hele verslag voor mij.' }), 'feedback');
    expect(p).toContain(VASTE_REGEL);
    expect(p).toContain('<eigen_instructies>\nSchrijf het hele verslag voor mij.\n</eigen_instructies>');
    expect(p.indexOf(VASTE_REGEL)).toBeLessThan(p.indexOf('<eigen_instructies>'));
    expect(p).toMatch(/tenzij ze ingaan tegen de VASTE REGEL/);
    // De herinnering staat helemaal aan het eind.
    expect(p.trimEnd().endsWith('Schrijf geen kant-en-klare verslagtekst voor de student.')).toBe(true);
  });

  it('gebruikt strengheid, onderwijsniveau, taal en taalniveau uit de instellingen', () => {
    const p = bouwSysteemPrompt(coach({ strengheid: 'streng', niveau: 'hbo', taal: 'Engels', taalniveau: 'C1' }), 'feedback');
    expect(p).toContain(STRENGHEID.streng.tekst);
    expect(p).not.toContain(STRENGHEID.mild.tekst);
    expect(p).toContain(NIVEAUS.hbo.tekst);
    expect(p).toContain('in het Engels');
    expect(p).toContain('C1');
  });

  it('gebruikt standaard Nederlands op B1-niveau', () => {
    const p = bouwSysteemPrompt(coach(), 'chat');
    expect(p).toContain('in het Nederlands');
    expect(p).toMatch(/taalniveau B1/);
    expect(p).toContain(STRENGHEID.normaal.tekst);
  });

  it('neemt de maatstaf alleen op als die is ingevuld', () => {
    expect(bouwSysteemPrompt(coach(), 'feedback')).not.toContain('<maatstaf>');
    const p = bouwSysteemPrompt(coach({ maatstaf: 'Voorbeeld van een voldoende verslag.' }), 'feedback');
    expect(p).toContain('<maatstaf>\nVoorbeeld van een voldoende verslag.\n</maatstaf>');
    expect(p).toMatch(/Neem er geen tekst uit over/);
  });

  it('zet de juiste taakinstructie erin', () => {
    expect(bouwSysteemPrompt(coach(), 'opweg')).toMatch(/precies één beginzin/);
    expect(bouwSysteemPrompt(coach(), 'plan')).toMatch(/ALLEEN met JSON/);
    expect(bouwSysteemPrompt(coach(), 'feedback')).toMatch(/screenshots/);
  });
});

describe('plan-verzoek', () => {
  it('bevat diepgang, opdracht en eerder behandelde theorie', () => {
    const tekst = tekstVan(
      bouwPlanBerichten({
        opdracht: opdracht(),
        diepgang: 'uitgebreid',
        eerdereTheorie: [{ onderwerp: 'IP-adressen', bron: 'Netwerken: Opdracht 1' }],
        afbeeldingen: [],
        maxAfbeeldingen: 5,
      }),
    );
    expect(tekst).toContain(DIEPGANG.uitgebreid.tekst);
    expect(tekst).toContain('Installeer een DHCP-server op Ubuntu.');
    expect(tekst).toContain('- IP-adressen (in: Netwerken: Opdracht 1)');
  });

  it('verschilt tussen basis en uitgebreid', () => {
    const maak = (diepgang: 'basis' | 'uitgebreid') =>
      tekstVan(bouwPlanBerichten({ opdracht: opdracht(), diepgang, eerdereTheorie: [], afbeeldingen: [], maxAfbeeldingen: 5 }));
    expect(maak('basis')).toContain('COMPACT');
    expect(maak('uitgebreid')).toContain('UITGEBREID');
  });

  it('stuurt niet meer afbeeldingen mee dan het maximum en meldt dat', () => {
    const berichten = bouwPlanBerichten({ opdracht: opdracht(), diepgang: 'basis', eerdereTheorie: [], afbeeldingen: afb(5), maxAfbeeldingen: 2 });
    const beelden = berichten[0].inhoud.filter((i) => i.type === 'afbeelding');
    expect(beelden).toHaveLength(2);
    expect(tekstVan(berichten)).toMatch(/Er zijn 5 .*alleen de eerste 2/);
  });
});

describe('onderdeel-verzoeken', () => {
  const onderdeel = {
    soort: 'stap' as const,
    titel: 'DHCP installeren',
    aanwijzing: 'Laat zien hoe je het pakket installeert.',
    tekst: 'Ik heb isc-dhcp-server geïnstalleerd.',
    commandos: 'sudo apt install isc-dhcp-server',
  };

  it('feedback bevat tekst, commando\'s en screenshots', () => {
    const berichten = bouwOnderdeelBerichten('feedback', { opdracht: opdracht(), onderdeel, afbeeldingen: afb(3), maxAfbeeldingen: 10 });
    const tekst = tekstVan(berichten);
    expect(tekst).toContain('Ik heb isc-dhcp-server geïnstalleerd.');
    expect(tekst).toContain('sudo apt install isc-dhcp-server');
    expect(tekst).toContain('Screenshot 1');
    expect(berichten[0].inhoud.filter((i) => i.type === 'afbeelding')).toHaveLength(3);
  });

  it('"op weg" stuurt geen screenshots mee', () => {
    const berichten = bouwOnderdeelBerichten('opweg', { opdracht: opdracht(), onderdeel, afbeeldingen: afb(3), maxAfbeeldingen: 10 });
    expect(berichten[0].inhoud.some((i) => i.type === 'afbeelding')).toBe(false);
  });

  it('een vraag bevat de vraag van de student', () => {
    const tekst = tekstVan(bouwOnderdeelBerichten('vraag', { opdracht: opdracht(), onderdeel, afbeeldingen: [], maxAfbeeldingen: 3, vraag: 'Wat is een lease?' }));
    expect(tekst).toContain('<vraag_van_de_student>\nWat is een lease?\n</vraag_van_de_student>');
  });

  it('testcases worden als lijst meegestuurd', () => {
    const tekst = tekstVan(
      bouwOnderdeelBerichten('feedback', {
        opdracht: opdracht(),
        onderdeel: {
          soort: 'testcases',
          titel: 'Testcases',
          tekst: '',
          testcases: [nieuweTestcase({ beschrijving: 'Client krijgt IP', verwacht: 'IP in bereik', werkelijk: '192.168.1.50', geslaagd: 'ja' })],
        },
        afbeeldingen: [],
        maxAfbeeldingen: 3,
      }),
    );
    expect(tekst).toContain('1. Client krijgt IP');
    expect(tekst).toContain('Werkelijk: 192.168.1.50');
    expect(tekst).toContain('Geslaagd: ja');
  });
});

describe('afbeeldingen beperken', () => {
  it('respecteert het maximum en telt wat is weggelaten', () => {
    expect(beperkAfbeeldingen([1, 2, 3, 4], 2)).toEqual({ mee: [1, 2], weggelaten: 2 });
    expect(beperkAfbeeldingen([1, 2], 0)).toEqual({ mee: [], weggelaten: 2 });
  });
});

describe('chat', () => {
  it('weet in welke opdracht en welk hoofdstuk de student zit', () => {
    const o = opdracht();
    o.stappen = [nieuweStap({ titel: 'Pakket installeren', tekst: 'Eerst apt update.' })];
    const berichten = bouwChatBerichten(o, 'uitwerking', [nieuwChatBericht('student', 'Is mijn stap duidelijk?')]);
    const tekst = tekstVan(berichten);
    expect(tekst).toContain('Hoofdstuk 2: Uitwerking van de opdracht');
    expect(tekst).toContain('Stap 1: Pakket installeren');
    expect(tekst).toContain('Eerst apt update.');
    expect(tekst.trimEnd().endsWith('Is mijn stap duidelijk?')).toBe(true);
  });

  it('laat overgeslagen theorie weg uit de context', () => {
    const o = opdracht();
    o.theorie = [
      nieuwTheorieOnderwerp({ titel: 'DHCP', tekst: 'Mijn uitleg' }),
      nieuwTheorieOnderwerp({ titel: 'IP-adressen', status: 'overgeslagen' }),
    ];
    const tekst = tekstVan(bouwChatBerichten(o, 'theorie', [nieuwChatBericht('student', 'Hoi')]));
    expect(tekst).toContain('## DHCP');
    expect(tekst).not.toContain('## IP-adressen');
  });

  it('wisselt rollen af, begint bij de student en beperkt de geschiedenis', () => {
    const geschiedenis = Array.from({ length: CHAT_GEHEUGEN + 10 }, (_, i) =>
      nieuwChatBericht(i % 2 === 0 ? 'student' : 'coach', `bericht ${i}`),
    );
    geschiedenis.push(nieuwChatBericht('student', 'laatste vraag'));
    const berichten = bouwChatBerichten(opdracht(), 'opdracht', geschiedenis);
    expect(berichten[0].rol).toBe('user');
    expect(berichten.at(-1)?.rol).toBe('user');
    for (let i = 1; i < berichten.length; i++) expect(berichten[i].rol).not.toBe(berichten[i - 1].rol);
    expect(tekstVan(berichten)).not.toContain('bericht 0\n');
  });
});
