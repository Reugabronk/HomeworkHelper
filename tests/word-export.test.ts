// @vitest-environment jsdom
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { afbeeldingMaat, codeBlok, type ExportInhoud } from '../src/docx/content';
import { maakStandaardSjabloon } from '../src/docx/default-template';
import { placeholderWaarden, verzamelInhoud } from '../src/docx/export';
import { leesWordAlineas, vindTheorieOnderwerpen, wordNaarTekst } from '../src/docx/import';
import { analyseerSjabloon, vervangPlaceholders, vulSjabloon } from '../src/docx/template';
import { NS, alineaTekst, parseXml, wAlle, wAttr, wKind } from '../src/docx/xml';
import { nieuweOpdracht, nieuweStap, nieuweTestcase, nieuwTheorieOnderwerp } from '../src/data/model';
import { STANDAARD_INSTELLINGEN } from '../src/data/settings';
import type { Afbeelding } from '../src/data/types';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

const waarden = { TITEL: 'DHCP-server', VAK: 'Netwerkbeheer', NAAM: 'Sam de Vries', KLAS: 'ICT-2B', SCHOOL: 'ROC Utrecht', DATUM: '29 oktober 2026' };

const inhoud = (): ExportInhoud => ({
  theorie: [
    { titel: 'DHCP', tekst: 'DHCP deelt adressen uit.\n\nEen tweede alinea.\n\n- punt een\n- punt twee', afbeeldingen: [{ data: PNG, mediaType: 'image/png', breedte: 1600, hoogte: 900, bijschrift: 'Schema van DHCP' }] },
    { titel: 'Lease', tekst: 'Een lease is tijdelijk.', afbeeldingen: [] },
  ],
  stappen: [
    { titel: 'Installeren', tekst: 'Ik installeer het pakket omdat het nodig is.', commandos: 'sudo apt update\nsudo apt install isc-dhcp-server\n\tcat /etc/dhcp/dhcpd.conf', afbeeldingen: [{ data: PNG, mediaType: 'image/png', breedte: 800, hoogte: 600, bijschrift: '' }] },
  ],
  eindresultaat: { tekst: 'De server werkt.', afbeeldingen: [] },
  testcases: [
    nieuweTestcase({ beschrijving: 'Client krijgt IP', verwacht: 'IP uit de scope', werkelijk: '192.168.1.50', geslaagd: 'ja' }),
    nieuweTestcase({ beschrijving: 'Tweede client', verwacht: 'Ander IP', werkelijk: 'Zelfde IP', geslaagd: 'nee' }),
  ],
  reflectie: 'Het ging goed. Volgende keer test ik eerder.',
});

async function open(data: Uint8Array) {
  const zip = await JSZip.loadAsync(data);
  const lees = async (pad: string) => parseXml((await zip.file(pad)!.async('string')));
  return { zip, lees, doc: await lees('word/document.xml') };
}

function stijlVan(p: Element): string | null {
  const pPr = wKind(p, 'pPr');
  return pPr ? wAttr(wKind(pPr, 'pStyle'), 'val') : null;
}

/** Maakt een minimaal sjabloon met eigen document.xml en optioneel styles.xml. */
async function maakSjabloon(documentBody: string, opties: { styles?: string; dotx?: boolean; header?: string } = {}) {
  const zip = new JSZip();
  const docType = opties.dotx
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="${NS.ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="${docType}"/>${opties.styles ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' : ''}<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${opties.header ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}</Types>`,
  );
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${opties.styles ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' : ''}${opties.header ? '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : ''}</Relationships>`,
  );
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${NS.w}"><w:body>${documentBody}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
  zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8"?><w:settings xmlns:w="${NS.w}"><w:zoom w:percent="100"/><w:compat/><w:rsids/></w:settings>`);
  if (opties.styles) zip.file('word/styles.xml', opties.styles);
  if (opties.header) zip.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8"?><w:hdr xmlns:w="${NS.w}">${opties.header}</w:hdr>`);
  return zip.generateAsync({ type: 'uint8array' });
}

