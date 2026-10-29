// Het Word-sjabloon van de student invullen: .dotx -> .docx, {{PLACEHOLDERS}} vervangen
// (ook als Word ze over meerdere stukjes tekst heeft verdeeld), inhoud en inhoudsopgave
// invoegen, afbeeldingen toevoegen en "velden bijwerken bij openen" aanzetten.
import JSZip from 'jszip';
import {
  STANDAARD_EXPORT_OPTIES,
  hoofdstukkenXml,
  inhoudsopgave,
  type Context,
  type ExportAfbeelding,
  type ExportInhoud,
  type ExportOpties,
  type Pagina,
} from './content';
import { regelStijlen } from './stijlen';
import { NS, alineaTekst, parseXml, serialiseerXml, wAlle, wAttr, wKind } from './xml';

export const PLACEHOLDERS = ['TITEL', 'VAK', 'NAAM', 'KLAS', 'SCHOOL', 'DATUM'] as const;
export const BLOK_PLACEHOLDERS = ['INHOUDSOPGAVE', 'INHOUD'] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

const PLACEHOLDER_PATROON = /\{\{\s*([A-Za-z_]+)\s*\}\}/g;

const CT = {
  document: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  template: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml',
  documentMacro: 'application/vnd.ms-word.document.macroEnabled.main+xml',
  templateMacro: 'application/vnd.ms-word.template.macroEnabledTemplate.main+xml',
};
const REL_AFBEELDING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

export class SjabloonFout extends Error {}

// ---- Placeholders ----

/** De w:t-elementen die direct bij deze alinea horen (niet die van tekstvakken erin). */
function tekstKnopen(p: Element): Element[] {
  return wAlle(p, 't').filter((t) => {
    let el: Element | null = t.parentElement;
    while (el && !(el.namespaceURI === NS.w && el.localName === 'p')) el = el.parentElement;
    return el === p;
  });
}

/**
 * Vervangt {{NAAM}}-placeholders in alle alinea's van een XML-deel. Werkt ook als Word een
 * placeholder over meerdere runs heeft verdeeld ("{{NA" + "AM}}"). Onbekende placeholders
 * blijven staan en worden teruggegeven.
 */
export function vervangPlaceholders(doc: Document, waarden: Record<string, string>): { vervangen: number; onbekend: string[] } {
  let vervangen = 0;
  const onbekend = new Set<string>();
  for (const p of wAlle(doc, 'p')) {
    const knopen = tekstKnopen(p);
    if (!knopen.length) continue;
    const teksten = knopen.map((k) => k.textContent ?? '');
    const geheel = teksten.join('');
    if (!geheel.includes('{{')) continue;
    const treffers = [...geheel.matchAll(PLACEHOLDER_PATROON)];
    // Van achter naar voor, zodat de posities kloppen.
    for (const m of treffers.reverse()) {
      const naam = m[1].toUpperCase();
      if (!(naam in waarden)) {
        onbekend.add(naam);
        continue;
      }
      const begin = m.index ?? 0;
      const eind = begin + m[0].length;
      // Bepaal in welke knoop begin en eind vallen.
      let pos = 0;
      let bKnoop = -1;
      let bOffset = 0;
      let eKnoop = -1;
      let eOffset = 0;
      for (let i = 0; i < teksten.length; i++) {
        const lengte = teksten[i].length;
        if (bKnoop === -1 && begin < pos + lengte) {
          bKnoop = i;
          bOffset = begin - pos;
        }
        if (eKnoop === -1 && eind <= pos + lengte) {
          eKnoop = i;
          eOffset = eind - pos;
          break;
        }
        pos += lengte;
      }
      if (bKnoop === -1 || eKnoop === -1) continue;
      const waarde = waarden[naam];
      if (bKnoop === eKnoop) {
        teksten[bKnoop] = teksten[bKnoop].slice(0, bOffset) + waarde + teksten[bKnoop].slice(eOffset);
      } else {
        teksten[bKnoop] = teksten[bKnoop].slice(0, bOffset) + waarde;
        for (let i = bKnoop + 1; i < eKnoop; i++) teksten[i] = '';
        teksten[eKnoop] = teksten[eKnoop].slice(eOffset);
      }
      vervangen++;
    }
    knopen.forEach((k, i) => {
      if (k.textContent !== teksten[i]) {
        k.textContent = teksten[i];
        k.setAttributeNS(NS.xml, 'xml:space', 'preserve');
      }
    });
  }
  return { vervangen, onbekend: [...onbekend] };
}

