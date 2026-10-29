// Instellingen: profiel (voorblad), eigen AI-sleutel, thema, Word-sjabloon en gegevens.
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../app/context';
import { AANBIEDERS, foutMelding, type ModelInfo } from '../../ai/providers';
import { maakBackupBestand, zetBackupTerug } from '../../data/backup';
import { wisAlles } from '../../data/db';
import { MAX_AFBEELDINGEN_GRENS, maskeerSleutel, wisSleutels, type AanbiederId, type Thema } from '../../data/settings';
import { WordSjabloon } from '../components/WordSjabloon';
import { downloadBestand } from '../download';

function Sectie({ id, titel, children }: { id: string; titel: string; children: ReactNode }) {
  return (
    <section className="kaart" aria-labelledby={id}>
      <h2 id={id}>{titel}</h2>
      {children}
    </section>
  );
}

function Profiel() {
  const { instellingen, wijzigInstellingen } = useApp();
  const ids = { naam: useId(), klas: useId(), school: useId() };
  const zet = (veld: 'naam' | 'klas' | 'school', waarde: string) =>
    wijzigInstellingen((i) => ({ ...i, profiel: { ...i.profiel, [veld]: waarde } }));
  return (
    <Sectie id="kop-profiel" titel="Jouw gegevens">
      <p className="zacht">Deze gegevens komen op het voorblad en in de koptekst van je Word-verslag.</p>
      <div className="raster" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="veld">
          <label htmlFor={ids.naam}>Naam</label>
          <input id={ids.naam} type="text" autoComplete="name" value={instellingen.profiel.naam} onChange={(e) => zet('naam', e.target.value)} />
        </div>
        <div className="veld">
          <label htmlFor={ids.klas}>Klas</label>
          <input id={ids.klas} type="text" value={instellingen.profiel.klas} onChange={(e) => zet('klas', e.target.value)} />
        </div>
        <div className="veld">
          <label htmlFor={ids.school}>School</label>
          <input id={ids.school} type="text" autoComplete="organization" value={instellingen.profiel.school} onChange={(e) => zet('school', e.target.value)} />
        </div>
      </div>
    </Sectie>
  );
}

