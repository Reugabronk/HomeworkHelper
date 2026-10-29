// Eigen Word-sjabloon uploaden, controleren en het standaardsjabloon downloaden.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../app/context';
import { bewaarSjabloon, bijWijziging, haalSjabloon, verwijderSjabloon } from '../../data/db';
import { nu } from '../../data/model';
import type { OpgeslagenSjabloon } from '../../data/types';
import { maakStandaardSjabloon } from '../../docx/default-template';
import { BLOK_PLACEHOLDERS, PLACEHOLDERS, analyseerSjabloon, type SjabloonAnalyse } from '../../docx/template';
import { downloadBestand } from '../download';

const DOTX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.template';

export async function downloadStandaardSjabloon() {
  const data = await maakStandaardSjabloon();
  downloadBestand(new Blob([data as BlobPart], { type: DOTX_TYPE }), 'verslagcoach-standaardsjabloon.dotx');
}

export function useSjabloon() {
  const [sjabloon, setSjabloon] = useState<OpgeslagenSjabloon | null | undefined>(undefined);
  useEffect(() => {
    const laad = () => void haalSjabloon().then((s) => setSjabloon(s ?? null));
    laad();
    return bijWijziging(laad);
  }, []);
  return sjabloon;
}

export function WordSjabloon() {
  const { meld } = useApp();
  const sjabloon = useSjabloon();
  const [analyse, setAnalyse] = useState<SjabloonAnalyse | null>(null);
  const invoer = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sjabloon) return setAnalyse(null);
    analyseerSjabloon(sjabloon.data).then(setAnalyse, () => setAnalyse(null));
  }, [sjabloon]);

  const upload = async (bestand: File) => {
    try {
      const data = await bestand.arrayBuffer();
      const a = await analyseerSjabloon(data);
      await bewaarSjabloon({ naam: bestand.name, data, geupload: nu() });
      meld(`Sjabloon "${bestand.name}" opgeslagen${a.placeholders.length ? '' : ' (let op: geen placeholders gevonden)'}.`, 'succes');
    } catch (fout) {
      meld(fout instanceof Error ? fout.message : 'Uploaden mislukt.', 'fout');
    }
  };

  return (
    <section className="kaart" aria-labelledby="kop-sjabloon">
      <h2 id="kop-sjabloon">Word-sjabloon</h2>
      <p>
        Gebruik het sjabloon van je school (.dotx of .docx) met placeholders. De app vult ze in bij het exporteren:{' '}
        {PLACEHOLDERS.map((p) => (
          <code key={p}>{`{{${p}}}`} </code>
        ))}
        . Zet <code>{'{{INHOUDSOPGAVE}}'}</code> en <code>{'{{INHOUD}}'}</code> elk in een eigen alinea waar de inhoudsopgave en de hoofdstukken moeten komen.
      </p>
      {sjabloon === undefined ? null : sjabloon ? (
        <div className="melding succes">
          <strong>Eigen sjabloon:</strong> {sjabloon.naam}
          {analyse && (
            <ul className="klein" style={{ margin: '0.4rem 0 0' }}>
              <li>Gevonden: {analyse.placeholders.length ? analyse.placeholders.map((p) => `{{${p}}}`).join(', ') : 'geen placeholders'}</li>
              {!analyse.heeftInhoud && <li>Geen {'{{INHOUD}}'}: de hoofdstukken komen aan het eind van het document.</li>}
              {!analyse.heeftInhoudsopgave && <li>Geen {'{{INHOUDSOPGAVE}}'}: de inhoudsopgave komt vóór de hoofdstukken.</li>}
              {analyse.onbekend.length > 0 && <li>Onbekend (blijft staan): {analyse.onbekend.map((p) => `{{${p}}}`).join(', ')}</li>}
            </ul>
          )}
        </div>
      ) : (
        <p className="zacht">Je hebt nog geen eigen sjabloon. Dan gebruikt de app het eenvoudige standaardsjabloon.</p>
      )}
      <div className="rij">
        <button type="button" onClick={() => invoer.current?.click()}>
          {sjabloon ? 'Ander sjabloon uploaden…' : 'Eigen sjabloon uploaden…'}
        </button>
        <button type="button" onClick={() => void downloadStandaardSjabloon()}>
          Standaardsjabloon downloaden
        </button>
        {sjabloon && (
          <button type="button" className="gevaar" onClick={() => window.confirm('Eigen sjabloon verwijderen?') && void verwijderSjabloon()}>
            Eigen sjabloon verwijderen
          </button>
        )}
      </div>
      <input
        ref={invoer}
        type="file"
        hidden
        accept=".dotx,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.wordprocessingml.template"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
      <p className="zacht klein">Blokplaceholders: {BLOK_PLACEHOLDERS.map((p) => `{{${p}}}`).join(', ')}. Tip: download het standaardsjabloon, pas het aan in Word en upload het weer.</p>
    </section>
  );
}