/** Alle placeholders die in een XML-deel voorkomen (ook als ze over runs verdeeld zijn). */
export function vindPlaceholders(doc: Document): string[] {
  const gevonden = new Set<string>();
  for (const p of wAlle(doc, 'p')) {
    const tekst = tekstKnopen(p).map((k) => k.textContent ?? '').join('');
    for (const m of tekst.matchAll(PLACEHOLDER_PATROON)) gevonden.add(m[1].toUpperCase());
  }
  return [...gevonden];
}

/** De alinea waarvan de tekst de blok-placeholder bevat, bijv. {{INHOUD}}. */
function vindBlokAlinea(body: Element, naam: string): Element | undefined {
  const patroon = new RegExp(`\\{\\{\\s*${naam}\\s*\\}\\}`, 'i');
  return wAlle(body, 'p').find((p) => patroon.test(tekstKnopen(p).map((k) => k.textContent ?? '').join('')));
}

/** Staat er direct vóór dit element al een pagina-einde (of sectie-einde)? */
function heeftPaginaEindeErvoor(el: Element): boolean {
  let vorige = el.previousElementSibling;
  while (vorige && !(vorige.namespaceURI === NS.w && (vorige.localName === 'p' || vorige.localName === 'tbl'))) {
    vorige = vorige.previousElementSibling;
  }
  if (!vorige) return true; // begin van het document
  if (vorige.localName !== 'p') return false;
  const pPr = wKind(vorige, 'pPr');
  if (pPr && wKind(pPr, 'sectPr')) return true;
  const breaks = wAlle(vorige, 'br').filter((b) => wAttr(b, 'type') === 'page');
  if (!breaks.length) return false;
  // Alleen als er na het pagina-einde geen tekst meer komt.
  const laatsteBreak = breaks[breaks.length - 1];
  const tekstNa = wAlle(vorige, 't').filter((t) => laatsteBreak.compareDocumentPosition(t) & 4 /* FOLLOWING */);
  return tekstNa.every((t) => !(t.textContent ?? '').trim());
}

// ---- Pakketonderdelen ----

async function leesXml(zip: JSZip, pad: string): Promise<Document | undefined> {
  const tekst = await zip.file(pad)?.async('string');
  return tekst === undefined ? undefined : parseXml(tekst);
}

function zetXml(zip: JSZip, pad: string, doc: Document): void {
  zip.file(pad, serialiseerXml(doc));
}

/** Zet een .dotx (sjabloon) om naar een gewoon document. */
function maakDocumentType(ct: Document): boolean {
  let omgezet = false;
  for (const o of Array.from(ct.getElementsByTagNameNS(NS.ct, 'Override'))) {
    const type = o.getAttribute('ContentType');
    if (type === CT.template || type === CT.templateMacro) {
      o.setAttribute('ContentType', CT.document);
      omgezet = true;
    } else if (type === CT.documentMacro) {
      o.setAttribute('ContentType', CT.document);
    }
  }
  return omgezet;
}

function zorgVoorDefault(ct: Document, extensie: string, type: string): void {
  const bestaat = Array.from(ct.getElementsByTagNameNS(NS.ct, 'Default')).some((d) => d.getAttribute('Extension')?.toLowerCase() === extensie);
  if (bestaat) return;
  const d = ct.createElementNS(NS.ct, 'Default');
  d.setAttribute('Extension', extensie);
  d.setAttribute('ContentType', type);
  ct.documentElement.insertBefore(d, ct.documentElement.firstChild);
}

