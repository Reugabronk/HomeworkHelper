// Een nieuwe opdracht toevoegen: opdracht plakken (tekst + afbeeldingen).
import { useEffect, useId, useState } from 'react';
import { ga } from '../../app/router';
import { useApp } from '../../app/context';
import { alleOpdrachten, bewaarOpdracht } from '../../data/db';
import { nieuweOpdracht } from '../../data/model';
import type { Diepgang } from '../../data/types';
import { Afbeeldingen, useAfbeeldingenToevoegen } from '../components/Afbeeldingen';
import { DiepgangKeuze } from '../components/DiepgangKeuze';
import { Tekstvak } from '../components/Tekstvak';

export const START_PLAN_SLEUTEL = 'verslagcoach.startPlan';

export function NieuweOpdracht() {
  const { heeftSleutel } = useApp();
  const [vak, setVak] = useState('');
  const [titel, setTitel] = useState('');
  const [tekst, setTekst] = useState('');
  const [afbeeldingen, setAfbeeldingen] = useState<string[]>([]);
  const [diepgang, setDiepgang] = useState<Diepgang>('basis');
  const [vakken, setVakken] = useState<string[]>([]);
  const [fout, setFout] = useState('');
  const ids = { vak: useId(), titel: useId(), tekst: useId(), lijst: useId() };
  const { bijPlakken } = useAfbeeldingenToevoegen((nieuw) => setAfbeeldingen((a) => [...a, ...nieuw]));

  useEffect(() => {
    alleOpdrachten().then((o) => setVakken([...new Set(o.map((x) => x.vak).filter(Boolean))].sort()));
  }, []);

  const opslaan = async (metPlan: boolean) => {
    if (!vak.trim()) return setFout('Vul het vak in.');
    if (!tekst.trim() && afbeeldingen.length === 0) return setFout('Plak de opdrachttekst of voeg een afbeelding van de opdracht toe.');
    const o = nieuweOpdracht({ vak, titel, opdrachtTekst: tekst.trim(), opdrachtAfbeeldingen: afbeeldingen, diepgang });
    await bewaarOpdracht(o);
    if (metPlan) sessionStorage.setItem(START_PLAN_SLEUTEL, o.id);
    ga({ pagina: 'opdracht', id: o.id, tab: 'opdracht' });
  };

  return (
    <>
      <h1>Nieuwe opdracht</h1>
      <form
        className="kaart"
        onSubmit={(e) => {
          e.preventDefault();
          void opslaan(heeftSleutel);
        }}
        onPaste={bijPlakken}
        noValidate
      >
        <div className="veld">
          <label htmlFor={ids.vak}>Vak</label>
          <input id={ids.vak} type="text" list={ids.lijst} value={vak} onChange={(e) => setVak(e.target.value)} required autoComplete="off" />
          <datalist id={ids.lijst}>
            {vakken.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
        <div className="veld">
          <label htmlFor={ids.titel}>
            Titel van de opdracht <span className="hulptekst">Optioneel: laat leeg en de coach bedenkt een titel.</span>
          </label>
          <input id={ids.titel} type="text" value={titel} onChange={(e) => setTitel(e.target.value)} />
        </div>
        <div className="veld">
          <label htmlFor={ids.tekst}>
            Opdrachttekst
            <span className="hulptekst">Plak hier de hele opdracht. Afbeeldingen uit de opdracht kun je ook plakken (Ctrl+V).</span>
          </label>
          <Tekstvak id={ids.tekst} value={tekst} onChange={(e) => setTekst(e.target.value)} rows={8} />
        </div>
        <div className="veld">
          <Afbeeldingen ids={afbeeldingen} onWijzig={setAfbeeldingen} titel="Afbeeldingen bij de opdracht (optioneel)" />
        </div>
        <DiepgangKeuze waarde={diepgang} onWijzig={setDiepgang} naam="diepgang-nieuw" />
        {fout && (
          <p className="melding fout" role="alert">
            {fout}
          </p>
        )}
        {!heeftSleutel && (
          <p className="melding waarschuwing">
            Je hebt nog geen API-sleutel ingevuld. Je kunt de opdracht wel opslaan; het plan maak je later. <a href="#/instellingen">Naar Instellingen</a>
          </p>
        )}
        <div className="rij">
          {heeftSleutel && (
            <button type="submit" className="primair">
              Opslaan en plan laten maken
            </button>
          )}
          <button type="button" className={heeftSleutel ? '' : 'primair'} onClick={() => void opslaan(false)}>
            Alleen opslaan
          </button>
        </div>
      </form>
    </>
  );
}