describe('Word-export met het standaardsjabloon', () => {
  it('maakt een geldig document: sjabloon -> docx, placeholders ingevuld, geen restanten', async () => {
    const { data, waarschuwingen } = await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud() });
    expect(waarschuwingen).toEqual([]);
    const { zip, doc, lees } = await open(data);
    const ct = await zip.file('[Content_Types].xml')!.async('string');
    expect(ct).toContain('wordprocessingml.document.main+xml');
    expect(ct).not.toContain('template.main+xml');
    const tekst = wAlle(doc, 'p').map(alineaTekst).join('\n');
    expect(tekst).not.toContain('{{');
    for (const w of Object.values(waarden)) expect(tekst).toContain(w);
    // Kop- en voettekst
    const header = wAlle(await lees('word/header1.xml'), 'p').map(alineaTekst).join('');
    expect(header).toBe('Sam de Vries – ICT-2B\t\tDHCP-server');
    expect(wAlle(await lees('word/footer1.xml'), 'p').map(alineaTekst).join('')).toContain('ROC Utrecht');
    // Documenteigenschappen
    const core = await zip.file('docProps/core.xml')!.async('string');
    expect(core).toContain('<dc:title>DHCP-server</dc:title>');
    expect(core).toContain('<dc:creator>Sam de Vries</dc:creator>');
    // Alle XML-delen zijn geldig
    for (const pad of Object.keys(zip.files).filter((p) => p.endsWith('.xml') || p.endsWith('.rels'))) {
      parseXml(await zip.file(pad)!.async('string'));
    }
  });

  it('zet Kop 1 voor de hoofdstukken en Kop 2 voor de onderdelen, met nummering', async () => {
    const { doc } = await open((await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud() })).data);
    const alineas = wAlle(doc, 'p');
    const kop1 = alineas.filter((p) => stijlVan(p) === 'Heading1').map(alineaTekst);
    const kop2 = alineas.filter((p) => stijlVan(p) === 'Heading2').map(alineaTekst);
    expect(kop1).toEqual(['1 Theorie', '2 Uitwerking van de opdracht', '3 Resultaat van de opdracht']);
    expect(kop2).toEqual(['1.1 DHCP', '1.2 Lease', '2.1 Installeren', '3.1 Eindresultaat', '3.2 Testcases', '3.3 Reflectie']);
    // Elk hoofdstuk op een nieuwe pagina
    for (const p of alineas.filter((p) => stijlVan(p) === 'Heading1')) expect(wKind(wKind(p, 'pPr')!, 'pageBreakBefore')).not.toBeNull();
  });

  it('kan koppen zonder nummering maken', async () => {
    const { doc } = await open((await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud(), opties: { nummering: false } })).data);
    const kop1 = wAlle(doc, 'p').filter((p) => stijlVan(p) === 'Heading1').map(alineaTekst);
    expect(kop1[0]).toBe('Theorie');
  });

  it('voegt een inhoudsopgave (TOC-veld) toe en zet updateFields aan', async () => {
    const { doc, lees } = await open((await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud() })).data);
    const instr = wAlle(doc, 'instrText').map((i) => i.textContent);
    expect(instr).toContain(' TOC \\o "1-3" \\h \\z \\u ');
    expect(wAlle(doc, 'fldChar').map((f) => wAttr(f, 'fldCharType'))).toEqual(expect.arrayContaining(['begin', 'separate', 'end']));
    const settings = await lees('word/settings.xml');
    const uf = wKind(settings.documentElement, 'updateFields');
    expect(wAttr(uf, 'val')).toBe('true');
    // De inhoudsopgave staat vóór het eerste hoofdstuk
    const teksten = wAlle(doc, 'p').map(alineaTekst);
    expect(teksten.indexOf('Inhoudsopgave')).toBeLessThan(teksten.indexOf('1 Theorie'));
  });

  it('plaatst screenshots als afbeelding met relatie, contenttype en figuurbijschrift', async () => {
    const { zip, doc, lees } = await open((await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud() })).data);
    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    expect(media).toHaveLength(2);
    expect(new Uint8Array(await zip.file(media[0])!.async('uint8array'))).toEqual(PNG);
    const rels = await lees('word/_rels/document.xml.rels');
    const relIds = Array.from(rels.getElementsByTagNameNS(NS.rel, 'Relationship'))
      .filter((r) => r.getAttribute('Type')?.endsWith('/image'))
      .map((r) => r.getAttribute('Id'));
    const blips = Array.from(doc.getElementsByTagNameNS(NS.a, 'blip')).map((b) => b.getAttributeNS(NS.r, 'embed'));
    expect(blips).toEqual(relIds);
    expect(await zip.file('[Content_Types].xml')!.async('string')).toMatch(/Extension="png" ContentType="image\/png"/);
    // Unieke tekening-id's
    const ids = Array.from(doc.getElementsByTagNameNS(NS.wp, 'docPr')).map((d) => d.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);
    // Bijschriften met SEQ-veld
    const tekst = wAlle(doc, 'p').map(alineaTekst);
    expect(tekst).toContain('Figuur 1: Schema van DHCP');
    expect(tekst).toContain('Figuur 2');
    expect(wAlle(doc, 'fldSimple').map((f) => wAttr(f, 'instr'))).toContain(' SEQ Figuur \\* ARABIC ');
    // Breed screenshot wordt geschaald naar de tekstbreedte (A4 met 2,54 cm marges)
    const extent = doc.getElementsByTagNameNS(NS.wp, 'extent')[0];
    expect(Number(extent.getAttribute('cx'))).toBe((11906 - 2880) * 635);
  });

  it('zet commando\'s in een grijs codeblok met vaste breedte', async () => {
    const { doc } = await open((await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud() })).data);
    const codeAlineas = wAlle(doc, 'p').filter((p) => {
      const shd = wKind(wKind(p, 'pPr') ?? p, 'shd');
      return shd && wAttr(shd, 'fill') === 'F2F2F2';
    });
    expect(codeAlineas.map(alineaTekst)).toEqual(['sudo apt update', 'sudo apt install isc-dhcp-server', '\tcat /etc/dhcp/dhcpd.conf']);
    const fonts = wAlle(codeAlineas[0], 'rFonts');
    expect(wAttr(fonts[0], 'ascii')).toBe('Consolas');
    expect(codeBlok('   ')).toBe('');
  });

  it('zet de testcases in een tabel met kopregel (verwacht/werkelijk/geslaagd)', async () => {
    const { doc } = await open((await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud() })).data);
    const tabellen = wAlle(doc, 'tbl');
    expect(tabellen).toHaveLength(1);
    const rijen = wAlle(tabellen[0], 'tr');
    expect(rijen).toHaveLength(3);
    const cellen = (tr: Element) => wAlle(tr, 'tc').map((tc) => wAlle(tc, 'p').map(alineaTekst).join('\n'));
    expect(cellen(rijen[0])).toEqual(['Nr.', 'Testcase', 'Verwacht resultaat', 'Werkelijk resultaat', 'Geslaagd']);
    expect(cellen(rijen[1])).toEqual(['1', 'Client krijgt IP', 'IP uit de scope', '192.168.1.50', 'Ja']);
    expect(cellen(rijen[2])[4]).toBe('Nee');
    expect(wKind(wKind(rijen[0], 'trPr')!, 'tblHeader')).not.toBeNull();
    expect(wAlle(tabellen[0], 'gridCol')).toHaveLength(5);
  });

  it('maakt alinea\'s en opsommingstekens van de tekst van de student', async () => {
    const { doc } = await open((await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud() })).data);
    const teksten = wAlle(doc, 'p').map(alineaTekst);
    expect(teksten).toContain('DHCP deelt adressen uit.');
    expect(teksten).toContain('Een tweede alinea.');
    expect(teksten).toContain('•\tpunt een');
  });
});

