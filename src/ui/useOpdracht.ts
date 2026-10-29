// Laadt een opdracht en bewaart wijzigingen automatisch (met een korte vertraging).
import { useCallback, useEffect, useRef, useState } from 'react';
import { bewaarOpdracht, haalOpdracht } from '../data/db';
import type { Opdracht } from '../data/types';

const BEWAAR_VERTRAGING = 600;

export function useOpdracht(id: string) {
  const [opdracht, setOpdracht] = useState<Opdracht | null | undefined>(undefined);
  const [opgeslagen, setOpgeslagen] = useState(true);
  const teBewaren = useRef<Opdracht | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const bewaarNu = useCallback(async () => {
    window.clearTimeout(timer.current);
    const o = teBewaren.current;
    if (!o) return;
    teBewaren.current = null;
    await bewaarOpdracht(o);
    if (!teBewaren.current) setOpgeslagen(true);
  }, []);

  useEffect(() => {
    let actief = true;
    setOpdracht(undefined);
    haalOpdracht(id).then((o) => actief && setOpdracht(o ?? null));
    return () => {
      actief = false;
      void bewaarNu();
    };
  }, [id, bewaarNu]);

  useEffect(() => {
    const voorVertrek = () => void bewaarNu();
    window.addEventListener('beforeunload', voorVertrek);
    window.addEventListener('pagehide', voorVertrek);
    return () => {
      window.removeEventListener('beforeunload', voorVertrek);
      window.removeEventListener('pagehide', voorVertrek);
    };
  }, [bewaarNu]);

  const wijzig = useCallback(
    (fn: (o: Opdracht) => Opdracht) => {
      setOpdracht((oud) => {
        if (!oud) return oud;
        const nieuw = fn(oud);
        teBewaren.current = nieuw;
        return nieuw;
      });
      setOpgeslagen(false);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void bewaarNu(), BEWAAR_VERTRAGING);
    },
    [bewaarNu],
  );

  return { opdracht, wijzig, opgeslagen, bewaarNu };
}
