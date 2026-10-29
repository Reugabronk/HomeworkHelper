// Hoofdstuk 2: Uitwerking van de opdracht. Per stap wat, hoe en waarom, met commando's en screenshots.
import { useEffect, useId, useMemo, useState } from 'react';
import { useApp } from '../../../app/context';
import { alleOpdrachten } from '../../../data/db';
import { kopieerStappen } from '../../../data/kopie';
import { nieuweStap } from '../../../data/model';
import type { Opdracht, Stap } from '../../../data/types';
import { Afbeeldingen, useAfbeeldingenToevoegen } from '../../components/Afbeeldingen';
import { CoachVak } from '../../components/CoachVak';
import { Dialoog } from '../../components/Dialoog';
import { Tekstvak } from '../../components/Tekstvak';
import { verplaatsItem, verwijderItem, wijzigItem } from '../../lijst';

interface Props {
  opdracht: Opdracht;
  wijzig: (fn: (o: Opdracht) => Opdracht) => void;
}

function StapKaart({ opdracht, stap, index, aantal, wijzig }: Props & { stap: Stap; index: number; aantal: number }) {
  const ids = { titel: useId(), tekst: useId(), cmd: useId() };
  const zet = (fn: (s: Stap) => Stap) => wijzig((o) => ({ ...o, stappen: wijzigItem(o.stappen, stap.id, fn) }));
  const { bijPlakken } = useAfbeeldingenToevoegen((nieuw) => zet((s) => ({ ...s, afbeeldingen: [...s.afbeeldingen, ...nieuw] })));

  return (
    <article className="kaart" onPaste={bijPlakken} aria-labelledby={ids.titel}>
      <div className="kaart-kop">
        <span className="zacht">Stap {index + 1}</span>
        <h3 style={{ flex: '1 1 200px' }}>
          <label htmlFor={ids.titel} className="sr-only">
            Titel van stap {index + 1}
          </label>
          <input id={ids.titel} type="text" value={stap.titel} placeholder="Titel van de stap" onChange={(e) => zet((s) => ({ ...s, titel: e.target.value }))} />
        </h3>
      </div>
      {stap.aanwijzing && (
        <p className="uitleg">
          <strong>Laat zien:</strong> {stap.aanwijzing}
        </p>
      )}
      <div className="veld">
        <label htmlFor={ids.tekst}>
          Jouw beschrijving
          <span className="hulptekst">Wat heb je gedaan, hoe heb je het gedaan en waarom?</span>
        </label>
        <Tekstvak id={ids.tekst} value={stap.tekst} onChange={(e) => zet((s) => ({ ...s, tekst: e.target.value }))} rows={5} />
      </div>
      <div className="veld">
        <label htmlFor={ids.cmd}>
          Commando's <span className="hulptekst">Eén commando per regel. Komt in een grijs codeblok in Word.</span>
        </label>
        <Tekstvak
          id={ids.cmd}
          className="code"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={stap.commandos}
          onChange={(e) => zet((s) => ({ ...s, commandos: e.target.value }))}
          rows={2}
        />
      </div>
      <Afbeeldingen ids={stap.afbeeldingen} onWijzig={(lijst) => zet((s) => ({ ...s, afbeeldingen: lijst }))} />
      <CoachVak
        opdracht={opdracht}
        context={() => ({
          onderdeel: { soort: 'stap', titel: stap.titel, aanwijzing: stap.aanwijzing, tekst: stap.tekst, commandos: stap.commandos },
          afbeeldingIds: stap.afbeeldingen,
        })}
        antwoorden={stap.coach}
        onWijzigAntwoorden={(fn) => zet((s) => ({ ...s, coach: fn(s.coach) }))}
      />
      <div className="rij" style={{ marginTop: '0.75rem' }}>
        <button type="button" className="klein" disabled={index === 0} onClick={() => wijzig((o) => ({ ...o, stappen: verplaatsItem(o.stappen, index, index - 1) }))} aria-label={`Stap ${index + 1} omhoog`}>
          ↑
        </button>
        <button type="button" className="klein" disabled={index === aantal - 1} onClick={() => wijzig((o) => ({ ...o, stappen: verplaatsItem(o.stappen, index, index + 1) }))} aria-label={`Stap ${index + 1} omlaag`}>
          ↓
        </button>
        <button
          type="button"
          className="klein gevaar"
          onClick={() => window.confirm(`Stap ${index + 1} verwijderen?`) && wijzig((o) => ({ ...o, stappen: verwijderItem(o.stappen, stap.id) }))}
        >
          Verwijder stap
        </button>
      </div>
    </article>
  );
}

