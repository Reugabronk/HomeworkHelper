import { describe, expect, it } from 'vitest';
import { PLAN_SCHEMA, haalJsonUitTekst, leesPlan, pasPlanToe, zoekBekend } from '../src/ai/plan';
import { nieuweOpdracht, nieuweStap, nieuwTheorieOnderwerp } from '../src/data/model';

const planJson = {
  titel: 'Verslag DHCP',
  samenvatting: 'Je installeert een DHCP-server.',
  theorie: [
    { titel: 'DHCP', uitleg: 'DHCP deelt adressen uit.', vragen: ['Wat doet DHCP?'], alBehandeld: false, eerdereBron: '' },
    { titel: 'IP-adressen', uitleg: '...', vragen: [], alBehandeld: true, eerdereBron: 'Opdracht 1' },
    { titel: 'Subnetmasker', uitleg: '...', vragen: [], alBehandeld: false, eerdereBron: '' },
  ],
  stappen: [{ titel: 'Pakket installeren', aanwijzing: 'Laat apt install zien.' }],
  testcases: [{ beschrijving: 'Client krijgt adres', verwacht: 'Adres in bereik' }],
  reflectievragen: ['Wat ging goed?'],
};

describe('plan lezen', () => {
  it('leest JSON, ook met tekst en codeblok eromheen', () => {
    const plan = leesPlan(`Hier is het plan:\n\`\`\`json\n${JSON.stringify(planJson)}\n\`\`\``);
    expect(plan.theorie).toHaveLength(3);
    expect(plan.stappen[0].titel).toBe('Pakket installeren');
  });

  it('gooit een duidelijke fout bij onleesbare antwoorden', () => {
    expect(() => haalJsonUitTekst('geen json')).toThrow(/geen plan/);
    expect(() => leesPlan('{"theorie": [], "stappen": []}')).toThrow(/leeg/);
  });

  it('heeft een schema met gesloten objecten en verplichte velden', () => {
    const s = PLAN_SCHEMA as { additionalProperties: boolean; required: string[] };
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['titel', 'samenvatting', 'theorie', 'stappen', 'testcases', 'reflectievragen']);
  });
});

describe('plan toepassen', () => {
  it('slaat eerder behandelde theorie standaard over (AI-markering en eigen herkenning)', () => {
    const o = pasPlanToe(nieuweOpdracht({ vak: 'Netwerken', titel: '' }), leesPlan(JSON.stringify(planJson)), [
      { onderwerp: 'Subnetmaskers', bron: 'oud-verslag.docx' },
    ]);
    const status = Object.fromEntries(o.theorie.map((t) => [t.titel, [t.status, t.alBehandeldIn]]));
    expect(status['DHCP']).toEqual(['actief', undefined]);
    expect(status['IP-adressen']).toEqual(['overgeslagen', 'Opdracht 1']);
    expect(status['Subnetmasker']).toEqual(['overgeslagen', 'oud-verslag.docx']);
    expect(o.titel).toBe('Verslag DHCP');
    expect(o.resultaat.testcases[0].verwacht).toBe('Adres in bereik');
    expect(o.resultaat.reflectievragen).toEqual(['Wat ging goed?']);
  });

  it('behoudt onderdelen waar de student al aan werkte', () => {
    const o = nieuweOpdracht({ vak: 'X', titel: 'Eigen titel' });
    o.theorie = [nieuwTheorieOnderwerp({ titel: 'DHCP', tekst: 'Mijn eigen tekst' }), nieuwTheorieOnderwerp({ titel: 'Leeg' })];
    o.stappen = [nieuweStap({ titel: 'Oude stap', commandos: 'ls' })];
    const nieuw = pasPlanToe(o, leesPlan(JSON.stringify(planJson)), []);
    expect(nieuw.titel).toBe('Eigen titel');
    expect(nieuw.theorie.filter((t) => t.titel === 'DHCP')).toHaveLength(1);
    expect(nieuw.theorie.find((t) => t.titel === 'DHCP')?.tekst).toBe('Mijn eigen tekst');
    expect(nieuw.theorie.some((t) => t.titel === 'Leeg')).toBe(false);
    expect(nieuw.stappen.map((s) => s.titel)).toEqual(['Oude stap', 'Pakket installeren']);
  });

  it('herkent onderwerpen ongeacht hoofdletters en leestekens', () => {
    expect(zoekBekend('IP-adressen', [{ onderwerp: 'ip adressen', bron: 'x' }])?.bron).toBe('x');
    expect(zoekBekend('DNS', [{ onderwerp: 'DHCP', bron: 'x' }])).toBeUndefined();
  });
});
