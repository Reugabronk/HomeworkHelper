// Gedeelde app-toestand: instellingen, API-sleutels en meldingen.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CoachOmgeving } from '../ai/coach';
import {
  bewaarInstellingen,
  bewaarSleutel,
  laadInstellingen,
  laadSleutels,
  type AanbiederId,
  type Instellingen,
  type Sleutels,
} from '../data/settings';

export interface Melding {
  id: number;
  tekst: string;
  soort: 'info' | 'succes' | 'fout';
}

interface AppContext {
  instellingen: Instellingen;
  wijzigInstellingen: (fn: (i: Instellingen) => Instellingen) => void;
  sleutels: Sleutels;
  zetSleutel: (aanbieder: AanbiederId, sleutel: string) => void;
  /** Instellingen + sleutels samen, voor de coachfuncties. */
  omgeving: CoachOmgeving;
  heeftSleutel: boolean;
  meld: (tekst: string, soort?: Melding['soort']) => void;
  meldingen: Melding[];
  sluitMelding: (id: number) => void;
}

const Context = createContext<AppContext | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [instellingen, setInstellingen] = useState(laadInstellingen);
  const [sleutels, setSleutels] = useState(laadSleutels);
  const [meldingen, setMeldingen] = useState<Melding[]>([]);
  const teller = useRef(0);

  const wijzigInstellingen = useCallback((fn: (i: Instellingen) => Instellingen) => {
    setInstellingen((oud) => {
      const nieuw = fn(oud);
      bewaarInstellingen(nieuw);
      return nieuw;
    });
  }, []);

  const zetSleutel = useCallback((aanbieder: AanbiederId, sleutel: string) => {
    bewaarSleutel(aanbieder, sleutel);
    setSleutels(laadSleutels());
  }, []);

  const sluitMelding = useCallback((id: number) => {
    setMeldingen((m) => m.filter((x) => x.id !== id));
  }, []);

  const meld = useCallback(
    (tekst: string, soort: Melding['soort'] = 'info') => {
      const id = ++teller.current;
      setMeldingen((m) => [...m.slice(-3), { id, tekst, soort }]);
      window.setTimeout(() => sluitMelding(id), soort === 'fout' ? 9000 : 4500);
    },
    [sluitMelding],
  );

  // Andere tab wijzigt instellingen of sleutel: overnemen.
  useEffect(() => {
    const bij = (e: StorageEvent) => {
      if (!e.key?.startsWith('verslagcoach.')) return;
      setInstellingen(laadInstellingen());
      setSleutels(laadSleutels());
    };
    window.addEventListener('storage', bij);
    return () => window.removeEventListener('storage', bij);
  }, []);

  // Thema toepassen.
  useEffect(() => {
    const html = document.documentElement;
    if (instellingen.thema === 'auto') html.removeAttribute('data-theme');
    else html.setAttribute('data-theme', instellingen.thema === 'donker' ? 'dark' : 'light');
  }, [instellingen.thema]);

  const waarde = useMemo<AppContext>(() => {
    const aanbieder = instellingen.ai.aanbieder;
    const lokaal = aanbieder === 'openai' && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(instellingen.ai.baseUrl);
    return {
      instellingen,
      wijzigInstellingen,
      sleutels,
      zetSleutel,
      omgeving: { instellingen, sleutels },
      heeftSleutel: Boolean(sleutels[aanbieder]) || lokaal,
      meld,
      meldingen,
      sluitMelding,
    };
  }, [instellingen, wijzigInstellingen, sleutels, zetSleutel, meld, meldingen, sluitMelding]);

  return <Context.Provider value={waarde}>{children}</Context.Provider>;
}

export function useApp(): AppContext {
  const c = useContext(Context);
  if (!c) throw new Error('useApp moet binnen AppProvider worden gebruikt.');
  return c;
}
