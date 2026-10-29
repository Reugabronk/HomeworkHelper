// Eerder behandelde theorie: uit je opdrachten en uit geïmporteerde oude verslagen (.docx).
import { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../../app/context';
import { theorieUitOpdrachten } from '../../ai/coach';
import type { BekendOnderwerp } from '../../ai/plan';
import { alleEerdereTheorie, bewaarEerdereTheorie, bijWijziging, verwijderEerdereTheorie } from '../../data/db';
import { nieuwId, normaliseerOnderwerp, nu } from '../../data/model';
import type { EerdereTheorie as EerdereTheorieItem } from '../../data/types';
import { leesWordAlineas, vindTheorieOnderwerpen } from '../../docx/import';
import { Dialoog } from '../components/Dialoog';

interface Kandidaat {
  sleutel: string;
  onderwerp: string;
  bron: string;
  gekozen: boolean;
  uitTheorie: boolean;
}

export function EerdereTheorie() {
  const { meld } = useApp();
  const [geimporteerd, setGeimporteerd] = useState<EerdereTheorieItem[]>([]);
  const [uitOpdrachten, setUitOpdrachten] = useState<BekendOnderwerp[]>([]);
  const [kandidaten, setKandidaten] = useState<Kandidaat[] | null>(null);
  const [handmatig, setHandmatig] = useState('');
  const [bezig, setBezig] = useState(false);
  const invoer = useRef<HTMLInputElement>(null);
  const handId = useId();

  useEffect(() => {
    const laad = () => {
      void alleEerdereTheorie().then((l) => setGeimporteerd(l.sort((a, b) => a.onderwerp.localeCompare(b.onderwerp, 'nl'))));
      void theorieUitOpdrachten().then(setUitOpdrachten);
    };
    laad();
    return bijWijziging(laad);
  }, []);

  const importeer = async (bestanden: File[]) => {
    setBezig(true);
    const gevonden: Kandidaat[] = [];
    const bekend = new Set(geimporteerd.map((g) => normaliseerOnderwerp(g.onderwerp)));
    for (const bestand of bestanden) {
      try {
        const onderwerpen = vindTheorieOnderwerpen(await leesWordAlineas(await bestand.arrayBuffer()));
        if (!onderwerpen.length) meld(`Geen koppen gevonden in ${bestand.name}. Gebruik je de stijlen "Kop 1" en "Kop 2"?`, 'fout');
        for (const o of onderwerpen) {
          if (!o.onderwerp) continue;
          const n = normaliseerOnderwerp(o.onderwerp);
          gevonden.push({
            sleutel: nieuwId(),
            onderwerp: o.onderwerp,
            bron: bestand.name,
            uitTheorie: o.uitTheorie,
            gekozen: o.uitTheorie && !bekend.has(n),
          });
        }
      } catch (fout) {
        meld(`${bestand.name}: ${fout instanceof Error ? fout.message : 'kon niet worden gelezen'}`, 'fout');
      }
    }
    setBezig(false);
    if (gevonden.length) setKandidaten(gevonden);
  };

  const bewaarKandidaten = async () => {
    const items: EerdereTheorieItem[] = (kandidaten ?? [])
      .filter((k) => k.gekozen && k.onderwerp.trim())
      .map((k) => ({ id: nieuwId(), onderwerp: k.onderwerp.trim(), bron: k.bron, datum: nu() }));
    await bewaarEerdereTheorie(items);
    setKandidaten(null);
    meld(`${items.length} onderwerp(en) toegevoegd.`, 'succes');
  };

  return (
    <>
      <h1>Eerder behandelde theorie</h1>
      <p className="zacht">
        In hoofdstuk 1 hoort alleen theorie die nieuw is. Onderwerpen op deze lijst herkent de coach als "al behandeld" en slaat hij standaard over.
      </p>

      <section className="kaart" aria-labelledby="kop-import">
        <h2 id="kop-import">Oude verslagen importeren</h2>
        <p>
          Kies één of meer oude verslagen (.docx). De app zoekt het hoofdstuk <em>Theorie</em> (Kop 1) en neemt de paragrafen daaronder (Kop 2) over als
          onderwerpen. De bestanden zelf worden niet bewaard.
        </p>
        <button type="button" className="primair" onClick={() => invoer.current?.click()} disabled={bezig}>
          {bezig ? <span className="laden">Lezen</span> : 'Word-bestanden kiezen…'}
        </button>
        <input
          ref={invoer}
          type="file"
          multiple
          hidden
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            void importeer(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <form
          className="rij"
          style={{ marginTop: '1rem' }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!handmatig.trim()) return;
            await bewaarEerdereTheorie([{ id: nieuwId(), onderwerp: handmatig.trim(), bron: 'Handmatig toegevoegd', datum: nu() }]);
            setHandmatig('');
          }}
        >
          <label htmlFor={handId} className="sr-only">
            Onderwerp handmatig toevoegen
          </label>
          <input id={handId} type="text" placeholder="Of typ zelf een onderwerp" value={handmatig} onChange={(e) => setHandmatig(e.target.value)} style={{ flex: '1 1 220px', width: 'auto' }} />
          <button type="submit" disabled={!handmatig.trim()}>
            Toevoegen
          </button>
        </form>
      </section>

      <section className="kaart" aria-labelledby="kop-lijst">
        <h2 id="kop-lijst">Geïmporteerd en handmatig ({geimporteerd.length})</h2>
        {geimporteerd.length === 0 ? (
          <p className="zacht">Nog niets geïmporteerd.</p>
        ) : (
          <ul>
            {geimporteerd.map((t) => (
              <li key={t.id}>
                {t.onderwerp} <span className="zacht klein">({t.bron})</span>{' '}
                <button type="button" className="link klein" onClick={() => void verwijderEerdereTheorie(t.id)} aria-label={`${t.onderwerp} verwijderen`}>
                  verwijder
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="kaart" aria-labelledby="kop-opdrachten">
        <h2 id="kop-opdrachten">Uit je opdrachten in Verslagcoach ({uitOpdrachten.length})</h2>
        {uitOpdrachten.length === 0 ? (
          <p className="zacht">Nog geen theorie in je opdrachten.</p>
        ) : (
          <ul>
            {uitOpdrachten.map((t, i) => (
              <li key={i}>
                {t.onderwerp} <span className="zacht klein">({t.bron})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialoog open={kandidaten !== null} titel="Gevonden onderwerpen" onSluit={() => setKandidaten(null)}>
        <p className="zacht">Vink aan welke onderwerpen je al eerder hebt behandeld. Je kunt de naam nog aanpassen.</p>
        {kandidaten?.some((k) => !k.uitTheorie) && (
          <p className="melding waarschuwing">In (een deel van) de bestanden staat geen hoofdstuk "Theorie". Daarom zie je alle Kop 2's; kies zelf wat theorie was.</p>
        )}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {kandidaten?.map((k) => (
            <li key={k.sleutel} className="rij" style={{ flexWrap: 'nowrap', marginBottom: '0.4rem' }}>
              <input
                type="checkbox"
                aria-label={`${k.onderwerp} toevoegen`}
                checked={k.gekozen}
                onChange={(e) => setKandidaten((l) => l?.map((x) => (x.sleutel === k.sleutel ? { ...x, gekozen: e.target.checked } : x)) ?? null)}
              />
              <input
                type="text"
                aria-label="Naam van het onderwerp"
                value={k.onderwerp}
                onChange={(e) => setKandidaten((l) => l?.map((x) => (x.sleutel === k.sleutel ? { ...x, onderwerp: e.target.value } : x)) ?? null)}
              />
              <span className="zacht klein" style={{ whiteSpace: 'nowrap' }}>
                {k.bron}
              </span>
            </li>
          ))}
        </ul>
        <div className="rij eind">
          <button type="button" onClick={() => setKandidaten(null)}>
            Annuleren
          </button>
          <button type="button" className="primair" onClick={() => void bewaarKandidaten()} disabled={!kandidaten?.some((k) => k.gekozen)}>
            Toevoegen ({kandidaten?.filter((k) => k.gekozen).length ?? 0})
          </button>
        </div>
      </Dialoog>
    </>
  );
}
