// Stijlen in het sjabloon zoeken (Kop 1, Kop 2, bijschrift, ...) en ontbrekende toevoegen.
// Word slaat ingebouwde stijlen op met een Engelse naam ("heading 1"), ook in een
// Nederlandse Word; het id kan verschillen ("Heading1" of "Kop1").
import { NS, parseXml, serialiseerXml, wAlle, wAttr, wKind } from './xml';

export interface StijlIds {
  kop1: string;
  kop2: string;
  bijschrift?: string;
  lijst?: string;
}

/** Ingebouwde stijlnamen die we gebruiken, met de definitie voor als ze ontbreken. */
const STANDAARD: Record<keyof StijlIds, { naam: string; id: string; xml: (id: string, normaal: string) => string }> = {
  kop1: {
    naam: 'heading 1',
    id: 'Heading1',
    xml: (id, normaal) =>
      `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="heading 1"/><w:basedOn w:val="${normaal}"/><w:next w:val="${normaal}"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="1F3864"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>`,
  },
  kop2: {
    naam: 'heading 2',
    id: 'Heading2',
    xml: (id, normaal) =>
      `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="heading 2"/><w:basedOn w:val="${normaal}"/><w:next w:val="${normaal}"/><w:uiPriority w:val="9"/><w:unhideWhenUsed/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="2F5496"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>`,
  },
  bijschrift: {
    naam: 'caption',
    id: 'Caption',
    xml: (id, normaal) =>
      `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="caption"/><w:basedOn w:val="${normaal}"/><w:next w:val="${normaal}"/><w:uiPriority w:val="35"/><w:unhideWhenUsed/><w:qFormat/><w:pPr><w:spacing w:after="200"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="44546A"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>`,
  },
  lijst: {
    naam: 'list bullet',
    id: 'ListBullet',
    xml: () => '',
  },
};

/** Zoekt het styleId bij een (Engelse, ingebouwde) stijlnaam. */
export function zoekStijl(stylesDoc: Document, naam: string): string | undefined {
  for (const s of wAlle(stylesDoc, 'style')) {
    if (wAttr(s, 'type') !== 'paragraph') continue;
    const n = wAttr(wKind(s, 'name'), 'val');
    if (n && n.toLowerCase() === naam) return wAttr(s, 'styleId') ?? undefined;
  }
  return undefined;
}

function idBestaat(stylesDoc: Document, id: string): boolean {
  return wAlle(stylesDoc, 'style').some((s) => wAttr(s, 'styleId') === id);
}

/**
 * Bepaalt de stijl-id's en voegt Kop 1, Kop 2 en Bijschrift toe als het sjabloon ze niet heeft.
 * Een opsommingsstijl wordt alleen gebruikt als hij al bestaat (die heeft nummering nodig).
 */
export function regelStijlen(stylesXml: string | undefined): { xml: string; ids: StijlIds; toegevoegd: string[] } {
  const doc = parseXml(
    stylesXml ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${NS.w}"/>`,
  );
  const root = doc.documentElement;
  const toegevoegd: string[] = [];
  const normaal =
    wAlle(doc, 'style').find((s) => wAttr(s, 'type') === 'paragraph' && ['1', 'true', 'on'].includes(wAttr(s, 'default') ?? ''))
      ?.getAttributeNS(NS.w, 'styleId') ?? 'Normal';

  const regel = (sleutel: keyof StijlIds): string | undefined => {
    const def = STANDAARD[sleutel];
    const gevonden = zoekStijl(doc, def.naam);
    if (gevonden) return gevonden;
    if (sleutel === 'lijst') return undefined;
    let id = def.id;
    for (let i = 2; idBestaat(doc, id); i++) id = `${def.id}${i}`;
    const fragment = parseXml(`<x xmlns:w="${NS.w}">${def.xml(id, normaal)}</x>`).documentElement.firstElementChild!;
    root.appendChild(doc.importNode(fragment, true));
    toegevoegd.push(def.naam);
    return id;
  };

  const ids: StijlIds = { kop1: regel('kop1')!, kop2: regel('kop2')!, bijschrift: regel('bijschrift'), lijst: regel('lijst') };
  return { xml: serialiseerXml(doc), ids, toegevoegd };
}