function AiSleutel() {
  const { instellingen, wijzigInstellingen, sleutels, zetSleutel, omgeving, meld } = useApp();
  const aanbieder = instellingen.ai.aanbieder;
  const beschrijving = AANBIEDERS[aanbieder];
  const opgeslagenSleutel = sleutels[aanbieder] ?? '';
  const [invoer, setInvoer] = useState('');
  const [toon, setToon] = useState(false);
  const [modellen, setModellen] = useState<Partial<Record<AanbiederId, ModelInfo[]>>>({});
  const [bezig, setBezig] = useState<'' | 'modellen' | 'test'>('');
  const [testUitslag, setTestUitslag] = useState<{ ok: boolean; tekst: string } | null>(null);
  const ids = { aanbieder: useId(), sleutel: useId(), model: useId(), eigenModel: useId(), url: useId(), max: useId() };

  const model = instellingen.ai.model[aanbieder];
  const opties = useMemo(() => {
    const lijst = modellen[aanbieder] ?? beschrijving.bekendeModellen;
    return model && !lijst.some((m) => m.id === model) ? [{ id: model, naam: model }, ...lijst] : lijst;
  }, [modellen, aanbieder, beschrijving, model]);

  const zetModel = (id: string) => wijzigInstellingen((i) => ({ ...i, ai: { ...i.ai, model: { ...i.ai.model, [aanbieder]: id } } }));

  const maakAanbieder = () => {
    const sleutel = invoer.trim() || opgeslagenSleutel;
    return beschrijving.maak({ sleutel, model, baseUrl: instellingen.ai.baseUrl });
  };

  const haalModellen = async () => {
    setBezig('modellen');
    setTestUitslag(null);
    try {
      const lijst = await maakAanbieder().lijstModellen();
      setModellen((m) => ({ ...m, [aanbieder]: lijst }));
      meld(`${lijst.length} modellen gevonden.`, 'succes');
      if (!model && lijst[0]) zetModel(lijst[0].id);
    } catch (fout) {
      setTestUitslag({ ok: false, tekst: foutMelding(fout) });
    } finally {
      setBezig('');
    }
  };

  const test = async () => {
    setBezig('test');
    setTestUitslag(null);
    try {
      setTestUitslag({ ok: true, tekst: await maakAanbieder().test() });
    } catch (fout) {
      setTestUitslag({ ok: false, tekst: foutMelding(fout) });
    } finally {
      setBezig('');
    }
  };

  const bewaar = () => {
    if (!invoer.trim()) return;
    zetSleutel(aanbieder, invoer);
    setInvoer('');
    setToon(false);
    meld('Sleutel opgeslagen op dit apparaat.', 'succes');
  };

  return (
    <Sectie id="kop-ai" titel="AI-coach: jouw eigen sleutel">
      <div className="melding">
        <p>
          <strong>Hoe werkt dit?</strong> Verslagcoach heeft geen eigen AI-account. Je gebruikt je <strong>eigen API-sleutel</strong> van een AI-aanbieder.
        </p>
        <ul style={{ margin: 0 }}>
          <li>Je sleutel blijft <strong>alleen op dit apparaat</strong>, in deze browser. Hij wordt nergens anders opgeslagen en gaat niet mee in back-ups of Word-bestanden.</li>
          <li>De app stuurt je vragen, teksten en screenshots rechtstreeks van jouw browser naar de AI-aanbieder. Er zit geen server van Verslagcoach tussen.</li>
          <li>Het gebruik wordt <strong>afgerekend op jouw eigen account</strong> bij de aanbieder. Stel daar eventueel een maximumbedrag in.</li>
          <li>Gebruik je een gedeelde computer? Wis dan je sleutel als je klaar bent.</li>
        </ul>
      </div>

      <div className="veld" style={{ marginTop: '1rem' }}>
        <label htmlFor={ids.aanbieder}>Aanbieder</label>
        <select
          id={ids.aanbieder}
          value={aanbieder}
          onChange={(e) => {
            setTestUitslag(null);
            setInvoer('');
            wijzigInstellingen((i) => ({ ...i, ai: { ...i.ai, aanbieder: e.target.value as AanbiederId } }));
          }}
        >
          {Object.values(AANBIEDERS).map((a) => (
            <option key={a.id} value={a.id}>
              {a.naam}
            </option>
          ))}
        </select>
        <span className="hulptekst">
          {beschrijving.uitleg}{' '}
          {beschrijving.sleutelUrl && (
            <a href={beschrijving.sleutelUrl} target="_blank" rel="noreferrer noopener">
              Sleutel aanmaken
            </a>
          )}
        </span>
      </div>

      {beschrijving.heeftBaseUrl && (
        <div className="veld">
          <label htmlFor={ids.url}>Basis-URL van de API</label>
          <input
            id={ids.url}
            type="url"
            inputMode="url"
            placeholder="https://api.openai.com/v1"
            value={instellingen.ai.baseUrl}
            onChange={(e) => wijzigInstellingen((i) => ({ ...i, ai: { ...i.ai, baseUrl: e.target.value } }))}
          />
          <span className="hulptekst">Bijvoorbeeld https://api.openai.com/v1, https://openrouter.ai/api/v1 of http://localhost:11434/v1 (Ollama).</span>
        </div>
      )}

      <div className="veld">
        <label htmlFor={ids.sleutel}>
          API-sleutel
          <span className="hulptekst">{opgeslagenSleutel ? `Opgeslagen: ${maskeerSleutel(opgeslagenSleutel)}. Vul een nieuwe in om hem te vervangen.` : 'Nog geen sleutel opgeslagen.'}</span>
        </label>
        <div className="rij" style={{ flexWrap: 'nowrap' }}>
          <input
            id={ids.sleutel}
            type={toon ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder={beschrijving.sleutelVoorbeeld}
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && bewaar()}
          />
          <button type="button" onClick={() => setToon((t) => !t)} aria-pressed={toon}>
            {toon ? 'Verberg' : 'Toon'}
          </button>
        </div>
        <div className="rij" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="primair" onClick={bewaar} disabled={!invoer.trim()}>
            Sleutel opslaan
          </button>
          {opgeslagenSleutel && (
            <button
              type="button"
              className="gevaar"
              onClick={() => {
                if (!window.confirm('Sleutel van dit apparaat wissen?')) return;
                zetSleutel(aanbieder, '');
                meld('Sleutel gewist.');
              }}
            >
              Sleutel wissen
            </button>
          )}
        </div>
      </div>

      <div className="veld">
        <label htmlFor={ids.model}>Model</label>
        <div className="rij" style={{ flexWrap: 'nowrap' }}>
          <select id={ids.model} value={model} onChange={(e) => zetModel(e.target.value)}>
            {!model && <option value="">Kies een model…</option>}
            {opties.map((m) => (
              <option key={m.id} value={m.id}>
                {m.naam !== m.id ? `${m.naam} – ${m.id}` : m.id}
                {m.afbeeldingen === false ? ' (geen afbeeldingen)' : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void haalModellen()} disabled={bezig !== ''}>
            {bezig === 'modellen' ? <span className="laden">Ophalen</span> : 'Modellen ophalen'}
          </button>
        </div>
        <span className="hulptekst">
          Grotere modellen geven betere feedback maar kosten meer per vraag. "Modellen ophalen" toont alle modellen die jouw sleutel mag gebruiken.
        </span>
        <details style={{ marginTop: '0.4rem' }}>
          <summary className="klein">Ander model invullen</summary>
          <label htmlFor={ids.eigenModel} className="sr-only">
            Model-id
          </label>
          <input id={ids.eigenModel} type="text" spellCheck={false} placeholder="model-id" value={model} onChange={(e) => zetModel(e.target.value.trim())} />
        </details>
      </div>

      <div className="veld">
        <label htmlFor={ids.max}>
          Maximaal aantal afbeeldingen per verzoek
          <span className="hulptekst">Meer afbeeldingen = betere feedback op screenshots, maar ook duurder. Zet op 0 als je model geen afbeeldingen ondersteunt.</span>
        </label>
        <input
          id={ids.max}
          type="number"
          min={0}
          max={MAX_AFBEELDINGEN_GRENS}
          style={{ maxWidth: '8rem' }}
          value={instellingen.ai.maxAfbeeldingen}
          onChange={(e) =>
            wijzigInstellingen((i) => ({
              ...i,
              ai: { ...i.ai, maxAfbeeldingen: Math.max(0, Math.min(MAX_AFBEELDINGEN_GRENS, Number(e.target.value) || 0)) },
            }))
          }
        />
      </div>

      <div className="rij">
        <button type="button" onClick={() => void test()} disabled={bezig !== '' || !(invoer.trim() || omgeving.sleutels[aanbieder] || beschrijving.heeftBaseUrl)}>
          {bezig === 'test' ? <span className="laden">Testen</span> : 'Test verbinding'}
        </button>
        {invoer.trim() && <span className="zacht klein">De test gebruikt de sleutel die je net hebt ingevuld (nog niet opgeslagen).</span>}
      </div>
      <div aria-live="polite">
        {testUitslag && (
          <p className={`melding ${testUitslag.ok ? 'succes' : 'fout'}`} role={testUitslag.ok ? 'status' : 'alert'}>
            {testUitslag.tekst}
          </p>
        )}
      </div>
    </Sectie>
  );
}

function ThemaKeuze() {
  const { instellingen, wijzigInstellingen } = useApp();
  const opties: [Thema, string][] = [
    ['auto', 'Automatisch (zoals je apparaat)'],
    ['licht', 'Licht'],
    ['donker', 'Donker'],
  ];
  return (
    <Sectie id="kop-thema" titel="Weergave">
      <fieldset>
        <legend>Thema</legend>
        {opties.map(([w, label]) => (
          <label key={w} className="keuze">
            <input type="radio" name="thema" checked={instellingen.thema === w} onChange={() => wijzigInstellingen((i) => ({ ...i, thema: w }))} />
            {label}
          </label>
        ))}
      </fieldset>
    </Sectie>
  );
}

function Gegevens() {
  const { instellingen, wijzigInstellingen, meld } = useApp();
  const invoer = useRef<HTMLInputElement>(null);
  const [vervangen, setVervangen] = useState(true);

  const maakBackup = async () => {
    const blob = await maakBackupBestand(instellingen);
    downloadBestand(blob, `verslagcoach-backup-${new Date().toISOString().slice(0, 10)}.json`);
    meld('Back-up gedownload. Je API-sleutel zit er niet in.', 'succes');
  };

  const terugzetten = async (bestand: File) => {
    const tekst = await bestand.text();
    if (vervangen && !window.confirm('Al je huidige opdrachten worden vervangen door de back-up. Doorgaan?')) return;
    try {
      const nieuweInstellingen = await zetBackupTerug(tekst, vervangen);
      wijzigInstellingen(() => nieuweInstellingen);
      meld('Back-up teruggezet.', 'succes');
    } catch (fout) {
      meld(foutMelding(fout), 'fout');
    }
  };

  return (
    <Sectie id="kop-gegevens" titel="Je gegevens">
      <p className="zacht">
        Alles staat alleen in deze browser op dit apparaat. Maak regelmatig een back-up, bijvoorbeeld om op een andere computer verder te werken. Er is geen
        tracking en geen eigen server.
      </p>
      <div className="rij">
        <button type="button" className="primair" onClick={() => void maakBackup()}>
          Back-up downloaden
        </button>
        <button type="button" onClick={() => invoer.current?.click()}>
          Back-up terugzetten…
        </button>
        <input
          ref={invoer}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void terugzetten(f);
            e.target.value = '';
          }}
        />
      </div>
      <fieldset style={{ marginTop: '0.75rem' }}>
        <legend>Bij terugzetten</legend>
        <label className="keuze">
          <input type="radio" name="terugzetten" checked={vervangen} onChange={() => setVervangen(true)} />
          Huidige gegevens vervangen
        </label>
        <label className="keuze">
          <input type="radio" name="terugzetten" checked={!vervangen} onChange={() => setVervangen(false)} />
          Samenvoegen (opdrachten uit de back-up toevoegen of bijwerken)
        </label>
      </fieldset>
      <details>
        <summary>Alles wissen</summary>
        <p className="zacht">Wist alle opdrachten, screenshots, eerdere theorie, je Word-sjabloon én je API-sleutels van dit apparaat.</p>
        <button
          type="button"
          className="gevaar"
          onClick={async () => {
            if (!window.confirm('Weet je het zeker? Dit kan niet ongedaan worden gemaakt.')) return;
            await wisAlles();
            wisSleutels();
            window.location.hash = '#/';
            window.location.reload();
          }}
        >
          Alles wissen
        </button>
      </details>
    </Sectie>
  );
}

export function Instellingen() {
  return (
    <>
      <h1>Instellingen</h1>
      <Profiel />
      <AiSleutel />
      <WordSjabloon />
      <ThemaKeuze />
      <Gegevens />
    </>
  );
}
