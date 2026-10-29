// Hoofdstuk 3: Resultaat van de opdracht. Eindresultaat, testcases en reflectie.
import { useId } from 'react';
import { nieuweTestcase } from '../../../data/model';
import type { Geslaagd, Onderdeel, Opdracht, Resultaat, Testcase } from '../../../data/types';
import { Afbeeldingen, useAfbeeldingenToevoegen } from '../../components/Afbeeldingen';
import { CoachVak } from '../../components/CoachVak';
import { Tekstvak } from '../../components/Tekstvak';
import { verplaatsItem, verwijderItem, wijzigItem } from '../../lijst';

interface Props {
  opdracht: Opdracht;
  wijzig: (fn: (o: Opdracht) => Opdracht) => void;
}

function useResultaat(wijzig: Props['wijzig']) {
  return (fn: (r: Resultaat) => Resultaat) => wijzig((o) => ({ ...o, resultaat: fn(o.resultaat) }));
}

function Eindresultaat({ opdracht, wijzig }: Props) {
  const zetR = useResultaat(wijzig);
  const zet = (fn: (d: Onderdeel) => Onderdeel) => zetR((r) => ({ ...r, eindresultaat: fn(r.eindresultaat) }));
  const deel = opdracht.resultaat.eindresultaat;
  const tekstId = useId();
  const { bijPlakken } = useAfbeeldingenToevoegen((nieuw) => zet((d) => ({ ...d, afbeeldingen: [...d.afbeeldingen, ...nieuw] })));
  return (
    <section className="kaart" aria-labelledby="kop-eind" onPaste={bijPlakken}>
      <h3 id="kop-eind">3.1 Eindresultaat</h3>
      <div className="veld">
        <label htmlFor={tekstId}>
          Jouw beschrijving <span className="hulptekst">Wat is het eindresultaat? Laat met screenshots zien dat het werkt.</span>
        </label>
        <Tekstvak id={tekstId} value={deel.tekst} onChange={(e) => zet((d) => ({ ...d, tekst: e.target.value }))} rows={5} />
      </div>
      <Afbeeldingen ids={deel.afbeeldingen} onWijzig={(lijst) => zet((d) => ({ ...d, afbeeldingen: lijst }))} />
      <CoachVak
        opdracht={opdracht}
        context={() => ({ onderdeel: { soort: 'eindresultaat', titel: 'Eindresultaat', tekst: deel.tekst }, afbeeldingIds: deel.afbeeldingen })}
        antwoorden={deel.coach}
        onWijzigAntwoorden={(fn) => zet((d) => ({ ...d, coach: fn(d.coach) }))}
        vraagLabel="Vraag iets over het eindresultaat"
      />
    </section>
  );
}

