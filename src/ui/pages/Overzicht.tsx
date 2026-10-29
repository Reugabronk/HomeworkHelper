// Overzicht van alle opdrachten, gegroepeerd per vak.
import { useEffect, useId, useMemo, useState } from 'react';
import { routeNaarHash } from '../../app/router';
import { useApp } from '../../app/context';
import { alleOpdrachten, bewaarOpdracht, bijWijziging, verwijderOpdracht } from '../../data/db';
import type { Opdracht, OpdrachtStatus } from '../../data/types';
import { berekenVoortgang } from '../../data/voortgang';

type Filter = 'alle' | OpdrachtStatus;

function datum(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export function zetIngeleverd(o: Opdracht, ingeleverd: boolean): Opdracht {
  return ingeleverd
    ? { ...o, status: 'ingeleverd', ingeleverdOp: new Date().toISOString() }
    : { ...o, status: 'bezig', ingeleverdOp: undefined };
}

function OpdrachtKaart({ o }: { o: Opdracht }) {
  const { meld } = useApp();
  const v = berekenVoortgang(o);
  const ingeleverd = o.status === 'ingeleverd';
  return (
    <article className="kaart opdracht-kaart">
      <div className="kaart-kop">
        <h3>
          <a href={routeNaarHash({ pagina: 'opdracht', id: o.id, tab: 'opdracht' })}>{o.titel || '(zonder titel)'}</a>
        </h3>
        <span className={`label-pil ${o.status}`}>{ingeleverd ? 'Ingeleverd' : 'Bezig'}</span>
      </div>
      <div className="voortgang" role="progressbar" aria-label="Voortgang van het verslag" aria-valuenow={v.procent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${v.procent}%` }} />
      </div>
      <p className="zacht klein">
        {v.klaar} van {v.totaal} onderdelen geschreven
        {ingeleverd && o.ingeleverdOp ? ` · ingeleverd op ${datum(o.ingeleverdOp)}` : ` · gewijzigd ${datum(o.gewijzigd)}`}
      </p>
      <div className="rij">
        <a className="knop klein" href={routeNaarHash({ pagina: 'opdracht', id: o.id, tab: 'opdracht' })}>
          Openen
        </a>
        <button type="button" className="klein" onClick={() => void bewaarOpdracht(zetIngeleverd(o, !ingeleverd))}>
          {ingeleverd ? 'Weer op "bezig" zetten' : 'Markeer als ingeleverd'}
        </button>
        <button
          type="button"
          className="klein gevaar"
          onClick={async () => {
            if (!window.confirm(`"${o.titel || 'Deze opdracht'}" en alle screenshots ervan verwijderen?`)) return;
            await verwijderOpdracht(o.id);
            meld('Opdracht verwijderd.');
          }}
        >
          Verwijder
        </button>
      </div>
    </article>
  );
}

export function Overzicht() {
  const [opdrachten, setOpdrachten] = useState<Opdracht[] | null>(null);
  const [filter, setFilter] = useState<Filter>('alle');
  const [zoek, setZoek] = useState('');
  const zoekId = useId();

  useEffect(() => {
    const laad = () => void alleOpdrachten().then(setOpdrachten);
    laad();
    return bijWijziging(laad);
  }, []);

  const perVak = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    const zichtbaar = (opdrachten ?? [])
      .filter((o) => filter === 'alle' || o.status === filter)
      .filter((o) => !term || `${o.titel} ${o.vak}`.toLowerCase().includes(term))
      .sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd));
    const groepen = new Map<string, Opdracht[]>();
    for (const o of zichtbaar) {
      const vak = o.vak || 'Zonder vak';
      groepen.set(vak, [...(groepen.get(vak) ?? []), o]);
    }
    return [...groepen.entries()].sort(([a], [b]) => a.localeCompare(b, 'nl'));
  }, [opdrachten, filter, zoek]);

  if (opdrachten === null) return <p className="laden">Opdrachten laden</p>;

  const aantal = (s: Filter) => (s === 'alle' ? opdrachten.length : opdrachten.filter((o) => o.status === s).length);

  return (
    <>
      <div className="paginakop">
        <div>
          <h1>Mijn opdrachten</h1>
          <p className="zacht">Jij schrijft het verslag, de coach helpt je het onderwerp te begrijpen en geeft feedback.</p>
        </div>
        <a className="knop primair" href={routeNaarHash({ pagina: 'nieuw' })}>
          + Nieuwe opdracht
        </a>
      </div>

      {opdrachten.length === 0 ? (
        <div className="kaart leeg">
          <h2>Nog geen opdrachten</h2>
          <p>Plak je eerste opdracht en laat de coach een plan maken voor je verslag.</p>
          <a className="knop primair" href={routeNaarHash({ pagina: 'nieuw' })}>
            Eerste opdracht toevoegen
          </a>
        </div>
      ) : (
        <>
          <div className="rij" style={{ marginBottom: '1rem' }}>
            <fieldset className="rij" style={{ margin: 0, padding: '0.25rem 0.5rem' }}>
              <legend className="sr-only">Toon opdrachten</legend>
              {(['alle', 'bezig', 'ingeleverd'] as const).map((f) => (
                <label key={f} className="keuze" style={{ margin: 0 }}>
                  <input type="radio" name="filter" checked={filter === f} onChange={() => setFilter(f)} />
                  {f === 'alle' ? 'Alle' : f === 'bezig' ? 'Bezig' : 'Ingeleverd'} ({aantal(f)})
                </label>
              ))}
            </fieldset>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor={zoekId} className="sr-only">
                Zoeken
              </label>
              <input id={zoekId} type="search" placeholder="Zoek op titel of vak" value={zoek} onChange={(e) => setZoek(e.target.value)} />
            </div>
          </div>
          {perVak.length === 0 && <p className="zacht">Geen opdrachten gevonden.</p>}
          {perVak.map(([vak, lijst]) => (
            <section key={vak} className="vakgroep" aria-label={`Vak ${vak}`}>
              <h2>
                {vak} <span className="zacht klein">({lijst.length})</span>
              </h2>
              <div className="raster">
                {lijst.map((o) => (
                  <OpdrachtKaart key={o.id} o={o} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
