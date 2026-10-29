// Gemeenschappelijke logica voor een AI-verzoek: laden, live tekst, stoppen en fouten.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AiFout, foutMelding } from '../../ai/providers';

export interface AiVerzoekStatus {
  bezig: boolean;
  liveTekst: string;
  fout: string | null;
  /** True als de fout over de sleutel of het model gaat (dan helpt Instellingen). */
  foutInInstellingen: boolean;
}

export function useAiVerzoek() {
  const [status, setStatus] = useState<AiVerzoekStatus>({ bezig: false, liveTekst: '', fout: null, foutInInstellingen: false });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const voerUit = useCallback(
    async <T,>(werk: (opties: { signal: AbortSignal; opTekst: (t: string) => void }) => Promise<T>): Promise<T | undefined> => {
      controller.current?.abort();
      const c = new AbortController();
      controller.current = c;
      setStatus({ bezig: true, liveTekst: '', fout: null, foutInInstellingen: false });
      try {
        const resultaat = await werk({
          signal: c.signal,
          opTekst: (t) => setStatus((s) => ({ ...s, liveTekst: t })),
        });
        setStatus({ bezig: false, liveTekst: '', fout: null, foutInInstellingen: false });
        return resultaat;
      } catch (fout) {
        const afgebroken = fout instanceof AiFout && fout.soort === 'afgebroken';
        const inInstellingen =
          fout instanceof AiFout && ['geen-sleutel', 'ongeldige-sleutel', 'model-onbekend', 'geen-toegang'].includes(fout.soort);
        setStatus({
          bezig: false,
          liveTekst: '',
          fout: afgebroken ? null : foutMelding(fout),
          foutInInstellingen: inInstellingen,
        });
        return undefined;
      } finally {
        if (controller.current === c) controller.current = null;
      }
    },
    [],
  );

  const stop = useCallback(() => controller.current?.abort(), []);
  const wisFout = useCallback(() => setStatus((s) => ({ ...s, fout: null })), []);

  return { ...status, voerUit, stop, wisFout };
}
