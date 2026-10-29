// Opslag in IndexedDB. Alles blijft in de browser van de gebruiker.
import { afbeeldingenVanOpdracht, nu } from './model';
import type { Afbeelding, EerdereTheorie, Opdracht, OpgeslagenSjabloon } from './types';

const DB_NAAM = 'verslagcoach';
const DB_VERSIE = 1;

export const STORES = {
  opdrachten: 'opdrachten',
  afbeeldingen: 'afbeeldingen',
  eerdereTheorie: 'eerdereTheorie',
  bestanden: 'bestanden',
} as const;

type StoreNaam = (typeof STORES)[keyof typeof STORES];

let dbBelofte: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbBelofte) return dbBelofte;
  dbBelofte = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Deze browser ondersteunt geen lokale opslag (IndexedDB).'));
      return;
    }
    const verzoek = indexedDB.open(DB_NAAM, DB_VERSIE);
    verzoek.onupgradeneeded = () => {
      const db = verzoek.result;
      if (!db.objectStoreNames.contains(STORES.opdrachten)) {
        db.createObjectStore(STORES.opdrachten, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.afbeeldingen)) {
        db.createObjectStore(STORES.afbeeldingen, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.eerdereTheorie)) {
        db.createObjectStore(STORES.eerdereTheorie, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.bestanden)) {
        db.createObjectStore(STORES.bestanden);
      }
    };
    verzoek.onsuccess = () => {
      const db = verzoek.result;
      // Een andere tab wil de database bijwerken: deze verbinding netjes sluiten.
      db.onversionchange = () => {
        db.close();
        dbBelofte = null;
      };
      resolve(db);
    };
    verzoek.onerror = () => {
      dbBelofte = null;
      reject(verzoek.error ?? new Error('De lokale database kon niet worden geopend.'));
    };
  });
  return dbBelofte;
}

/** Sluit de database (alleen nodig in tests). */
export async function sluitDb(): Promise<void> {
  if (!dbBelofte) return;
  const db = await dbBelofte.catch(() => null);
  db?.close();
  dbBelofte = null;
}

function alsBelofte<T>(verzoek: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    verzoek.onsuccess = () => resolve(verzoek.result);
    verzoek.onerror = () => reject(verzoek.error);
  });
}

async function transactie<T>(
  stores: StoreNaam | StoreNaam[],
  modus: IDBTransactionMode,
  werk: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(stores, modus);
  const klaar = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Opslaan is afgebroken.'));
    tx.onerror = () => reject(tx.error ?? new Error('Opslaan is mislukt.'));
  });
  const resultaat = await werk(tx);
  await klaar;
  if (modus === 'readwrite') meldWijziging();
  return resultaat;
}

// ---- Wijzigingen doorgeven aan de interface ----

type Luisteraar = () => void;
const luisteraars = new Set<Luisteraar>();

export function bijWijziging(luisteraar: Luisteraar): () => void {
  luisteraars.add(luisteraar);
  return () => luisteraars.delete(luisteraar);
}

function meldWijziging(): void {
  for (const l of luisteraars) l();
}

// ---- Opdrachten ----

export function alleOpdrachten(): Promise<Opdracht[]> {
  return transactie(STORES.opdrachten, 'readonly', (tx) =>
    alsBelofte(tx.objectStore(STORES.opdrachten).getAll() as IDBRequest<Opdracht[]>),
  );
}

export function haalOpdracht(id: string): Promise<Opdracht | undefined> {
  return transactie(STORES.opdrachten, 'readonly', (tx) =>
    alsBelofte(tx.objectStore(STORES.opdrachten).get(id) as IDBRequest<Opdracht | undefined>),
  );
}

export async function bewaarOpdracht(opdracht: Opdracht): Promise<Opdracht> {
  const opgeslagen = { ...opdracht, gewijzigd: nu() };
  await transactie(STORES.opdrachten, 'readwrite', (tx) =>
    alsBelofte(tx.objectStore(STORES.opdrachten).put(opgeslagen)),
  );
  return opgeslagen;
}

/** Verwijdert een opdracht én de afbeeldingen die alleen door deze opdracht worden gebruikt. */
export async function verwijderOpdracht(id: string): Promise<void> {
  const alle = await alleOpdrachten();
  const opdracht = alle.find((o) => o.id === id);
  if (!opdracht) return;
  const elders = new Set(alle.filter((o) => o.id !== id).flatMap(afbeeldingenVanOpdracht));
  const weg = afbeeldingenVanOpdracht(opdracht).filter((a) => !elders.has(a));
  await transactie([STORES.opdrachten, STORES.afbeeldingen], 'readwrite', (tx) => {
    tx.objectStore(STORES.opdrachten).delete(id);
    const afb = tx.objectStore(STORES.afbeeldingen);
    for (const a of weg) afb.delete(a);
  });
}

// ---- Afbeeldingen ----

export function bewaarAfbeelding(afbeelding: Afbeelding): Promise<void> {
  return transactie(STORES.afbeeldingen, 'readwrite', async (tx) => {
    await alsBelofte(tx.objectStore(STORES.afbeeldingen).put(afbeelding));
  });
}

export function haalAfbeelding(id: string): Promise<Afbeelding | undefined> {
  return transactie(STORES.afbeeldingen, 'readonly', (tx) =>
    alsBelofte(tx.objectStore(STORES.afbeeldingen).get(id) as IDBRequest<Afbeelding | undefined>),
  );
}

