/** Laat de browser een bestand downloaden. */
export function downloadBestand(blob: Blob, naam: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = naam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Maakt een veilige bestandsnaam van een titel. */
export function bestandsnaam(titel: string, extensie: string): string {
  const schoon = titel
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${schoon || 'verslag'}.${extensie}`;
}
