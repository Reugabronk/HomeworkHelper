// Hoofdstuk 1: Theorie. Per onderwerp uitleg om te leren, vragen, eigen tekst en coach.
import { useId } from 'react';
import { nieuwTheorieOnderwerp } from '../../../data/model';
import type { Opdracht, TheorieOnderwerp } from '../../../data/types';
import { Afbeeldingen, useAfbeeldingenToevoegen } from '../../components/Afbeeldingen';
import { CoachVak } from '../../components/CoachVak';
import { Markdown } from '../../components/Markdown';
import { Tekstvak } from '../../components/Tekstvak';
import { verplaatsItem, verwijderItem, wijzigItem } from '../../lijst';

interface Props {
  opdracht: Opdracht;
  wijzig: (fn: (o: Opdracht) => Opdracht) => void;
}

function OnderwerpKaart({
  opdracht,
  onderwerp,
  index,
  nummer,
  aantal,
  wijzig,
}: Props & { onderwerp: TheorieOnderwerp; index: number; nummer: number; aantal: number }) {
  const ids = { titel: useId(), tekst: useId() };
  const zet = (fn: (t: TheorieOnderwerp) => TheorieOnderwerp) =>
    wijzig((o) => ({ ...o, theorie: wijzigItem(o.theorie, onderwerp.id, fn) }));
  const { bijPlakken } = useAfbeeldingenToevoegen((nieuw) => zet((t) => ({ ...t, afbeeldingen: [...t.afbeeldingen, ...nieuw] })));
  const overgeslagen = onderwerp.status === 'overgeslagen';

  const acties = (
    <div className="rij">
      <button type="button" className="klein" disabled={index === 0} onClick={() => wijzig((o) => ({ ...o, theorie: verplaatsItem(o.theorie, index, index - 1) }))} aria-label={`${onderwerp.titel || 'Onderwerp'} omhoog`}>
        ↑
      </button>
      <button type="button" className="klein" disabled={index === aantal - 1} onClick={() => wijzig((o) => ({ ...o, theorie: verplaatsItem(o.theorie, index, index + 1) }))} aria-label={`${onderwerp.titel || 'Onderwerp'} omlaag`}>
        ↓
      </button>
      <button type="button" className="klein" onClick={() => zet((t) => ({ ...t, status: overgeslagen ? 'actief' : 'overgeslagen' }))}>
        {overgeslagen ? 'Toch opnemen' : 'Overslaan'}
      </button>
      <button
        type="button"
        className="klein gevaar"
        onClick={() => window.confirm(`Onderwerp "${onderwerp.titel || 'zonder titel'}" verwijderen?`) && wijzig((o) => ({ ...o, theorie: verwijderItem(o.theorie, onderwerp.id) }))}
      >
        Verwijder
      </button>
    </div>
  );

  if (overgeslagen) {
    return (
      <article className="kaart overgeslagen" aria-label={`Overgeslagen onderwerp: ${onderwerp.titel}`}>
        <div className="kaart-kop">
          <h3>{onderwerp.titel}</h3>
          <span className="label-pil waarschuwing">Overgeslagen</span>
        </div>
        <p className="zacht klein">
          {onderwerp.alBehandeldIn ? `Al behandeld in: ${onderwerp.alBehandeldIn}. ` : ''}Dit onderwerp komt niet in je verslag. Kies "Toch opnemen" als je het wel
          wilt uitleggen.
        </p>
        {onderwerp.uitleg && (
          <details className="uitleg">
            <summary>Uitleg nog eens bekijken</summary>
            <Markdown tekst={onderwerp.uitleg} />
          </details>
        )}
        {acties}
      </article>
    );
  }

  return (
    <article className="kaart" onPaste={bijPlakken} aria-labelledby={ids.titel}>
      <div className="kaart-kop">
        <span className="zacht">1.{nummer}</span>
        <h3 style={{ flex: '1 1 200px' }}>
          <label htmlFor={ids.titel} className="sr-only">
            Titel van het onderwerp
          </label>
          <input id={ids.titel} type="text" value={onderwerp.titel} placeholder="Titel van het onderwerp" onChange={(e) => zet((t) => ({ ...t, titel: e.target.value }))} />
        </h3>
      </div>
      {onderwerp.uitleg && (
        <details className="uitleg">
          <summary>Uitleg om te leren</summary>
          <Markdown tekst={onderwerp.uitleg} />
          <p className="zacht klein">Dit is leerstof. Schrijf je verslag in je eigen woorden.</p>
        </details>
      )}
      {onderwerp.vragen.length > 0 && (
        <div className="veld">
          <div className="label">Beantwoord in je tekst:</div>
          <ul>
            {onderwerp.vragen.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="veld">
        <label htmlFor={ids.tekst}>
          Jouw tekst
          <span className="hulptekst">Leg in je eigen woorden uit wat het is en waarom je het nodig hebt in deze opdracht.</span>
        </label>
        <Tekstvak id={ids.tekst} value={onderwerp.tekst} onChange={(e) => zet((t) => ({ ...t, tekst: e.target.value }))} rows={6} />
      </div>
      <Afbeeldingen ids={onderwerp.afbeeldingen} onWijzig={(lijst) => zet((t) => ({ ...t, afbeeldingen: lijst }))} titel="Afbeeldingen" />
      <CoachVak
        opdracht={opdracht}
        context={() => ({
          onderdeel: { soort: 'theorie', titel: onderwerp.titel, aanwijzing: onderwerp.uitleg, vragen: onderwerp.vragen, tekst: onderwerp.tekst },
          afbeeldingIds: onderwerp.afbeeldingen,
        })}
        antwoorden={onderwerp.coach}
        onWijzigAntwoorden={(fn) => zet((t) => ({ ...t, coach: fn(t.coach) }))}
        vraagLabel="Vraag iets over dit onderwerp"
      />
      <div style={{ marginTop: '0.75rem' }}>{acties}</div>
    </article>
  );
}

export function TheorieTab({ opdracht, wijzig }: Props) {
  const actief = opdracht.theorie.filter((t) => t.status === 'actief');
  const overgeslagen = opdracht.theorie.filter((t) => t.status === 'overgeslagen');
  const indexVan = (t: TheorieOnderwerp) => opdracht.theorie.indexOf(t);

  return (
    <>
      <div className="paginakop">
        <div>
          <h2>Hoofdstuk 1: Theorie</h2>
          <p className="zacht">Alleen theorie die nieuw is ten opzichte van je eerdere opdrachten.</p>
        </div>
        <button type="button" onClick={() => wijzig((o) => ({ ...o, theorie: [...o.theorie, nieuwTheorieOnderwerp()] }))}>
          + Onderwerp toevoegen
        </button>
      </div>
      {opdracht.theorie.length === 0 && (
        <p className="kaart zacht">Nog geen onderwerpen. Laat de coach een plan maken op het tabblad "Opdracht", of voeg zelf een onderwerp toe.</p>
      )}
      {actief.map((t, i) => (
        <OnderwerpKaart key={t.id} opdracht={opdracht} wijzig={wijzig} onderwerp={t} index={indexVan(t)} nummer={i + 1} aantal={opdracht.theorie.length} />
      ))}
      {overgeslagen.length > 0 && (
        <section aria-labelledby="kop-overgeslagen">
          <h3 id="kop-overgeslagen">Overgeslagen ({overgeslagen.length})</h3>
          {overgeslagen.map((t) => (
            <OnderwerpKaart key={t.id} opdracht={opdracht} wijzig={wijzig} onderwerp={t} index={indexVan(t)} nummer={0} aantal={opdracht.theorie.length} />
          ))}
        </section>
      )}
    </>
  );
}
