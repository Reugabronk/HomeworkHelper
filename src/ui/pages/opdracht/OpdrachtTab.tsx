// Tabblad "Opdracht": opdrachttekst, afbeeldingen, diepgang en het plan laten maken.
import { useEffect, useId } from 'react';
import { useApp } from '../../../app/context';
import { routeNaarHash } from '../../../app/router';
import { maakPlan } from '../../../ai/coach';
import { pasPlanToe } from '../../../ai/plan';
import type { Opdracht } from '../../../data/types';
import { AiFoutmelding } from '../../components/AiFoutmelding';
import { Afbeeldingen, useAfbeeldingenToevoegen } from '../../components/Afbeeldingen';
import { DiepgangKeuze } from '../../components/DiepgangKeuze';
import { Markdown } from '../../components/Markdown';
import { Tekstvak } from '../../components/Tekstvak';
import { useAiVerzoek } from '../../components/useAiVerzoek';
import { zetIngeleverd } from '../Overzicht';
import { START_PLAN_SLEUTEL } from '../NieuweOpdracht';

interface Props {
  opdracht: Opdracht;
  wijzig: (fn: (o: Opdracht) => Opdracht) => void;
}

export function OpdrachtTab({ opdracht, wijzig }: Props) {
  const { omgeving, heeftSleutel, meld } = useApp();
  const { bezig, liveTekst, fout, foutInInstellingen, voerUit, stop } = useAiVerzoek();
  const ids = { vak: useId(), titel: useId(), tekst: useId() };
  const { bijPlakken } = useAfbeeldingenToevoegen((nieuw) =>
    wijzig((o) => ({ ...o, opdrachtAfbeeldingen: [...o.opdrachtAfbeeldingen, ...nieuw] })),
  );

  const heeftPlan = Boolean(opdracht.planGemaaktOp);

  const startPlan = async () => {
    const resultaat = await voerUit((opties) => maakPlan(omgeving, opdracht, opties));
    if (!resultaat) return;
    wijzig((o) => pasPlanToe(o, resultaat.plan, resultaat.bekend));
    const overgeslagen = resultaat.plan.theorie.filter((t) => t.alBehandeld).length;
    meld(
      `Plan klaar: ${resultaat.plan.theorie.length} theorie-onderwerpen${overgeslagen ? ` (${overgeslagen} al eerder behandeld)` : ''}, ${resultaat.plan.stappen.length} stappen en ${resultaat.plan.testcases.length} testcases.`,
      'succes',
    );
  };

  // Direct starten als de student op "Opslaan en plan laten maken" klikte.
  useEffect(() => {
    if (sessionStorage.getItem(START_PLAN_SLEUTEL) === opdracht.id) {
      sessionStorage.removeItem(START_PLAN_SLEUTEL);
      void startPlan();
    }
  }, [opdracht.id]);

  const aantalActief = opdracht.theorie.filter((t) => t.status === 'actief').length;
  const aantalOvergeslagen = opdracht.theorie.length - aantalActief;

  return (
    <>
      <section className="kaart" aria-labelledby="kop-opdracht" onPaste={bijPlakken}>
        <h2 id="kop-opdracht">De opdracht</h2>
        <div className="raster" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="veld">
            <label htmlFor={ids.vak}>Vak</label>
            <input id={ids.vak} type="text" value={opdracht.vak} onChange={(e) => wijzig((o) => ({ ...o, vak: e.target.value }))} />
          </div>
          <div className="veld">
            <label htmlFor={ids.titel}>Titel</label>
            <input id={ids.titel} type="text" value={opdracht.titel} onChange={(e) => wijzig((o) => ({ ...o, titel: e.target.value }))} />
          </div>
        </div>
        <div className="veld">
          <label htmlFor={ids.tekst}>Opdrachttekst</label>
          <Tekstvak id={ids.tekst} value={opdracht.opdrachtTekst} onChange={(e) => wijzig((o) => ({ ...o, opdrachtTekst: e.target.value }))} rows={6} />
        </div>
        <Afbeeldingen
          ids={opdracht.opdrachtAfbeeldingen}
          onWijzig={(lijst) => wijzig((o) => ({ ...o, opdrachtAfbeeldingen: lijst }))}
          titel="Afbeeldingen bij de opdracht"
        />
        <div className="rij" style={{ marginTop: '1rem' }}>
          <label className="keuze" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={opdracht.status === 'ingeleverd'}
              onChange={(e) => wijzig((o) => zetIngeleverd(o, e.target.checked))}
            />
            Ingeleverd
          </label>
        </div>
      </section>

      <section className="kaart" aria-labelledby="kop-plan">
        <h2 id="kop-plan">Plan van de coach</h2>
        <p className="zacht">
          De coach leest de opdracht en zet klaar: theorie-onderwerpen (met uitleg om te leren en vragen), stappen voor hoofdstuk 2,
          testcases en reflectievragen. Theorie die je al in eerdere opdrachten hebt behandeld, wordt standaard overgeslagen.
        </p>
        <DiepgangKeuze waarde={opdracht.diepgang} onWijzig={(d) => wijzig((o) => ({ ...o, diepgang: d }))} naam={`diepgang-${opdracht.id}`} />
        <div className="rij">
          <button
            type="button"
            className="primair"
            disabled={bezig || !heeftSleutel}
            onClick={() => {
              if (heeftPlan && !window.confirm('Plan opnieuw maken? Onderdelen waar je al aan gewerkt hebt blijven staan; lege onderdelen worden vervangen.')) return;
              void startPlan();
            }}
          >
            {heeftPlan ? 'Plan opnieuw maken' : 'Plan laten maken'}
          </button>
          {bezig && (
            <button type="button" onClick={stop}>
              Stop
            </button>
          )}
          {!heeftSleutel && (
            <span className="zacht klein">
              Vul eerst je API-sleutel in bij <a href={routeNaarHash({ pagina: 'instellingen' })}>Instellingen</a>.
            </span>
          )}
        </div>
        <AiFoutmelding fout={fout} inInstellingen={foutInInstellingen} />
        {bezig && (
          <p className="laden" role="status">
            De coach maakt een plan{liveTekst ? ` (${liveTekst.length} tekens ontvangen)` : ''}
          </p>
        )}
        {heeftPlan && !bezig && (
          <div className="stapel" style={{ marginTop: '1rem' }}>
            {opdracht.samenvatting && (
              <div className="uitleg">
                <strong>Waar gaat de opdracht over?</strong>
                <Markdown tekst={opdracht.samenvatting} />
              </div>
            )}
            <ul>
              <li>
                <a href={routeNaarHash({ pagina: 'opdracht', id: opdracht.id, tab: 'theorie' })}>Hoofdstuk 1: Theorie</a> – {aantalActief} onderwerp(en)
                {aantalOvergeslagen > 0 && `, ${aantalOvergeslagen} overgeslagen omdat je ze al eerder behandelde`}
              </li>
              <li>
                <a href={routeNaarHash({ pagina: 'opdracht', id: opdracht.id, tab: 'uitwerking' })}>Hoofdstuk 2: Uitwerking</a> – {opdracht.stappen.length} stap(pen)
              </li>
              <li>
                <a href={routeNaarHash({ pagina: 'opdracht', id: opdracht.id, tab: 'resultaat' })}>Hoofdstuk 3: Resultaat</a> – {opdracht.resultaat.testcases.length} testcase(s),{' '}
                {opdracht.resultaat.reflectievragen.length} reflectievraag/-vragen
              </li>
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
