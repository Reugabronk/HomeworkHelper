// Hulpfuncties voor WordprocessingML (de XML in een .docx).

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
  xml: 'http://www.w3.org/XML/1998/namespace',
} as const;

export function parseXml(tekst: string): Document {
  const doc = new DOMParser().parseFromString(tekst, 'application/xml');
  const fout = doc.getElementsByTagName('parsererror')[0];
  if (fout) throw new Error(`Ongeldige XML in het Word-bestand: ${fout.textContent?.slice(0, 200)}`);
  return doc;
}

export function serialiseerXml(doc: Document): string {
  const xml = new XMLSerializer().serializeToString(doc);
  return xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`;
}

/** Alle w:-elementen met deze lokale naam, in documentvolgorde. */
export function wAlle(ouder: Document | Element, naam: string): Element[] {
  return Array.from(ouder.getElementsByTagNameNS(NS.w, naam));
}

/** Eerste direct kind met deze w:-naam. */
export function wKind(ouder: Element, naam: string): Element | null {
  for (const kind of Array.from(ouder.childNodes)) {
    if (kind.nodeType === 1 && (kind as Element).namespaceURI === NS.w && (kind as Element).localName === naam) return kind as Element;
  }
  return null;
}

export function wAttr(el: Element | null, naam: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(NS.w, naam) ?? el.getAttribute(`w:${naam}`);
}

/** Escapet tekst voor gebruik in XML-strings. */
export function esc(tekst: string): string {
  return tekst
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Tekens die niet in XML 1.0 mogen (behalve tab, LF, CR).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
}

/** Tekst van een alinea (w:t, tabs en regeleinden). */
export function alineaTekst(p: Element): string {
  let tekst = '';
  const loop = (el: Element) => {
    for (const kind of Array.from(el.childNodes)) {
      if (kind.nodeType !== 1) continue;
      const e = kind as Element;
      if (e.namespaceURI === NS.w) {
        if (e.localName === 't') tekst += e.textContent ?? '';
        else if (e.localName === 'tab') tekst += '\t';
        else if (e.localName === 'br' || e.localName === 'cr') tekst += '\n';
        else if (e.localName === 'instrText' || e.localName === 'delText') continue;
        else loop(e);
      } else loop(e);
    }
  };
  loop(p);
  return tekst;
}
