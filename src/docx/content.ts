// Zet de hoofdstukken om naar WordprocessingML: koppen, alinea's, screenshots met
// bijschrift, commando's in een grijs codeblok en de testcases als tabel.
import type { Testcase } from '../data/types';
import type { StijlIds } from './stijlen';
import { NS, esc } from './xml';

export interface ExportAfbeelding {
  data: ArrayBuffer | Uint8Array;
  mediaType: 'image/png' | 'image/jpeg';
  breedte: number;
  hoogte: number;
  bijschrift: string;
}

export interface ExportInhoud {
  theorie: { titel: string; tekst: string; afbeeldingen: ExportAfbeelding[] }[];
  stappen: { titel: string; tekst: string; commandos: string; afbeeldingen: ExportAfbeelding[] }[];
  eindresultaat: { tekst: string; afbeeldingen: ExportAfbeelding[] };
  testcases: Testcase[];
  reflectie: string;
}

export interface ExportOpties {
  /** "1 Theorie", "1.1 Onderwerp" in de koppen zetten. */
  nummering: boolean;
  /** Elk hoofdstuk op een nieuwe pagina. */
  hoofdstukNieuwePagina: boolean;
  /** "Figuur n" onder elke afbeelding. */
  figuurBijschriften: boolean;
}

export const STANDAARD_EXPORT_OPTIES: ExportOpties = {
  nummering: true,
  hoofdstukNieuwePagina: true,
  figuurBijschriften: true,
};

export const HOOFDSTUK_TITELS = ['Theorie', 'Uitwerking van de opdracht', 'Resultaat van de opdracht'] as const;

/** Pagina-afmetingen in twips (1/20 punt), voor het schalen van afbeeldingen. */
export interface Pagina {
  tekstbreedte: number;
  teksthoogte: number;
}

export interface Context {
  stijlen: StijlIds;
  opties: ExportOpties;
  pagina: Pagina;
  /** Registreert een afbeelding in het pakket; geeft relatie-id en uniek tekening-id. */
  registreerAfbeelding: (a: ExportAfbeelding) => { rId: string; docPrId: number };
  /** Volgend figuurnummer. */
  figuur: () => number;
  /** Eerste Kop 1 niet op een nieuwe pagina (bijv. als er al een pagina-einde voor staat). */
  eersteZonderPaginaEinde?: boolean;
}

const EMU_PER_TWIP = 635;
const EMU_PER_PX = 9525; // bij 96 dpi

// ---- Basisbouwstenen ----

function run(tekst: string, rPr = ''): string {
  // Tabs en regeleinden binnen een run omzetten naar w:tab / w:br.
  const delen = tekst.split(/(\t|\n)/);
  const inhoud = delen
    .map((d) => (d === '\t' ? '<w:tab/>' : d === '\n' ? '<w:br/>' : d ? `<w:t xml:space="preserve">${esc(d)}</w:t>` : ''))
    .join('');
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${inhoud}</w:r>`;
}

function alinea(inhoud: string, pPr = ''): string {
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inhoud}</w:p>`;
}

export function kop(niveau: 1 | 2, tekst: string, ctx: Context, paginaEinde = false): string {
  const stijl = niveau === 1 ? ctx.stijlen.kop1 : ctx.stijlen.kop2;
  return alinea(run(tekst), `<w:pStyle w:val="${esc(stijl)}"/>${paginaEinde ? '<w:pageBreakBefore/>' : ''}`);
}

/**
 * Tekst van de student: lege regel = nieuwe alinea, enter = regeleinde,
 * regels die met "- " of "* " beginnen worden opsommingstekens.
 */
export function tekstAlineas(tekst: string, ctx: Context): string {
  const blokken = tekst.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
  const uit: string[] = [];
  for (const blok of blokken) {
    if (!blok.trim()) continue;
    const regels = blok.split('\n');
    if (regels.every((r) => /^\s*[-*•]\s+/.test(r))) {
      for (const r of regels) {
        const t = r.replace(/^\s*[-*•]\s+/, '');
        uit.push(
          ctx.stijlen.lijst
            ? alinea(run(t), `<w:pStyle w:val="${esc(ctx.stijlen.lijst)}"/>`)
            : alinea(run(`•\t${t}`), '<w:spacing w:after="60"/><w:ind w:left="360" w:hanging="360"/>'),
        );
      }
    } else {
      uit.push(alinea(run(regels.join('\n'))));
    }
  }
  return uit.join('');
}

