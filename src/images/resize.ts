// Afbeeldingen verkleinen vóór opslag, zodat de database klein blijft en de AI ze snel leest.
import { bewaarAfbeelding } from '../data/db';
import { nieuwId, nu } from '../data/model';
import type { Afbeelding } from '../data/types';

/** Langste zijde na verkleinen (ruim genoeg om tekst op screenshots te lezen). */
export const MAX_ZIJDE = 1600;
/** Boven deze grootte wordt een PNG alsnog als JPEG opgeslagen. */
const MAX_PNG_BYTES = 700 * 1024;
const JPEG_KWALITEIT = 0.88;

export const TOEGESTANE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];

/** Berekent de nieuwe afmetingen binnen `max` met behoud van verhouding. */
export function schaal(breedte: number, hoogte: number, max = MAX_ZIJDE) {
  const factor = Math.min(1, max / Math.max(breedte, hoogte));
  return {
    breedte: Math.max(1, Math.round(breedte * factor)),
    hoogte: Math.max(1, Math.round(hoogte * factor)),
  };
}

function naarBlob(canvas: HTMLCanvasElement, type: string, kwaliteit?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Afbeelding kon niet worden omgezet.'))),
      type,
      kwaliteit,
    ),
  );
}

async function laadBitmap(bestand: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(bestand);
    } catch {
      // Val terug op <img> (bijv. voor sommige BMP's in oudere browsers).
    }
  }
  const url = URL.createObjectURL(bestand);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Verkleint een afbeelding en geeft een nieuw (nog niet opgeslagen) Afbeelding-object terug. */
export async function verkleinAfbeelding(bestand: Blob, bijschrift = ''): Promise<Afbeelding> {
  if (bestand.type && !TOEGESTANE_TYPES.includes(bestand.type)) {
    throw new Error('Dit bestandstype wordt niet ondersteund. Gebruik PNG, JPG, GIF of WebP.');
  }
  const bron = await laadBitmap(bestand);
  const origineel = {
    breedte: 'naturalWidth' in bron ? bron.naturalWidth : bron.width,
    hoogte: 'naturalHeight' in bron ? bron.naturalHeight : bron.height,
  };
  const { breedte, hoogte } = schaal(origineel.breedte, origineel.hoogte);
  const canvas = document.createElement('canvas');
  canvas.width = breedte;
  canvas.height = hoogte;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Je browser kan deze afbeelding niet verwerken.');
  ctx.imageSmoothingQuality = 'high';
  const isPngAchtig = bestand.type === 'image/png' || bestand.type === 'image/gif';
  if (!isPngAchtig) {
    // JPEG kent geen transparantie: wit als achtergrond.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, breedte, hoogte);
  }
  ctx.drawImage(bron, 0, 0, breedte, hoogte);
  if ('close' in bron) bron.close();

  let blob: Blob | null = null;
  let mediaType: Afbeelding['mediaType'] = 'image/jpeg';
  if (isPngAchtig) {
    const png = await naarBlob(canvas, 'image/png');
    if (png.size <= MAX_PNG_BYTES) {
      blob = png;
      mediaType = 'image/png';
    } else {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, breedte, hoogte);
    }
  }
  if (!blob) blob = await naarBlob(canvas, 'image/jpeg', JPEG_KWALITEIT);

  return {
    id: nieuwId(),
    mediaType,
    breedte,
    hoogte,
    data: await blob.arrayBuffer(),
    bijschrift,
    aangemaakt: nu(),
  };
}

/** Verkleint en bewaart bestanden; geeft de nieuwe id's terug (in volgorde). */
export async function bewaarBestanden(bestanden: Blob[]): Promise<string[]> {
  const ids: string[] = [];
  for (const bestand of bestanden) {
    const afb = await verkleinAfbeelding(bestand);
    await bewaarAfbeelding(afb);
    ids.push(afb.id);
  }
  return ids;
}

/** Haalt afbeeldingsbestanden uit een plak- of sleepactie. */
export function afbeeldingenUitDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const bestanden: File[] = [];
  if (dt.items && dt.items.length) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) bestanden.push(f);
      }
    }
  } else {
    for (const f of Array.from(dt.files)) if (f.type.startsWith('image/')) bestanden.push(f);
  }
  return bestanden;
}
