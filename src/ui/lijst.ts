// Kleine hulpfuncties om items in een lijst te wijzigen, verplaatsen en verwijderen.

export function wijzigItem<T extends { id: string }>(lijst: T[], id: string, fn: (item: T) => T): T[] {
  return lijst.map((x) => (x.id === id ? fn(x) : x));
}

export function verplaatsItem<T>(lijst: T[], van: number, naar: number): T[] {
  if (naar < 0 || naar >= lijst.length) return lijst;
  const kopie = [...lijst];
  const [item] = kopie.splice(van, 1);
  kopie.splice(naar, 0, item);
  return kopie;
}

export function verwijderItem<T extends { id: string }>(lijst: T[], id: string): T[] {
  return lijst.filter((x) => x.id !== id);
}
