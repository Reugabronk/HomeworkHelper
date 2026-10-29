// Het eenvoudige standaardsjabloon voor wie geen eigen Word-sjabloon heeft.
// Voorblad met placeholders, inhoudsopgave, koptekst met naam/klas en paginanummers.
// Studenten kunnen het downloaden, in Word aanpassen en als eigen sjabloon uploaden.
import JSZip from 'jszip';
import { NS } from './xml';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const CONTENT_TYPES = `${XML}<Types xmlns="${NS.ct}">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `${XML}<Relationships xmlns="${NS.rel}">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOC_RELS = `${XML}<Relationships xmlns="${NS.rel}">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

function stijl(type: string, id: string, naam: string, inhoud: string, extra = ''): string {
  return `<w:style w:type="${type}" w:styleId="${id}"${extra}><w:name w:val="${naam}"/>${inhoud}</w:style>`;
}

const STYLES = `${XML}<w:styles xmlns:w="${NS.w}">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="nl-NL" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
${stijl('paragraph', 'Normal', 'Normal', '<w:qFormat/>', ' w:default="1"')}
${stijl('character', 'DefaultParagraphFont', 'Default Paragraph Font', '<w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/>', ' w:default="1"')}
${stijl('table', 'TableNormal', 'Normal Table', '<w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>', ' w:default="1"')}
${stijl('paragraph', 'Title', 'Title', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="10"/><w:qFormat/><w:pPr><w:spacing w:before="2400" w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>')}
${stijl('paragraph', 'Subtitle', 'Subtitle', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="11"/><w:qFormat/><w:pPr><w:spacing w:after="1600"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="595959"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>')}
${stijl('paragraph', 'Heading1', 'heading 1', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="1F3864"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>')}
${stijl('paragraph', 'Heading2', 'heading 2', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:unhideWhenUsed/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="2F5496"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>')}
${stijl('paragraph', 'Heading3', 'heading 3', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:unhideWhenUsed/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="2F5496"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>')}
${stijl('paragraph', 'Caption', 'caption', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="35"/><w:unhideWhenUsed/><w:qFormat/><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="44546A"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>')}
${stijl('paragraph', 'TOC1', 'toc 1', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9016"/></w:tabs><w:spacing w:after="100"/></w:pPr><w:rPr><w:b/></w:rPr>')}
${stijl('paragraph', 'TOC2', 'toc 2', '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9016"/></w:tabs><w:spacing w:after="60"/><w:ind w:left="220"/></w:pPr>')}
${stijl('paragraph', 'Header', 'header', '<w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:pPr><w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="right" w:pos="9026"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>')}
${stijl('paragraph', 'Footer', 'footer', '<w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:pPr><w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="right" w:pos="9026"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>')}
</w:styles>`;

const SETTINGS = `${XML}<w:settings xmlns:w="${NS.w}">
<w:zoom w:percent="100"/>
<w:defaultTabStop w:val="708"/>
<w:characterSpacingControl w:val="doNotCompress"/>
<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
<w:themeFontLang w:val="nl-NL"/>
</w:settings>`;

function p(inhoud: string, pPr = ''): string {
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inhoud}</w:p>`;
}
function r(tekst: string, rPr = ''): string {
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${tekst}</w:t></w:r>`;
}
function veld(instructie: string, standaard: string): string {
  return `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instructie} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${r(standaard)}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
}

const gegevensRegel = (label: string, placeholder: string) =>
  p(`${r(`${label}\t`, '<w:b/>')}${r(`{{${placeholder}}}`)}`, '<w:tabs><w:tab w:val="left" w:pos="2268"/></w:tabs><w:spacing w:after="80"/><w:ind w:left="2268" w:hanging="2268"/>');

const DOCUMENT = `${XML}<w:document xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}">
<w:body>
${p(r('{{TITEL}}'), '<w:pStyle w:val="Title"/>')}
${p(r('{{VAK}}'), '<w:pStyle w:val="Subtitle"/>')}
${gegevensRegel('Naam', 'NAAM')}
${gegevensRegel('Klas', 'KLAS')}
${gegevensRegel('School', 'SCHOOL')}
${gegevensRegel('Datum', 'DATUM')}
${p(r('{{INHOUDSOPGAVE}}'))}
${p(r('{{INHOUD}}'))}
<w:sectPr>
<w:headerReference w:type="default" r:id="rId3"/>
<w:footerReference w:type="default" r:id="rId4"/>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
<w:cols w:space="708"/>
<w:titlePg/>
</w:sectPr>
</w:body>
</w:document>`;

const HEADER = `${XML}<w:hdr xmlns:w="${NS.w}" xmlns:r="${NS.r}">
${p(`${r('{{NAAM}} – {{KLAS}}')}<w:r><w:tab/></w:r><w:r><w:tab/></w:r>${r('{{TITEL}}')}`, '<w:pStyle w:val="Header"/>')}
</w:hdr>`;

const FOOTER = `${XML}<w:ftr xmlns:w="${NS.w}" xmlns:r="${NS.r}">
${p(`${r('{{SCHOOL}}')}<w:r><w:tab/></w:r><w:r><w:tab/></w:r>${r('Pagina ')}${veld('PAGE', '1')}${r(' van ')}${veld('NUMPAGES', '1')}`, '<w:pStyle w:val="Footer"/>')}
</w:ftr>`;

const CORE = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Verslag</dc:title>
<dc:creator>Verslagcoach</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created>
</cp:coreProperties>`;

const APP = `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Verslagcoach</Application></Properties>`;

/** Bouwt het standaardsjabloon als .dotx (Word-sjabloon). */
export async function maakStandaardSjabloon(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('word/document.xml', DOCUMENT);
  zip.file('word/_rels/document.xml.rels', DOC_RELS);
  zip.file('word/styles.xml', STYLES);
  zip.file('word/settings.xml', SETTINGS);
  zip.file('word/header1.xml', HEADER);
  zip.file('word/footer1.xml', FOOTER);
  zip.file('docProps/core.xml', CORE);
  zip.file('docProps/app.xml', APP);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
