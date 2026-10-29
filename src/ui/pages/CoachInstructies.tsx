// Pagina "Coach-instructies": strengheid, niveau, taal, eigen instructies en maatstaf.
import { useId, useState } from 'react';
import { useApp } from '../../app/context';
import { bouwSysteemPrompt, type CoachTaak } from '../../ai/prompts';
import {
  NIVEAUS,
  STANDAARD_COACH_INSTELLINGEN,
  STRENGHEID,
  TAALNIVEAUS,
  VASTE_REGEL,
  type CoachInstellingen,
  type Niveau,
  type Strengheid,
  type Taalniveau,
} from '../../ai/standaard-instructies';
import { wordNaarTekst } from '../../docx/import';
import { Tekstvak } from '../components/Tekstvak';

const TAAK_NAMEN: Record<CoachTaak, string> = {
  feedback: 'Feedback op mijn tekst',
  opweg: 'Help me op weg',
  vraag: 'Vraag over een onderdeel',
  chat: 'Coach-chat',
  plan: 'Plan maken',
};

export function CoachInstructies() {
  const { instellingen, wijzigInstellingen, meld } = useApp();
  const coach = instellingen.coach;
  const [voorbeeldTaak, setVoorbeeldTaak] = useState<CoachTaak>('feedback');
  const ids = { niveau: useId(), taal: useId(), taalniveau: useId(), eigen: useId(), maatstaf: useId(), taak: useId(), talen: useId() };

  const zet = <K extends keyof CoachInstellingen>(veld: K, waarde: CoachInstellingen[K]) =>
    wijzigInstellingen((i) => ({ ...i, coach: { ...i.coach, [veld]: waarde } }));

  return (
    <>
      <h1>Coach-instructies</h1>
      <p className="zacht">Hier bepaal je hoe de coach met je praat en hoe streng hij is. Alle prompts worden uit deze instellingen opgebouwd.</p>

      <section className="kaart" aria-labelledby="kop-vast">
        <h2 id="kop-vast">Vaste regel (staat altijd aan)</h2>
        <pre className="klein">{VASTE_REGEL}</pre>
      </section>

      <section className="kaart" aria-labelledby="kop-strengheid">
        <h2 id="kop-strengheid">Strengheid</h2>
        <fieldset>
          <legend className="sr-only">Strengheid</legend>
          {(Object.keys(STRENGHEID) as Strengheid[]).map((s) => (
            <div key={s}>
              <label className="keuze">
                <input type="radio" name="strengheid" checked={coach.strengheid === s} onChange={() => zet('strengheid', s)} />
                <strong>{STRENGHEID[s].label}</strong>
              </label>
              <details style={{ marginLeft: '1.6rem' }}>
                <summary className="klein">Bekijk de tekst van deze preset</summary>
                <p className="klein uitleg">{STRENGHEID[s].tekst}</p>
              </details>
            </div>
          ))}
        </fieldset>
      </section>

      <section className="kaart" aria-labelledby="kop-niveau">
        <h2 id="kop-niveau">Niveau en taal</h2>
        <div className="raster" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="veld">
            <label htmlFor={ids.niveau}>
              Onderwijsniveau <span className="hulptekst">Bepaalt diepgang en wat de coach van je verwacht.</span>
            </label>
            <select id={ids.niveau} value={coach.niveau} onChange={(e) => zet('niveau', e.target.value as Niveau)}>
              {(Object.keys(NIVEAUS) as Niveau[]).map((n) => (
                <option key={n} value={n}>
                  {NIVEAUS[n].label}
                </option>
              ))}
            </select>
          </div>
          <div className="veld">
            <label htmlFor={ids.taal}>
              Taal <span className="hulptekst">In welke taal antwoordt de coach?</span>
            </label>
            <input id={ids.taal} type="text" list={ids.talen} value={coach.taal} onChange={(e) => zet('taal', e.target.value)} onBlur={(e) => !e.target.value.trim() && zet('taal', 'Nederlands')} />
            <datalist id={ids.talen}>
              {['Nederlands', 'Engels', 'Duits', 'Frans', 'Spaans', 'Turks', 'Arabisch', 'Pools'].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div className="veld">
            <label htmlFor={ids.taalniveau}>
              Taalniveau <span className="hulptekst">Standaard B1: eenvoudig en duidelijk.</span>
            </label>
            <select id={ids.taalniveau} value={coach.taalniveau} onChange={(e) => zet('taalniveau', e.target.value as Taalniveau)}>
              {(Object.keys(TAALNIVEAUS) as Taalniveau[]).map((t) => (
                <option key={t} value={t}>
                  {TAALNIVEAUS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="kaart" aria-labelledby="kop-eigen">
        <h2 id="kop-eigen">Eigen instructies</h2>
        <label htmlFor={ids.eigen}>
          Wat moet de coach nog meer weten of anders doen?
          <span className="hulptekst">Bijvoorbeeld: "Noem spelfouten niet", "Mijn docent wil bronvermelding in APA-stijl", "Geef maximaal drie verbeterpunten".</span>
        </label>
        <Tekstvak id={ids.eigen} value={coach.eigenInstructies} onChange={(e) => zet('eigenInstructies', e.target.value)} rows={4} />
      </section>

      <section className="kaart" aria-labelledby="kop-maatstaf">
        <h2 id="kop-maatstaf">Maatstaf (optioneel)</h2>
        <label htmlFor={ids.maatstaf}>
          Voorbeeldtekst van een voldoende verslag
          <span className="hulptekst">De coach gebruikt dit alleen om het verwachte niveau te bepalen. Hij neemt er geen tekst uit over.</span>
        </label>
        <Tekstvak id={ids.maatstaf} value={coach.maatstaf} onChange={(e) => zet('maatstaf', e.target.value)} rows={6} />
          <div className="rij" style={{ marginTop: '0.5rem' }}>
            <label className="knop klein" style={{ fontWeight: 400, marginBottom: 0 }}>
              Tekst uit Word-bestand halen…
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    zet('maatstaf', await wordNaarTekst(await f.arrayBuffer()));
                    meld('Tekst uit het Word-bestand overgenomen.', 'succes');
                  } catch (fout) {
                    meld(fout instanceof Error ? fout.message : 'Kon het bestand niet lezen.', 'fout');
                  }
                }}
              />
            </label>
            {coach.maatstaf && <span className="zacht klein">{coach.maatstaf.length.toLocaleString('nl-NL')} tekens</span>}
          </div>
      </section>

      <section className="kaart" aria-labelledby="kop-voorbeeld">
        <h2 id="kop-voorbeeld">Zo ziet de instructie aan de coach eruit</h2>
        <div className="veld">
          <label htmlFor={ids.taak}>Voor de functie</label>
          <select id={ids.taak} value={voorbeeldTaak} onChange={(e) => setVoorbeeldTaak(e.target.value as CoachTaak)} style={{ maxWidth: '20rem' }}>
            {(Object.keys(TAAK_NAMEN) as CoachTaak[]).map((t) => (
              <option key={t} value={t}>
                {TAAK_NAMEN[t]}
              </option>
            ))}
          </select>
        </div>
        <details>
          <summary>Volledige instructie tonen</summary>
          <pre className="klein">{bouwSysteemPrompt(coach, voorbeeldTaak)}</pre>
        </details>
      </section>

      <div className="rij">
        <button
          type="button"
          className="gevaar"
          onClick={() => {
            if (!window.confirm('Alle coach-instructies terugzetten naar de standaard? Je eigen instructies en maatstaf worden gewist.')) return;
            wijzigInstellingen((i) => ({ ...i, coach: { ...STANDAARD_COACH_INSTELLINGEN } }));
            meld('Coach-instructies teruggezet naar de standaard.', 'succes');
          }}
        >
          Terug naar standaard
        </button>
      </div>
    </>
  );
}