describe('Word-export met een eigen sjabloon', () => {
  const nederlandseStijlen = `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${NS.w}"><w:style w:type="paragraph" w:default="1" w:styleId="Standaard"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Kop1"><w:name w:val="heading 1"/><w:basedOn w:val="Standaard"/></w:style><w:style w:type="paragraph" w:styleId="Kop2"><w:name w:val="heading 2"/></w:style></w:styles>`;

  it('vervangt placeholders die Word over meerdere runs heeft verdeeld (ook in de koptekst)', async () => {
    const body =
      `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{{TI</w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:t>TEL</w:t></w:r><w:r><w:t xml:space="preserve">}} door {{NAAM}}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>Klas: {{ KLAS }} – {{DOCENT}}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>{{INHOUD}}</w:t></w:r></w:p>`;
    const sjabloon = await maakSjabloon(body, { styles: nederlandseStijlen, dotx: true, header: '<w:p><w:r><w:t>{{NA</w:t></w:r><w:r><w:t>AM}}</w:t></w:r></w:p>' });
    const { data, waarschuwingen } = await vulSjabloon(sjabloon, { waarden, inhoud: inhoud() });
    const { doc, zip, lees } = await open(data);
    const teksten = wAlle(doc, 'p').map(alineaTekst);
    expect(teksten[0]).toBe('DHCP-server door Sam de Vries');
    expect(teksten[1]).toBe('Klas: ICT-2B – {{DOCENT}}');
    expect(waarschuwingen.join(' ')).toContain('{{DOCENT}}');
    // De eerste run behoudt zijn opmaak (vet)
    expect(wAlle(wAlle(doc, 'p')[0], 'b')).toHaveLength(1);
    expect(wAlle(await lees('word/header1.xml'), 'p').map(alineaTekst)).toEqual(['Sam de Vries']);
    // .dotx is omgezet naar document
    expect(await zip.file('[Content_Types].xml')!.async('string')).not.toContain('template.main+xml');
  });

  it('gebruikt de Nederlandse stijl-id\'s (Kop1/Kop2) uit het sjabloon', async () => {
    const sjabloon = await maakSjabloon('<w:p><w:r><w:t>{{INHOUD}}</w:t></w:r></w:p>', { styles: nederlandseStijlen });
    const { doc, lees } = await open((await vulSjabloon(sjabloon, { waarden, inhoud: inhoud() })).data);
    const stijlen = wAlle(doc, 'p').map(stijlVan);
    expect(stijlen.filter((s) => s === 'Kop1')).toHaveLength(3);
    expect(stijlen.filter((s) => s === 'Kop2')).toHaveLength(6);
    expect(stijlen).not.toContain('Heading1');
    // Bijschriftstijl ontbrak en is toegevoegd, gebaseerd op de standaardstijl van het sjabloon
    const styles = await lees('word/styles.xml');
    const caption = wAlle(styles, 'style').find((s) => wAttr(wKind(s, 'name'), 'val') === 'caption')!;
    expect(wAttr(wKind(caption, 'basedOn'), 'val')).toBe('Standaard');
  });

  it('voegt Kop-stijlen toe als het sjabloon geen stijlen heeft, en zet de inhoud aan het eind', async () => {
    const sjabloon = await maakSjabloon('<w:p><w:r><w:t>Voorblad {{TITEL}}</w:t></w:r></w:p>');
    const { data, waarschuwingen } = await vulSjabloon(sjabloon, { waarden, inhoud: inhoud() });
    const { doc, zip, lees } = await open(data);
    expect(waarschuwingen.join(' ')).toContain('{{INHOUD}}');
    const styles = await lees('word/styles.xml');
    const namen = wAlle(styles, 'style').map((s) => wAttr(wKind(s, 'name'), 'val'));
    expect(namen).toEqual(expect.arrayContaining(['heading 1', 'heading 2', 'caption']));
    const kop1 = wAlle(styles, 'style').find((s) => wAttr(s, 'styleId') === 'Heading1')!;
    expect(wAttr(wKind(wKind(kop1, 'pPr')!, 'outlineLvl'), 'val')).toBe('0');
    // styles.xml is gekoppeld en geregistreerd
    expect(await zip.file('word/_rels/document.xml.rels')!.async('string')).toContain('Target="styles.xml"');
    expect(await zip.file('[Content_Types].xml')!.async('string')).toContain('/word/styles.xml');
    // Volgorde: voorblad, inhoudsopgave, hoofdstukken, en sectPr blijft het laatste element
    const teksten = wAlle(doc, 'p').map(alineaTekst);
    expect(teksten[0]).toBe('Voorblad DHCP-server');
    expect(teksten.indexOf('Inhoudsopgave')).toBeGreaterThan(0);
    const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
    expect(body.lastElementChild?.localName).toBe('sectPr');
    // updateFields staat vóór compat (volgorde volgens het schema)
    const settings = (await lees('word/settings.xml')).documentElement;
    const namenSettings = Array.from(settings.children).map((c) => c.localName);
    expect(namenSettings.indexOf('updateFields')).toBeLessThan(namenSettings.indexOf('compat'));
  });

  it('zet geen extra pagina-einde als het sjabloon er al een heeft vóór {{INHOUD}}', async () => {
    const sjabloon = await maakSjabloon(
      '<w:p><w:r><w:t>Voorblad</w:t></w:r><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>{{INHOUDSOPGAVE}}</w:t></w:r></w:p><w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>{{INHOUD}}</w:t></w:r></w:p>',
    );
    const { doc } = await open((await vulSjabloon(sjabloon, { waarden, inhoud: inhoud() })).data);
    const alineas = wAlle(doc, 'p');
    const heeftEinde = (tekst: string) => {
      const p = alineas.find((a) => alineaTekst(a) === tekst)!;
      return Boolean(wKind(wKind(p, 'pPr')!, 'pageBreakBefore'));
    };
    expect(heeftEinde('Inhoudsopgave')).toBe(false);
    expect(heeftEinde('1 Theorie')).toBe(false);
    expect(heeftEinde('2 Uitwerking van de opdracht')).toBe(true);
  });

  it('herkent placeholders bij het uploaden van een sjabloon', async () => {
    const analyse = await analyseerSjabloon(await maakStandaardSjabloon());
    expect(analyse.isSjabloon).toBe(true);
    expect(analyse.heeftInhoud).toBe(true);
    expect(analyse.heeftInhoudsopgave).toBe(true);
    expect(analyse.placeholders).toEqual(expect.arrayContaining(['TITEL', 'NAAM', 'KLAS', 'SCHOOL', 'DATUM', 'VAK']));
    expect(analyse.onbekend).toEqual([]);
    await expect(analyseerSjabloon(new Uint8Array([1, 2, 3]))).rejects.toThrow(/geen geldig Word-bestand/);
  });

  it('laat tekst zonder placeholders met rust', () => {
    const doc = parseXml(`<w:document xmlns:w="${NS.w}"><w:body><w:p><w:r><w:t>Geen {accolades} hier</w:t></w:r></w:p></w:body></w:document>`);
    expect(vervangPlaceholders(doc, waarden).vervangen).toBe(0);
    expect(alineaTekst(wAlle(doc, 'p')[0])).toBe('Geen {accolades} hier');
  });
});