/** Pad van het hoofddocument volgens _rels/.rels (meestal word/document.xml). */
async function hoofdDocumentPad(zip: JSZip): Promise<string> {
  const rels = await leesXml(zip, '_rels/.rels');
  const rel = rels && Array.from(rels.getElementsByTagNameNS(NS.rel, 'Relationship')).find((r) => r.getAttribute('Type')?.endsWith('/officeDocument'));
  const doel = rel?.getAttribute('Target')?.replace(/^\//, '');
  return doel && zip.file(doel) ? doel : 'word/document.xml';
}

function relsPad(deelPad: string): string {
  const i = deelPad.lastIndexOf('/');
  return `${deelPad.slice(0, i)}/_rels/${deelPad.slice(i + 1)}.rels`;
}

/** Elementvolgorde in w:settings: updateFields moet vóór deze elementen staan. */
const NA_UPDATEFIELDS = [
  'hdrShapeDefaults', 'footnotePr', 'endnotePr', 'compat', 'docVars', 'rsids', 'mathPr', 'attachedSchema', 'themeFontLang',
  'clrSchemeMapping', 'doNotIncludeSubdocsInStats', 'doNotAutoCompressPictures', 'forceUpgrade', 'captions', 'readModeInkLockDown',
  'smartTagType', 'schemaLibrary', 'shapeDefaults', 'doNotEmbedSmartTags', 'decimalSymbol', 'listSeparator',
];

/** Zet <w:updateFields w:val="true"/> zodat Word bij openen de inhoudsopgave bijwerkt. */
export function zetUpdateFields(settings: Document): void {
  const root = settings.documentElement;
  const bestaand = wKind(root, 'updateFields');
  if (bestaand) {
    bestaand.setAttributeNS(NS.w, 'w:val', 'true');
    return;
  }
  const el = settings.createElementNS(NS.w, 'w:updateFields');
  el.setAttributeNS(NS.w, 'w:val', 'true');
  const volgende = Array.from(root.children).find((c) => c.namespaceURI === NS.w && NA_UPDATEFIELDS.includes(c.localName));
  root.insertBefore(el, volgende ?? null);
}

function leesPagina(body: Element): Pagina {
  const secties = wAlle(body, 'sectPr');
  const sect = secties[secties.length - 1];
  const getal = (el: Element | null, attr: string, standaard: number) => {
    const w = Number(wAttr(el, attr));
    return Number.isFinite(w) && w > 0 ? w : standaard;
  };
  const pgSz = sect ? wKind(sect, 'pgSz') : null;
  const pgMar = sect ? wKind(sect, 'pgMar') : null;
  const breedte = getal(pgSz, 'w', 11906);
  const hoogte = getal(pgSz, 'h', 16838);
  const tekstbreedte = breedte - getal(pgMar, 'left', 1440) - getal(pgMar, 'right', 1440);
  const teksthoogte = hoogte - getal(pgMar, 'top', 1440) - getal(pgMar, 'bottom', 1440);
  return { tekstbreedte: Math.max(tekstbreedte, 2000), teksthoogte: Math.max(teksthoogte, 2000) };
}

/** Voegt XML-tekst (met w:-elementen) in vóór een referentie-element. */
function voegXmlIn(doc: Document, ouder: Element, voor: Element | null, xml: string): void {
  const wrapper = parseXml(
    `<vc:wrap xmlns:vc="urn:verslagcoach" xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}">${xml}</vc:wrap>`,
  );
  for (const kind of Array.from(wrapper.documentElement.childNodes)) {
    ouder.insertBefore(doc.importNode(kind, true), voor);
  }
}

// ---- Sjabloon controleren (bij uploaden) ----

export interface SjabloonAnalyse {
  isSjabloon: boolean;
  placeholders: string[];
  onbekend: string[];
  heeftInhoud: boolean;
  heeftInhoudsopgave: boolean;
}

export async function analyseerSjabloon(data: ArrayBuffer | Uint8Array): Promise<SjabloonAnalyse> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new SjabloonFout('Dit is geen geldig Word-bestand. Upload een .dotx of .docx.');
  }
  const ct = await leesXml(zip, '[Content_Types].xml');
  if (!ct) throw new SjabloonFout('Dit is geen geldig Word-bestand. Upload een .dotx of .docx.');
  const isSjabloon = Array.from(ct.getElementsByTagNameNS(NS.ct, 'Override')).some((o) => [CT.template, CT.templateMacro].includes(o.getAttribute('ContentType') ?? ''));
  const pad = await hoofdDocumentPad(zip);
  const doc = await leesXml(zip, pad);
  if (!doc) throw new SjabloonFout('Dit Word-bestand bevat geen document.');
  const gevonden = new Set(vindPlaceholders(doc));
  for (const naam of Object.keys(zip.files).filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n))) {
    const deel = await leesXml(zip, naam);
    if (deel) vindPlaceholders(deel).forEach((p) => gevonden.add(p));
  }
  const bekend = new Set<string>([...PLACEHOLDERS, ...BLOK_PLACEHOLDERS]);
  const placeholders = [...gevonden];
  return {
    isSjabloon,
    placeholders,
    onbekend: placeholders.filter((p) => !bekend.has(p)),
    heeftInhoud: gevonden.has('INHOUD'),
    heeftInhoudsopgave: gevonden.has('INHOUDSOPGAVE'),
  };
}

