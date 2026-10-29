// Screenshots toevoegen (plakken met Ctrl+V, slepen of kiezen), bekijken en beheren.
import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent } from 'react';
import { useApp } from '../../app/context';
import { haalAfbeelding, verwijderAfbeelding, werkBijschriftBij } from '../../data/db';
import { afbeeldingenUitDataTransfer, bewaarBestanden } from '../../images/resize';

// ---- Object-URL's voor opgeslagen afbeeldingen (één keer per sessie aanmaken) ----

const urlCache = new Map<string, Promise<string | null>>();

function urlVoor(id: string): Promise<string | null> {
  let belofte = urlCache.get(id);
  if (!belofte) {
    belofte = haalAfbeelding(id).then((a) =>
      a ? URL.createObjectURL(new Blob([a.data], { type: a.mediaType })) : null,
    );
    urlCache.set(id, belofte);
  }
  return belofte;
}

export function useAfbeeldingUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let actief = true;
    urlVoor(id).then((u) => actief && setUrl(u));
    return () => {
      actief = false;
    };
  }, [id]);
  return url;
}

/** Geeft een functie die bestanden verkleint, opslaat en aan de lijst toevoegt. */
export function useAfbeeldingenToevoegen(onToevoegen: (ids: string[]) => void) {
  const { meld } = useApp();
  const [bezig, setBezig] = useState(false);
  const voegToe = useCallback(
    async (bestanden: Blob[]) => {
      if (!bestanden.length) return;
      setBezig(true);
      try {
        const ids = await bewaarBestanden(bestanden);
        onToevoegen(ids);
        meld(ids.length === 1 ? 'Afbeelding toegevoegd.' : `${ids.length} afbeeldingen toegevoegd.`, 'succes');
      } catch (fout) {
        meld(fout instanceof Error ? fout.message : 'Afbeelding toevoegen is mislukt.', 'fout');
      } finally {
        setBezig(false);
      }
    },
    [onToevoegen, meld],
  );
  /** Gebruik als onPaste op een kaart: plakt screenshots, laat gewone tekst met rust. */
  const bijPlakken = useCallback(
    (e: ClipboardEvent) => {
      const bestanden = afbeeldingenUitDataTransfer(e.clipboardData);
      if (!bestanden.length) return;
      e.preventDefault();
      void voegToe(bestanden);
    },
    [voegToe],
  );
  return { voegToe, bijPlakken, bezig };
}

// ---- Eén afbeelding ----

function AfbeeldingItem({
  id,
  index,
  aantal,
  onVerplaats,
  onVerwijder,
}: {
  id: string;
  index: number;
  aantal: number;
  onVerplaats: (van: number, naar: number) => void;
  onVerwijder: (id: string) => void;
}) {
  const url = useAfbeeldingUrl(id);
  const [groot, setGroot] = useState(false);
  const [bijschrift, setBijschrift] = useState('');
  const bijschriftId = useId();

  useEffect(() => {
    haalAfbeelding(id).then((a) => a && setBijschrift(a.bijschrift));
  }, [id]);

  return (
    <li className={`afbeelding-item${groot ? ' groot' : ''}`}>
      <button
        type="button"
        className="afbeelding-knop"
        onClick={() => setGroot((g) => !g)}
        aria-expanded={groot}
        aria-label={`Afbeelding ${index + 1}${bijschrift ? `: ${bijschrift}` : ''}. ${groot ? 'Klik om te verkleinen' : 'Klik om te vergroten'}`}
      >
        {url ? <img src={url} alt="" /> : <span className="zacht klein">Laden…</span>}
      </button>
      <label htmlFor={bijschriftId} className="sr-only">
        Bijschrift bij afbeelding {index + 1}
      </label>
      <input
        id={bijschriftId}
        type="text"
        placeholder="Bijschrift (optioneel)"
        value={bijschrift}
        onChange={(e) => setBijschrift(e.target.value)}
        onBlur={() => void werkBijschriftBij(id, bijschrift.trim())}
      />
      <div className="afbeelding-acties">
        <button type="button" className="klein" disabled={index === 0} onClick={() => onVerplaats(index, index - 1)} aria-label={`Afbeelding ${index + 1} naar voren`}>
          ←
        </button>
        <button type="button" className="klein" disabled={index === aantal - 1} onClick={() => onVerplaats(index, index + 1)} aria-label={`Afbeelding ${index + 1} naar achteren`}>
          →
        </button>
        <button type="button" className="klein gevaar" onClick={() => onVerwijder(id)} aria-label={`Afbeelding ${index + 1} verwijderen`}>
          Verwijder
        </button>
      </div>
    </li>
  );
}

// ---- Het vak met alle afbeeldingen ----

interface Props {
  ids: string[];
  onWijzig: (ids: string[]) => void;
  titel?: string;
}

export function Afbeeldingen({ ids, onWijzig, titel = 'Screenshots' }: Props) {
  const invoer = useRef<HTMLInputElement>(null);
  const [slepen, setSlepen] = useState(false);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const kopId = useId();

  const toevoegen = useCallback((nieuw: string[]) => onWijzig([...idsRef.current, ...nieuw]), [onWijzig]);
  const { voegToe, bijPlakken, bezig } = useAfbeeldingenToevoegen(toevoegen);

  const verplaats = (van: number, naar: number) => {
    const lijst = [...ids];
    const [item] = lijst.splice(van, 1);
    lijst.splice(naar, 0, item);
    onWijzig(lijst);
  };
  const verwijder = (id: string) => {
    if (!window.confirm('Deze afbeelding verwijderen?')) return;
    onWijzig(ids.filter((x) => x !== id));
    urlCache.delete(id);
    void verwijderAfbeelding(id);
  };

  return (
    <section
      className={`afbeeldingen${slepen ? ' slepen' : ''}`}
      aria-labelledby={kopId}
      tabIndex={0}
      onPaste={bijPlakken}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
          setSlepen(true);
        }
      }}
      onDragLeave={() => setSlepen(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSlepen(false);
        void voegToe(afbeeldingenUitDataTransfer(e.dataTransfer));
      }}
    >
      <div className="label" id={kopId}>
        {titel} {ids.length > 0 && <span className="zacht">({ids.length})</span>}
      </div>
      {ids.length > 0 && (
        <ul className="afbeeldingen-lijst">
          {ids.map((id, i) => (
            <AfbeeldingItem key={id} id={id} index={i} aantal={ids.length} onVerplaats={verplaats} onVerwijder={verwijder} />
          ))}
        </ul>
      )}
      <div className="rij">
        <button type="button" className="klein" onClick={() => invoer.current?.click()} disabled={bezig}>
          Afbeelding kiezen…
        </button>
        <span className="zacht klein">
          of plak met <kbd>Ctrl</kbd>+<kbd>V</kbd> / sleep hierheen
          {bezig && <span className="laden" aria-label="Bezig met verwerken" />}
        </span>
      </div>
      <input
        ref={invoer}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void voegToe(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </section>
  );
}