describe('opdracht naar Word-inhoud', () => {
  it('neemt alleen actieve theorie mee en vult de voorbladgegevens', async () => {
    const o = nieuweOpdracht({ vak: 'Netwerken', titel: 'DHCP' });
    o.theorie = [nieuwTheorieOnderwerp({ titel: 'Nieuw', tekst: 'x', afbeeldingen: ['a1'] }), nieuwTheorieOnderwerp({ titel: 'Oud', status: 'overgeslagen' })];
    o.stappen = [nieuweStap({ titel: 'Stap', commandos: 'ls' })];
    o.resultaat.testcases = [nieuweTestcase({ beschrijving: 'Test' }), nieuweTestcase()];
    const afb: Afbeelding = { id: 'a1', mediaType: 'image/png', breedte: 1, hoogte: 1, data: PNG.buffer, bijschrift: 'b', aangemaakt: '' };
    const inhoud = await verzamelInhoud(o, async (ids) => (ids.includes('a1') ? [afb] : []));
    expect(inhoud.theorie.map((t) => t.titel)).toEqual(['Nieuw']);
    expect(inhoud.theorie[0].afbeeldingen[0].bijschrift).toBe('b');
    expect(inhoud.testcases).toHaveLength(1);
    const w = placeholderWaarden(o, { ...STANDAARD_INSTELLINGEN.profiel, naam: 'Sam' }, new Date(2026, 9, 29));
    expect(w).toMatchObject({ TITEL: 'DHCP', VAK: 'Netwerken', NAAM: 'Sam', DATUM: '29 oktober 2026' });
  });

  it('schaalt kleine afbeeldingen niet op', () => {
    expect(afbeeldingMaat(100, 50, { tekstbreedte: 9026, teksthoogte: 13958 })).toEqual({ cx: 952500, cy: 476250 });
  });
});