function StappenOvernemen({ opdracht, wijzig, open, onSluit }: Props & { open: boolean; onSluit: () => void }) {
  const { meld } = useApp();
  const [andere, setAndere] = useState<Opdracht[]>([]);
  const [bronId, setBronId] = useState('');
  const [gekozen, setGekozen] = useState<Set<string>>(new Set());
  const [metAfbeeldingen, setMetAfbeeldingen] = useState(true);
  const [bezig, setBezig] = useState(false);
  const selectId = useId();

  useEffect(() => {
    if (!open) return;
    alleOpdrachten().then((lijst) => {
      const metStappen = lijst.filter((o) => o.id !== opdracht.id && o.stappen.length > 0).sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd));
      setAndere(metStappen);
      setBronId((id) => id || metStappen[0]?.id || '');
    });
  }, [open, opdracht.id]);

  const bron = useMemo(() => andere.find((o) => o.id === bronId), [andere, bronId]);
  useEffect(() => setGekozen(new Set()), [bronId]);

  const overnemen = async () => {
    if (!bron) return;
    setBezig(true);
    try {
      const kopieen = await kopieerStappen(bron.stappen.filter((s) => gekozen.has(s.id)), metAfbeeldingen);
      wijzig((o) => ({ ...o, stappen: [...o.stappen, ...kopieen] }));
      meld(`${kopieen.length} stap(pen) overgenomen. Pas ze aan waar nodig.`, 'succes');
      onSluit();
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialoog open={open} titel="Stappen overnemen uit een eerdere opdracht" onSluit={onSluit}>
      {andere.length === 0 ? (
        <p>Er zijn nog geen andere opdrachten met stappen.</p>
      ) : (
        <>
          <div className="veld">
            <label htmlFor={selectId}>Opdracht</label>
            <select id={selectId} value={bronId} onChange={(e) => setBronId(e.target.value)}>
              {andere.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.vak ? `${o.vak} – ` : ''}
                  {o.titel || '(zonder titel)'}
                </option>
              ))}
            </select>
          </div>
          {bron && (
            <fieldset>
              <legend>Welke stappen?</legend>
              <button
                type="button"
                className="link klein"
                onClick={() => setGekozen(gekozen.size === bron.stappen.length ? new Set() : new Set(bron.stappen.map((s) => s.id)))}
              >
                {gekozen.size === bron.stappen.length ? 'Niets selecteren' : 'Alles selecteren'}
              </button>
              {bron.stappen.map((s, i) => (
                <label key={s.id} className="keuze">
                  <input
                    type="checkbox"
                    checked={gekozen.has(s.id)}
                    onChange={(e) => {
                      const nieuw = new Set(gekozen);
                      if (e.target.checked) nieuw.add(s.id);
                      else nieuw.delete(s.id);
                      setGekozen(nieuw);
                    }}
                  />
                  <span>
                    Stap {i + 1}: {s.titel || '(zonder titel)'}
                    <span className="hulptekst">
                      {s.commandos.trim() ? `${s.commandos.trim().split('\n').length} commando('s)` : 'geen commando\'s'} · {s.afbeeldingen.length} screenshot(s)
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <label className="keuze">
            <input type="checkbox" checked={metAfbeeldingen} onChange={(e) => setMetAfbeeldingen(e.target.checked)} />
            Screenshots ook overnemen
          </label>
          <div className="rij eind">
            <button type="button" onClick={onSluit}>
              Annuleren
            </button>
            <button type="button" className="primair" disabled={!gekozen.size || bezig} onClick={() => void overnemen()}>
              {gekozen.size ? `${gekozen.size} stap(pen) overnemen` : 'Overnemen'}
            </button>
          </div>
        </>
      )}
    </Dialoog>
  );
}

export function UitwerkingTab({ opdracht, wijzig }: Props) {
  const [overnemenOpen, setOvernemenOpen] = useState(false);
  return (
    <>
      <div className="paginakop">
        <div>
          <h2>Hoofdstuk 2: Uitwerking van de opdracht</h2>
          <p className="zacht">Beschrijf per stap wat je deed, hoe (met commando's en screenshots) en waarom.</p>
        </div>
        <div className="rij">
          <button type="button" onClick={() => setOvernemenOpen(true)}>
            Stappen overnemen…
          </button>
          <button type="button" onClick={() => wijzig((o) => ({ ...o, stappen: [...o.stappen, nieuweStap()] }))}>
            + Stap toevoegen
          </button>
        </div>
      </div>
      {opdracht.stappen.length === 0 && (
        <p className="kaart zacht">Nog geen stappen. Laat de coach een plan maken, neem stappen over uit een eerdere opdracht of voeg zelf een stap toe.</p>
      )}
      {opdracht.stappen.map((s, i) => (
        <StapKaart key={s.id} opdracht={opdracht} wijzig={wijzig} stap={s} index={i} aantal={opdracht.stappen.length} />
      ))}
      <StappenOvernemen opdracht={opdracht} wijzig={wijzig} open={overnemenOpen} onSluit={() => setOvernemenOpen(false)} />
    </>
  );
}
