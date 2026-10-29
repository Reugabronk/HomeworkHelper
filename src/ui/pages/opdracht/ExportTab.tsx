// Tabblad "Word": het verslag exporteren naar .docx.
import { useState } from 'react';
import { useApp } from '../../../app/context';
import { STANDAARD_EXPORT_OPTIES, type ExportOpties } from '../../../docx/content';
import { exporteerNaarWord } from '../../../docx/export';
import type { Opdracht } from '../../../data/types';
import { berekenVoortgang } from '../../../data/voortgang';
import { useSjabloon, WordSjabloon } from '../../components/WordSjabloon';
import { bestandsnaam, downloadBestand } from '../../download';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function ExportTab({ opdracht }: { opdracht: Opdracht; wijzig: (fn: (o: Opdracht) => Opdracht) => void }) {
  const { instellingen, meld } = useApp();
  const sjabloon = useSjabloon();
  const [opties, setOpties] = useState<ExportOpties>(STANDAARD_EXPORT_OPTIES);
  const [eigen, setEigen] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [waarschuwingen, setWaarschuwingen] = useState<string[]>([]);
  const [fout, setFout] = useState('');
  const v = berekenVoortgang(opdracht);
  const profiel = instellingen.profiel;
  const ontbreekt = (['naam', 'klas', 'school'] as const).filter((k) => !profiel[k].trim());

  const exporteer = async () => {
    setBezig(true);
    setFout('');
    try {
      const { data, waarschuwingen } = await exporteerNaarWord(opdracht, profiel, { opties, eigenSjabloon: eigen && Boolean(sjabloon) });
      setWaarschuwingen(waarschuwingen);
      downloadBestand(new Blob([data as BlobPart], { type: DOCX_TYPE }), bestandsnaam(opdracht.titel || 'verslag', 'docx'));
      meld('Word-bestand gemaakt.', 'succes');
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Exporteren is mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const vinkje = (sleutel: keyof ExportOpties, label: string) => (
    <label className="keuze">
      <input type="checkbox" checked={opties[sleutel]} onChange={(e) => setOpties((o) => ({ ...o, [sleutel]: e.target.checked }))} />
      {label}
    </label>
  );

  return (
    <>
      <section className="kaart" aria-labelledby="kop-export">
        <h2 id="kop-export">Exporteren naar Word</h2>
        <p>
          Het verslag krijgt een voorblad, een inhoudsopgave en de drie hoofdstukken met koppen (Kop 1 en Kop 2), screenshots, commando's in een grijs
          codeblok en de testcases als tabel. Overgeslagen theorie komt er niet in. Je hebt {v.klaar} van de {v.totaal} onderdelen geschreven.
        </p>
        {ontbreekt.length > 0 && (
          <p className="melding waarschuwing">
            Nog niet ingevuld voor het voorblad: {ontbreekt.join(', ')}. <a href="#/instellingen">Naar Instellingen</a>
          </p>
        )}
        <fieldset>
          <legend>Sjabloon</legend>
          <label className="keuze">
            <input type="radio" name="sjabloon" checked={eigen && Boolean(sjabloon)} disabled={!sjabloon} onChange={() => setEigen(true)} />
            Mijn eigen sjabloon {sjabloon ? `(${sjabloon.naam})` : '(nog niet geüpload)'}
          </label>
          <label className="keuze">
            <input type="radio" name="sjabloon" checked={!eigen || !sjabloon} onChange={() => setEigen(false)} />
            Standaardsjabloon van Verslagcoach
          </label>
        </fieldset>
        <fieldset>
          <legend>Opties</legend>
          {vinkje('nummering', 'Koppen nummeren (1 Theorie, 1.1 …)')}
          {vinkje('hoofdstukNieuwePagina', 'Elk hoofdstuk op een nieuwe pagina')}
          {vinkje('figuurBijschriften', 'Bijschrift "Figuur n" onder elke afbeelding')}
        </fieldset>
        <button type="button" className="primair" onClick={() => void exporteer()} disabled={bezig}>
          {bezig ? <span className="laden">Bezig</span> : 'Download Word-bestand (.docx)'}
        </button>
        {fout && (
          <p className="melding fout" role="alert">
            {fout}
          </p>
        )}
        {waarschuwingen.length > 0 && (
          <div className="melding waarschuwing" role="status">
            <ul style={{ margin: 0 }}>
              {waarschuwingen.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="zacht klein">
          Open het bestand in Word. Vraagt Word of velden bijgewerkt moeten worden? Kies <strong>Ja</strong>: dan wordt de inhoudsopgave gevuld. In andere
          programma's: klik met de rechtermuisknop op de inhoudsopgave en kies "Veld/index bijwerken".
        </p>
      </section>
      <WordSjabloon />
    </>
  );
}