/** Commando's in een grijs codeblok (één alinea per regel, met kader en arcering). */
export function codeBlok(code: string): string {
  const regels = code.replace(/\r\n?/g, '\n').replace(/\s+$/, '').split('\n');
  if (!regels.length || !code.trim()) return '';
  const rand = '<w:pBdr>' + ['top', 'left', 'bottom', 'right'].map((k) => `<w:${k} w:val="single" w:sz="4" w:space="4" w:color="BFBFBF"/>`).join('') + '</w:pBdr>';
  const rPr = '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas" w:eastAsia="Consolas"/><w:noProof/><w:sz w:val="19"/><w:szCs w:val="19"/>';
  return regels
    .map((r, i) => {
      const voor = i === 0 ? 120 : 0;
      const na = i === regels.length - 1 ? 200 : 0;
      const pPr = `${i < regels.length - 1 ? '<w:keepNext/>' : ''}${rand}<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:before="${voor}" w:after="${na}" w:line="240" w:lineRule="auto"/><w:ind w:left="113" w:right="113"/>`;
      return alinea(r ? run(r, rPr) : '', pPr);
    })
    .join('');
}

/** Schaalt een afbeelding naar de tekstbreedte en maximaal 60% van de teksthoogte. */
export function afbeeldingMaat(breedtePx: number, hoogtePx: number, pagina: Pagina): { cx: number; cy: number } {
  const maxB = pagina.tekstbreedte * EMU_PER_TWIP;
  const maxH = pagina.teksthoogte * EMU_PER_TWIP * 0.6;
  const b = Math.max(1, breedtePx) * EMU_PER_PX;
  const h = Math.max(1, hoogtePx) * EMU_PER_PX;
  const factor = Math.min(1, maxB / b, maxH / h);
  return { cx: Math.round(b * factor), cy: Math.round(h * factor) };
}

export function afbeelding(a: ExportAfbeelding, ctx: Context): string {
  const { rId, docPrId } = ctx.registreerAfbeelding(a);
  const { cx, cy } = afbeeldingMaat(a.breedte, a.hoogte, ctx.pagina);
  const naam = `Afbeelding ${docPrId}`;
  const tekening =
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="${NS.wp}">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="${naam}" descr="${esc(a.bijschrift)}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${NS.a}" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="${NS.pic}"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${naam}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}" xmlns:r="${NS.r}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
  const metBijschrift = ctx.opties.figuurBijschriften || a.bijschrift.trim();
  let xml = alinea(`<w:r>${tekening}</w:r>`, `${metBijschrift ? '<w:keepNext/>' : ''}<w:spacing w:before="120" w:after="${metBijschrift ? 60 : 200}"/><w:jc w:val="center"/>`);
  if (metBijschrift) {
    const pPr = ctx.stijlen.bijschrift ? `<w:pStyle w:val="${esc(ctx.stijlen.bijschrift)}"/><w:jc w:val="center"/>` : '<w:jc w:val="center"/>';
    const rPr = ctx.stijlen.bijschrift ? '' : '<w:i/><w:sz w:val="18"/>';
    const omschrijving = a.bijschrift.trim();
    if (ctx.opties.figuurBijschriften) {
      const nr = ctx.figuur();
      xml += alinea(
        run('Figuur ', rPr) +
          `<w:fldSimple w:instr=" SEQ Figuur \\* ARABIC ">${run(String(nr), rPr)}</w:fldSimple>` +
          (omschrijving ? run(`: ${omschrijving}`, rPr) : ''),
        pPr,
      );
    } else {
      xml += alinea(run(omschrijving, rPr), pPr);
    }
  }
  return xml;
}

function afbeeldingen(lijst: ExportAfbeelding[], ctx: Context): string {
  return lijst.map((a) => afbeelding(a, ctx)).join('');
}

// ---- Testcases-tabel ----