// ---- Het verslag maken ----

export interface VulOpties {
  waarden: Record<Placeholder, string>;
  inhoud: ExportInhoud;
  opties?: Partial<ExportOpties>;
  /** Inhoudsopgave toevoegen als het sjabloon geen {{INHOUDSOPGAVE}} heeft. */
  inhoudsopgaveToevoegen?: boolean;
}

export interface VulResultaat {
  data: Uint8Array;
  waarschuwingen: string[];
}

export async function vulSjabloon(sjabloon: ArrayBuffer | Uint8Array, vul: VulOpties): Promise<VulResultaat> {
  const opties: ExportOpties = { ...STANDAARD_EXPORT_OPTIES, ...vul.opties };
  const waarschuwingen: string[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(sjabloon);
  } catch {
    throw new SjabloonFout('Het Word-sjabloon kon niet worden geopend. Is het een .dotx of .docx?');
  }

  // [Content_Types].xml: sjabloon -> document, en afbeeldingstypen.
  const ct = await leesXml(zip, '[Content_Types].xml');
  if (!ct) throw new SjabloonFout('Het Word-sjabloon is beschadigd ([Content_Types].xml ontbreekt).');
  maakDocumentType(ct);

  const docPad = await hoofdDocumentPad(zip);
  const doc = await leesXml(zip, docPad);
  if (!doc) throw new SjabloonFout('Het Word-sjabloon bevat geen document.');
  const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
  if (!body) throw new SjabloonFout('Het Word-sjabloon heeft geen inhoud (w:body ontbreekt).');

  // Zorg dat de gebruikte namespaces op het hoofdelement staan.
  for (const [prefix, uri] of [['r', NS.r], ['wp', NS.wp]] as const) {
    if (!doc.documentElement.lookupNamespaceURI(prefix)) {
      doc.documentElement.setAttributeNS('http://www.w3.org/2000/xmlns/', `xmlns:${prefix}`, uri);
    }
  }

  // Stijlen.
  const stylesPad = docPad.replace(/[^/]+$/, 'styles.xml');
  const hadStijlen = Boolean(zip.file(stylesPad));
  const stijlen = regelStijlen(await zip.file(stylesPad)?.async('string'));
  zip.file(stylesPad, stijlen.xml);

  // Relaties van het document (voor afbeeldingen).
  const docRelsPad = relsPad(docPad);
  const rels =
    (await leesXml(zip, docRelsPad)) ?? parseXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"/>`);
  const bestaandeIds = new Set(Array.from(rels.getElementsByTagNameNS(NS.rel, 'Relationship')).map((r) => r.getAttribute('Id')));
  if (!hadStijlen) {
    // styles.xml bestond niet: koppelen aan het document en registreren.
    const rel = rels.createElementNS(NS.rel, 'Relationship');
    rel.setAttribute('Id', 'rIdVcStijlen');
    rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles');
    rel.setAttribute('Target', 'styles.xml');
    rels.documentElement.appendChild(rel);
    const o = ct.createElementNS(NS.ct, 'Override');
    o.setAttribute('PartName', `/${stylesPad}`);
    o.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml');
    ct.documentElement.appendChild(o);
  }
  let docPrId = Math.max(0, ...Array.from(doc.getElementsByTagNameNS(NS.wp, 'docPr')).map((d) => Number(d.getAttribute('id')) || 0)) + 1;
  let afbeeldingNr = 0;
  let figuurNr = 0;
  const mediaMap = docPad.replace(/[^/]+$/, 'media/');

  const ctx: Context = {
    stijlen: stijlen.ids,
    opties,
    pagina: leesPagina(body),
    figuur: () => ++figuurNr,
    registreerAfbeelding: (a: ExportAfbeelding) => {
      afbeeldingNr++;
      const ext = a.mediaType === 'image/png' ? 'png' : 'jpeg';
      let rId = `rIdVc${afbeeldingNr}`;
      for (let i = 1; bestaandeIds.has(rId); i++) rId = `rIdVc${afbeeldingNr}_${i}`;
      bestaandeIds.add(rId);
      const bestand = `verslagcoach${afbeeldingNr}.${ext}`;
      zip.file(`${mediaMap}${bestand}`, a.data instanceof Uint8Array ? a.data : new Uint8Array(a.data), { createFolders: false });
      const rel = rels.createElementNS(NS.rel, 'Relationship');
      rel.setAttribute('Id', rId);
      rel.setAttribute('Type', REL_AFBEELDING);
      rel.setAttribute('Target', `media/${bestand}`);
      rels.documentElement.appendChild(rel);
      zorgVoorDefault(ct, ext, a.mediaType);
      return { rId, docPrId: docPrId++ };
    },
  };

  // Inhoudsopgave.
  const tocAlinea = vindBlokAlinea(body, 'INHOUDSOPGAVE');
  const inhoudAlinea = vindBlokAlinea(body, 'INHOUD');
  const sectPr = Array.from(body.children).find((c) => c.namespaceURI === NS.w && c.localName === 'sectPr') ?? null;

  if (tocAlinea) {
    voegXmlIn(doc, tocAlinea.parentElement!, tocAlinea, inhoudsopgave(!heeftPaginaEindeErvoor(tocAlinea)));
    tocAlinea.remove();
  }

  // Inhoud (hoofdstukken).
  const anker = inhoudAlinea ?? sectPr;
  if (!inhoudAlinea) waarschuwingen.push('Het sjabloon heeft geen {{INHOUD}}; de hoofdstukken staan aan het eind van het document.');
  let xml = '';
  if (!tocAlinea && vul.inhoudsopgaveToevoegen !== false) {
    xml += inhoudsopgave(anker ? !heeftPaginaEindeErvoor(anker) : true);
    ctx.eersteZonderPaginaEinde = false;
  } else {
    ctx.eersteZonderPaginaEinde = anker ? heeftPaginaEindeErvoor(anker) : false;
  }
  xml += hoofdstukkenXml(vul.inhoud, ctx);
  voegXmlIn(doc, anker?.parentElement ?? body, anker, xml);
  inhoudAlinea?.remove();

  // Placeholders in document, kop- en voetteksten.
  const onbekend = new Set<string>(vervangPlaceholders(doc, vul.waarden).onbekend);
  zetXml(zip, docPad, doc);
  for (const naam of Object.keys(zip.files).filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n))) {
    const deel = await leesXml(zip, naam);
    if (!deel) continue;
    vervangPlaceholders(deel, vul.waarden).onbekend.forEach((o) => onbekend.add(o));
    zetXml(zip, naam, deel);
  }
  if (onbekend.size) {
    waarschuwingen.push(`Onbekende placeholders zijn blijven staan: ${[...onbekend].map((o) => `{{${o}}}`).join(', ')}.`);
  }

  // Velden (inhoudsopgave, figuurnummers) bijwerken bij openen.
  const settingsPad = docPad.replace(/[^/]+$/, 'settings.xml');
  const settings = await leesXml(zip, settingsPad);
  if (settings) {
    zetUpdateFields(settings);
    zetXml(zip, settingsPad, settings);
  } else {
    waarschuwingen.push('Het sjabloon heeft geen settings.xml; werk de inhoudsopgave in Word zelf bij (F9).');
  }

  // Documenteigenschappen.
  const core = await leesXml(zip, 'docProps/core.xml');
  if (core) {
    const zet = (ns: string, naam: string, waarde: string) => {
      const el = core.getElementsByTagNameNS(ns, naam)[0];
      if (el) el.textContent = waarde;
    };
    zet('http://purl.org/dc/elements/1.1/', 'title', vul.waarden.TITEL);
    zet('http://purl.org/dc/elements/1.1/', 'creator', vul.waarden.NAAM);
    zetXml(zip, 'docProps/core.xml', core);
  }

  zetXml(zip, docRelsPad, rels);
  zetXml(zip, '[Content_Types].xml', ct);

  const data = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return { data, waarschuwingen };
}

/** Haalt de platte tekst uit alle alinea's (handig voor tests en controles). */
export function documentTekst(doc: Document): string {
  return wAlle(doc, 'p').map(alineaTekst).join('\n');
}
