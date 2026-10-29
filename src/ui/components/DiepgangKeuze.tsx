import { DIEPGANG } from '../../ai/standaard-instructies';
import type { Diepgang } from '../../data/types';

export function DiepgangKeuze({ waarde, onWijzig, naam }: { waarde: Diepgang; onWijzig: (d: Diepgang) => void; naam: string }) {
  return (
    <fieldset>
      <legend>Hoeveel zet de coach klaar?</legend>
      {(['basis', 'uitgebreid'] as const).map((d) => (
        <label key={d} className="keuze">
          <input type="radio" name={naam} checked={waarde === d} onChange={() => onWijzig(d)} />
          <span>
            <strong>{DIEPGANG[d].label}</strong>
            <span className="hulptekst">{DIEPGANG[d].uitleg}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
