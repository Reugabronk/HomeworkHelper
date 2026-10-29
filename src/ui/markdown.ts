// Kleine, veilige Markdown-lezer voor antwoorden van de coach. Er wordt nooit HTML
// ingevoegd: de uitkomst is een boomstructuur die React als tekst weergeeft.

export type Inline =
  | { type: 'tekst'; tekst: string }
  | { type: 'vet'; kinderen: Inline[] }
  | { type: 'cursief'; kinderen: Inline[] }
  | { type: 'code'; tekst: string };

export type Blok =
  | { type: 'kop'; niveau: number; inhoud: Inline[] }
  | { type: 'alinea'; regels: Inline[][] }
  | { type: 'lijst'; genummerd: boolean; items: Inline[][] }
  | { type: 'code'; tekst: string };

/** Leest inline opmaak: **vet**, *cursief* / _cursief_ en `code`. */
export function leesInline(tekst: string): Inline[] {
  const uit: Inline[] = [];
  const patroon = /(`[^`]+`|\*\*[^*]+?\*\*|__[^_]+?__|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_)/g;
  let positie = 0;
  for (const m of tekst.matchAll(patroon)) {
    const index = m.index ?? 0;
    // Een _ midden in een woord (bijv. snake_case) is geen opmaak.
    if (m[0].startsWith('_') && index > 0 && /\w/.test(tekst[index - 1])) continue;
    if (index > positie) uit.push({ type: 'tekst', tekst: tekst.slice(positie, index) });
    const t = m[0];
    if (t.startsWith('`')) uit.push({ type: 'code', tekst: t.slice(1, -1) });
    else if (t.startsWith('**') || t.startsWith('__')) uit.push({ type: 'vet', kinderen: leesInline(t.slice(2, -2)) });
    else uit.push({ type: 'cursief', kinderen: leesInline(t.slice(1, -1)) });
    positie = index + t.length;
  }
  if (positie < tekst.length) uit.push({ type: 'tekst', tekst: tekst.slice(positie) });
  return uit;
}

export function leesMarkdown(bron: string): Blok[] {
  const regels = bron.replace(/\r\n?/g, '\n').split('\n');
  const blokken: Blok[] = [];
  let alinea: Inline[][] = [];
  let lijst: { genummerd: boolean; items: Inline[][] } | null = null;

  const sluitAlinea = () => {
    if (alinea.length) blokken.push({ type: 'alinea', regels: alinea });
    alinea = [];
  };
  const sluitLijst = () => {
    if (lijst) blokken.push({ type: 'lijst', ...lijst });
    lijst = null;
  };

  for (let i = 0; i < regels.length; i++) {
    const regel = regels[i];
    const fence = regel.match(/^\s*```/);
    if (fence) {
      sluitAlinea();
      sluitLijst();
      const code: string[] = [];
      i++;
      while (i < regels.length && !/^\s*```/.test(regels[i])) code.push(regels[i++]);
      blokken.push({ type: 'code', tekst: code.join('\n') });
      continue;
    }
    if (!regel.trim()) {
      sluitAlinea();
      sluitLijst();
      continue;
    }
    const kop = regel.match(/^(#{1,6})\s+(.*)$/);
    if (kop) {
      sluitAlinea();
      sluitLijst();
      blokken.push({ type: 'kop', niveau: kop[1].length, inhoud: leesInline(kop[2].trim()) });
      continue;
    }
    const item = regel.match(/^\s*(?:([-*+•])|(\d+)[.)])\s+(.*)$/);
    if (item) {
      sluitAlinea();
      const genummerd = Boolean(item[2]);
      if (lijst && lijst.genummerd !== genummerd) sluitLijst();
      if (!lijst) lijst = { genummerd, items: [] };
      lijst.items.push(leesInline(item[3]));
      continue;
    }
    // Vervolgregel van een lijstitem (ingesprongen).
    if (lijst && /^\s{2,}\S/.test(regel)) {
      const laatste = lijst.items[lijst.items.length - 1];
      laatste.push({ type: 'tekst', tekst: ' ' }, ...leesInline(regel.trim()));
      continue;
    }
    sluitLijst();
    alinea.push(leesInline(regel));
  }
  sluitAlinea();
  sluitLijst();
  return blokken;
}