describe('import van oude verslagen', () => {
  it('vindt de theorie-onderwerpen terug in een geëxporteerd verslag (Kop 2 onder Kop 1 "Theorie")', async () => {
    const { data } = await vulSjabloon(await maakStandaardSjabloon(), { waarden, inhoud: inhoud() });
    const onderwerpen = vindTheorieOnderwerpen(await leesWordAlineas(data.buffer as ArrayBuffer));
    expect(onderwerpen).toEqual([
      { onderwerp: 'DHCP', uitTheorie: true },
      { onderwerp: 'Lease', uitTheorie: true },
    ]);
    const tekst = await wordNaarTekst(data.buffer as ArrayBuffer);
    expect(tekst).toContain('# 1 Theorie');
    expect(tekst).toContain('DHCP deelt adressen uit.');
  });

  it('valt terug op alle Kop 2\'s als er geen theoriehoofdstuk is, en herkent Nederlandse stijlen', async () => {
    const sjabloon = await maakSjabloon(
      '<w:p><w:pPr><w:pStyle w:val="Kop1"/></w:pPr><w:r><w:t>Inleiding</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Kop2"/></w:pPr><w:r><w:t>2.1 Firewall</w:t></w:r></w:p>',
      { styles: `<?xml version="1.0"?><w:styles xmlns:w="${NS.w}"><w:style w:type="paragraph" w:styleId="Kop1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Kop2"><w:name w:val="heading 2"/></w:style></w:styles>` },
    );
    const onderwerpen = vindTheorieOnderwerpen(await leesWordAlineas(sjabloon.buffer as ArrayBuffer));
    expect(onderwerpen).toEqual([{ onderwerp: 'Firewall', uitTheorie: false }]);
  });
});