function TestcaseRij({ t, index, aantal, wijzig }: { t: Testcase; index: number; aantal: number; wijzig: Props['wijzig'] }) {
  const zetR = useResultaat(wijzig);
  const zet = (patch: Partial<Testcase>) => zetR((r) => ({ ...r, testcases: wijzigItem(r.testcases, t.id, (x) => ({ ...x, ...patch })) }));
  const nr = index + 1;
  return (
    <tr>
      <td>{nr}</td>
      <td>
        <Tekstvak aria-label={`Testcase ${nr}: wat test je?`} value={t.beschrijving} onChange={(e) => zet({ beschrijving: e.target.value })} rows={2} />
      </td>
      <td>
        <Tekstvak aria-label={`Testcase ${nr}: verwacht resultaat`} value={t.verwacht} onChange={(e) => zet({ verwacht: e.target.value })} rows={2} />
      </td>
      <td>
        <Tekstvak aria-label={`Testcase ${nr}: werkelijk resultaat`} value={t.werkelijk} onChange={(e) => zet({ werkelijk: e.target.value })} rows={2} />
      </td>
      <td>
        <select aria-label={`Testcase ${nr}: geslaagd?`} value={t.geslaagd} onChange={(e) => zet({ geslaagd: e.target.value as Geslaagd })}>
          <option value="">–</option>
          <option value="ja">Ja</option>
          <option value="nee">Nee</option>
        </select>
      </td>
      <td>
        <div className="rij" style={{ flexWrap: 'nowrap' }}>
          <button type="button" className="klein" disabled={index === 0} onClick={() => zetR((r) => ({ ...r, testcases: verplaatsItem(r.testcases, index, index - 1) }))} aria-label={`Testcase ${nr} omhoog`}>
            ↑
          </button>
          <button type="button" className="klein" disabled={index === aantal - 1} onClick={() => zetR((r) => ({ ...r, testcases: verplaatsItem(r.testcases, index, index + 1) }))} aria-label={`Testcase ${nr} omlaag`}>
            ↓
          </button>
          <button type="button" className="klein gevaar" onClick={() => zetR((r) => ({ ...r, testcases: verwijderItem(r.testcases, t.id) }))} aria-label={`Testcase ${nr} verwijderen`}>
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

function Testcases({ opdracht, wijzig }: Props) {
  const zetR = useResultaat(wijzig);
  const { testcases } = opdracht.resultaat;
  return (
    <section className="kaart" aria-labelledby="kop-tests">
      <div className="kaart-kop">
        <h3 id="kop-tests">3.2 Testcases</h3>
        <button type="button" className="klein" onClick={() => zetR((r) => ({ ...r, testcases: [...r.testcases, nieuweTestcase()] }))}>
          + Testcase
        </button>
      </div>
      {testcases.length === 0 ? (
        <p className="zacht">Nog geen testcases.</p>
      ) : (
        <div className="tabel-wrap">
          <table className="testcases">
            <caption className="sr-only">Testcases met verwacht en werkelijk resultaat</caption>
            <thead>
              <tr>
                <th scope="col">Nr.</th>
                <th scope="col">Wat test je?</th>
                <th scope="col">Verwacht resultaat</th>
                <th scope="col">Werkelijk resultaat</th>
                <th scope="col">Geslaagd</th>
                <th scope="col">
                  <span className="sr-only">Acties</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {testcases.map((t, i) => (
                <TestcaseRij key={t.id} t={t} index={i} aantal={testcases.length} wijzig={wijzig} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CoachVak
        opdracht={opdracht}
        context={() => ({ onderdeel: { soort: 'testcases', titel: 'Testcases', tekst: '', testcases: opdracht.resultaat.testcases }, afbeeldingIds: [] })}
        antwoorden={opdracht.resultaat.testcasesCoach}
        onWijzigAntwoorden={(fn) => zetR((r) => ({ ...r, testcasesCoach: fn(r.testcasesCoach) }))}
        vraagLabel="Vraag iets over je testcases"
      />
    </section>
  );
}

function Reflectie({ opdracht, wijzig }: Props) {
  const zetR = useResultaat(wijzig);
  const zet = (fn: (d: Onderdeel) => Onderdeel) => zetR((r) => ({ ...r, reflectie: fn(r.reflectie) }));
  const deel = opdracht.resultaat.reflectie;
  const vragen = opdracht.resultaat.reflectievragen;
  const tekstId = useId();
  return (
    <section className="kaart" aria-labelledby="kop-reflectie">
      <h3 id="kop-reflectie">3.3 Reflectie</h3>
      {vragen.length > 0 && (
        <div className="veld">
          <div className="label">Denk na over:</div>
          <ul>
            {vragen.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="veld">
        <label htmlFor={tekstId}>
          Jouw reflectie <span className="hulptekst">Kort: wat ging goed, wat was lastig, wat doe je een volgende keer anders?</span>
        </label>
        <Tekstvak id={tekstId} value={deel.tekst} onChange={(e) => zet((d) => ({ ...d, tekst: e.target.value }))} rows={5} />
      </div>
      <CoachVak
        opdracht={opdracht}
        context={() => ({ onderdeel: { soort: 'reflectie', titel: 'Reflectie', vragen, tekst: deel.tekst }, afbeeldingIds: [] })}
        antwoorden={deel.coach}
        onWijzigAntwoorden={(fn) => zet((d) => ({ ...d, coach: fn(d.coach) }))}
        vraagLabel="Vraag iets over je reflectie"
      />
    </section>
  );
}

export function ResultaatTab(props: Props) {
  return (
    <>
      <h2>Hoofdstuk 3: Resultaat van de opdracht</h2>
      <Eindresultaat {...props} />
      <Testcases {...props} />
      <Reflectie {...props} />
    </>
  );
}
