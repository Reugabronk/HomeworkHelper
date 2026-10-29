// Oude .docx-verslagen lezen: koppen en tekst eruit halen (voor "eerder behandelde theorie"
// en als maatstaf voor de coach).
import JSZip from 'jszip';
import { NS, alineaTekst, parseXml, wAlle, wAttr, wKind } from './xml';

export interface WordAlinea {
  tekst: string;
  /** 1 = Kop 1, 2 = Kop 2, ...; undefined = gewone tekst. */
  kopNiveau?: number;
}

interface StijlInfo {
  naam: string;
  niveau?: number;
  basis?: string;
}

function leesStijlen(xml: string | undefined): Map<string, StijlInfo> {
  const stijlen = new Map<string, StijlInfo>();
  if (!xml) return stijlen;
  const doc = parseXml(xml);
  for (const s of wAlle(doc, 'style')) {
    const id = wAttr(s, 'styleId');
    if (!id) continue;
    const naam = (wAttr(wKind(s, 'name'), 'val') ?? id).toLowerCase();
    const pPr = wKind(s, 'pPr');
    const lvl = pPr ? wAttr(wKind(pPr, 'outlineLvl'), 'val') : null;
    const basis = wAttr(wKind(s, 'basedOn'), 'val') ?? undefined;
    const m = naam.match(/^(?:heading|kop)\s*(\d)$/);
    const niveau = m ? Number(m[1]) : lvl !== null ? Number(lvl) + 1 : undefined;
    stijlen.set(id, { naam, niveau: niveau && niveau <= 9 ? niveau : undefined, basis });
  }
  return stijlen;
}

function niveauVanStijl(id: string, stijlen: Map<string, StijlInfo>, diepte = 0): number | undefined {
  const s = stijlen.get(id);
  if (!s || diepte > 10) {
    const m = id.match(/^(?:heading|kop)(\d)$/i);
    return m ? Number(m[1]) : undefined;
  }
  if (s.niveau) return s.niveau;
  return s.basis ? niveauVanStijl(s.basis, stijlen, diepte + 1) : undefined;
}

export async function leesWordAlineas(data: ArrayBuffer): Promise<WordAlinea[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error('Dit is geen geldig Word-bestand (.docx).');
  }
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('Dit Word-bestand bevat geen document (alleen .docx wordt ondersteund).');
  const stijlen = leesStijlen(await zip.file('word/styles.xml')?.async('string'));
  const doc = parseXml(documentXml);
  const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
  if (!body) return [];
  return wAlle(body, 'p').map((p) => {
    const pPr = wKind(p, 'pPr');
    const stijl = pPr ? wAttr(wKind(pPr, 'pStyle'), 'val') : null;
    const eigenLvl = pPr ? wAttr(wKind(pPr, 'outlineLvl'), 'val') : null;
    const kopNiveau = eigenLvl !== null && Number(eigenLvl) < 9 ? Number(eigenLvl) + 1 : stijl ? niveauVanStijl(stijl, stijlen) : undefined;
    return { tekst: alineaTekst(p).trim(), ...(kopNiveau ? { kopNiveau } : {}) };
  });
}

/** Haalt nummering als "1.2" of "2.3.1." van het begin van een kop af. */
export function zonderNummer(kop: string): string {
  return kop.replace(/^\s*(?:hoofdstuk\s+)?\d+(?:\.\d+)*\.?\s+/i, '').trim();
}

export interface OnderwerpKandidaat {
  onderwerp: string;
  /** True als het onder een hoofdstuk "Theorie" stond. */
  uitTheorie: boolean;
}

/**
 * Zoekt theorie-onderwerpen: de Kop 2's onder een Kop 1 met "theorie" erin.
 * Staat er geen theoriehoofdstuk in, dan komen alle Kop 2's terug (niet voorgeselecteerd).
 */
export function vindTheorieOnderwerpen(alineas: WordAlinea[]): OnderwerpKandidaat[] {
  const koppen = alineas.filter((a) => a.kopNiveau && a.tekst);
  const resultaat: OnderwerpKandidaat[] = [];
  let inTheorie = false;
  for (const k of koppen) {
    if (k.kopNiveau === 1) inTheorie = /theor/i.test(k.tekst);
    else if (k.kopNiveau === 2 && inTheorie) resultaat.push({ onderwerp: zonderNummer(k.tekst), uitTheorie: true });
  }
  if (resultaat.length) return resultaat;
  return koppen.filter((k) => k.kopNiveau === 2).map((k) => ({ onderwerp: zonderNummer(k.tekst), uitTheorie: false }));
}

/** Platte tekst van een Word-document (koppen op een eigen regel). */
export async function wordNaarTekst(data: ArrayBuffer): Promise<string> {
  const alineas = await leesWordAlineas(data);
  return alineas
    .filter((a) => a.tekst)
    .map((a) => (a.kopNiveau ? `${'#'.repeat(Math.min(a.kopNiveau, 3))} ${a.tekst}` : a.tekst))
    .join('\n\n');
}