/** Haalt meerdere afbeeldingen op, in dezelfde volgorde; ontbrekende worden overgeslagen. */
export async function haalAfbeeldingen(ids: string[]): Promise<Afbeelding[]> {
  if (ids.length === 0) return [];
  const resultaat = await transactie(STORES.afbeeldingen, 'readonly', (tx) => {
    const store = tx.objectStore(STORES.afbeeldingen);
    return Promise.all(
      ids.map((id) => alsBelofte(store.get(id) as IDBRequest<Afbeelding | undefined>)),
    );
  });
  return resultaat.filter((a): a is Afbeelding => Boolean(a));
}

export function alleAfbeeldingen(): Promise<Afbeelding[]> {
  return transactie(STORES.afbeeldingen, 'readonly', (tx) =>
    alsBelofte(tx.objectStore(STORES.afbeeldingen).getAll() as IDBRequest<Afbeelding[]>),
  );
}

export function verwijderAfbeelding(id: string): Promise<void> {
  return transactie(STORES.afbeeldingen, 'readwrite', async (tx) => {
    await alsBelofte(tx.objectStore(STORES.afbeeldingen).delete(id));
  });
}

export async function werkBijschriftBij(id: string, bijschrift: string): Promise<void> {
  const afb = await haalAfbeelding(id);
  if (!afb) return;
  await bewaarAfbeelding({ ...afb, bijschrift });
}

// ---- Eerdere theorie (uit geïmporteerde verslagen) ----

export function alleEerdereTheorie(): Promise<EerdereTheorie[]> {
  return transactie(STORES.eerdereTheorie, 'readonly', (tx) =>
    alsBelofte(tx.objectStore(STORES.eerdereTheorie).getAll() as IDBRequest<EerdereTheorie[]>),
  );
}

export function bewaarEerdereTheorie(items: EerdereTheorie[]): Promise<void> {
  return transactie(STORES.eerdereTheorie, 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.eerdereTheorie);
    for (const item of items) store.put(item);
  });
}

export function verwijderEerdereTheorie(id: string): Promise<void> {
  return transactie(STORES.eerdereTheorie, 'readwrite', async (tx) => {
    await alsBelofte(tx.objectStore(STORES.eerdereTheorie).delete(id));
  });
}

// ---- Word-sjabloon ----

const SJABLOON_SLEUTEL = 'wordSjabloon';

export function haalSjabloon(): Promise<OpgeslagenSjabloon | undefined> {
  return transactie(STORES.bestanden, 'readonly', (tx) =>
    alsBelofte(
      tx.objectStore(STORES.bestanden).get(SJABLOON_SLEUTEL) as IDBRequest<
        OpgeslagenSjabloon | undefined
      >,
    ),
  );
}

export function bewaarSjabloon(sjabloon: OpgeslagenSjabloon): Promise<void> {
  return transactie(STORES.bestanden, 'readwrite', async (tx) => {
    await alsBelofte(tx.objectStore(STORES.bestanden).put(sjabloon, SJABLOON_SLEUTEL));
  });
}

export function verwijderSjabloon(): Promise<void> {
  return transactie(STORES.bestanden, 'readwrite', async (tx) => {
    await alsBelofte(tx.objectStore(STORES.bestanden).delete(SJABLOON_SLEUTEL));
  });
}

// ---- Alles in één keer (back-up) ----

export interface DatabaseInhoud {
  opdrachten: Opdracht[];
  afbeeldingen: Afbeelding[];
  eerdereTheorie: EerdereTheorie[];
  sjabloon?: OpgeslagenSjabloon;
}

export async function leesAlles(): Promise<DatabaseInhoud> {
  const [opdrachten, afbeeldingen, eerdereTheorie, sjabloon] = await Promise.all([
    alleOpdrachten(),
    alleAfbeeldingen(),
    alleEerdereTheorie(),
    haalSjabloon(),
  ]);
  return { opdrachten, afbeeldingen, eerdereTheorie, ...(sjabloon ? { sjabloon } : {}) };
}

/** Vervangt (of vult aan) de complete database in één transactie. */
export function schrijfAlles(inhoud: DatabaseInhoud, vervangen: boolean): Promise<void> {
  const alleStores = Object.values(STORES);
  return transactie(alleStores, 'readwrite', (tx) => {
    if (vervangen) for (const s of alleStores) tx.objectStore(s).clear();
    const opdrachten = tx.objectStore(STORES.opdrachten);
    for (const o of inhoud.opdrachten) opdrachten.put(o);
    const afbeeldingen = tx.objectStore(STORES.afbeeldingen);
    for (const a of inhoud.afbeeldingen) afbeeldingen.put(a);
    const theorie = tx.objectStore(STORES.eerdereTheorie);
    for (const t of inhoud.eerdereTheorie) theorie.put(t);
    if (inhoud.sjabloon) tx.objectStore(STORES.bestanden).put(inhoud.sjabloon, SJABLOON_SLEUTEL);
  });
}

export function wisAlles(): Promise<void> {
  const alleStores = Object.values(STORES);
  return transactie(alleStores, 'readwrite', (tx) => {
    for (const s of alleStores) tx.objectStore(s).clear();
  });
}