export function testcaseTabel(testcases: Testcase[], ctx: Context): string {
  const kolommen = [
    { kop: 'Nr.', deel: 0.07 },
    { kop: 'Testcase', deel: 0.31 },
    { kop: 'Verwacht resultaat', deel: 0.25 },
    { kop: 'Werkelijk resultaat', deel: 0.25 },
    { kop: 'Geslaagd', deel: 0.12 },
  ];
  const breedtes = kolommen.map((k) => Math.floor(ctx.pagina.tekstbreedte * k.deel));
  const randen = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join('');
  const cel = (inhoud: string, i: number, kop = false, kleur?: string) => {
    const shd = kop ? '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>' : kleur ? `<w:shd w:val="clear" w:color="auto" w:fill="${kleur}"/>` : '';
    const regels = inhoud.replace(/\r\n?/g, '\n').split('\n');
    const ps = regels.map((r) => alinea(r ? run(r, kop ? '<w:b/>' : '') : '', '<w:spacing w:before="0" w:after="0"/>')).join('');
    return `<w:tc><w:tcPr><w:tcW w:w="${breedtes[i]}" w:type="dxa"/>${shd}</w:tcPr>${ps}</w:tc>`;
  };
  const kopRij = `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${kolommen.map((k, i) => cel(k.kop, i, true)).join('')}</w:tr>`;
  const rijen = testcases
    .map((t, n) => {
      const geslaagd = t.geslaagd === 'ja' ? 'Ja' : t.geslaagd === 'nee' ? 'Nee' : '';
      const kleur = t.geslaagd === 'ja' ? 'E2EFDA' : t.geslaagd === 'nee' ? 'FBE4E4' : undefined;
      return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${[String(n + 1), t.beschrijving, t.verwacht, t.werkelijk].map((w, i) => cel(w, i)).join('')}${cel(geslaagd, 4, false, kleur)}</w:tr>`;
    })
    .join('');
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${breedtes.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${randen}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${breedtes.map((b) => `<w:gridCol w:w="${b}"/>`).join('')}</w:tblGrid>${kopRij}${rijen}</w:tbl>` +
    // Na een tabel altijd een (lege) alinea, zodat twee tabellen niet samensmelten.
    alinea('', '<w:spacing w:after="120"/>')
  );
}

// ---- Inhoudsopgave ----

export function inhoudsopgave(paginaEinde: boolean): string {
  const kop = alinea(
    run('Inhoudsopgave', '<w:b/><w:bCs/><w:color w:val="1F3864"/><w:sz w:val="32"/><w:szCs w:val="32"/>'),
    `<w:keepNext/>${paginaEinde ? '<w:pageBreakBefore/>' : ''}<w:spacing w:after="200"/>`,
  );
  const veld = alinea(
    '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      run('Klik met de rechtermuisknop en kies "Veld bijwerken" om de inhoudsopgave te maken.', '<w:i/>') +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
  );
  return kop + veld;
}

// ---- Alle hoofdstukken ----

export function hoofdstukkenXml(inhoud: ExportInhoud, ctx: Context): string {
  const { nummering, hoofdstukNieuwePagina } = ctx.opties;
  const k1 = (n: number) => (nummering ? `${n} ${HOOFDSTUK_TITELS[n - 1]}` : HOOFDSTUK_TITELS[n - 1]);
  const k2 = (h: number, n: number, titel: string) => (nummering ? `${h}.${n} ${titel}` : titel);
  const nieuwePagina = (n: number) => hoofdstukNieuwePagina && !(n === 1 && ctx.eersteZonderPaginaEinde);
  const leeg = (wat: string) => alinea(run(`[${wat}]`, '<w:i/><w:color w:val="7F7F7F"/>'));
  const delen: string[] = [];

  // Hoofdstuk 1: Theorie
  delen.push(kop(1, k1(1), ctx, nieuwePagina(1)));
  if (!inhoud.theorie.length) delen.push(leeg('Geen nieuwe theorie in deze opdracht.'));
  inhoud.theorie.forEach((t, i) => {
    delen.push(kop(2, k2(1, i + 1, t.titel || 'Onderwerp'), ctx));
    delen.push(t.tekst.trim() ? tekstAlineas(t.tekst, ctx) : leeg('Nog geen tekst'));
    delen.push(afbeeldingen(t.afbeeldingen, ctx));
  });

  // Hoofdstuk 2: Uitwerking
  delen.push(kop(1, k1(2), ctx, nieuwePagina(2)));
  if (!inhoud.stappen.length) delen.push(leeg('Nog geen stappen'));
  inhoud.stappen.forEach((s, i) => {
    delen.push(kop(2, k2(2, i + 1, s.titel || `Stap ${i + 1}`), ctx));
    if (s.tekst.trim()) delen.push(tekstAlineas(s.tekst, ctx));
    delen.push(codeBlok(s.commandos));
    delen.push(afbeeldingen(s.afbeeldingen, ctx));
    if (!s.tekst.trim() && !s.commandos.trim() && !s.afbeeldingen.length) delen.push(leeg('Nog geen tekst'));
  });

  // Hoofdstuk 3: Resultaat
  delen.push(kop(1, k1(3), ctx, nieuwePagina(3)));
  delen.push(kop(2, k2(3, 1, 'Eindresultaat'), ctx));
  delen.push(inhoud.eindresultaat.tekst.trim() ? tekstAlineas(inhoud.eindresultaat.tekst, ctx) : leeg('Nog geen tekst'));
  delen.push(afbeeldingen(inhoud.eindresultaat.afbeeldingen, ctx));
  delen.push(kop(2, k2(3, 2, 'Testcases'), ctx));
  delen.push(inhoud.testcases.length ? testcaseTabel(inhoud.testcases, ctx) : leeg('Nog geen testcases'));
  delen.push(kop(2, k2(3, 3, 'Reflectie'), ctx));
  delen.push(inhoud.reflectie.trim() ? tekstAlineas(inhoud.reflectie, ctx) : leeg('Nog geen tekst'));

  return delen.join('');
}
