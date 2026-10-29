import { useApp } from '../../app/context';

/** Korte meldingen onderaan het scherm; worden voorgelezen door schermlezers. */
export function Toasts() {
  const { meldingen, sluitMelding } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      {meldingen.map((m) => (
        <div key={m.id} className={`melding toast ${m.soort}`} role={m.soort === 'fout' ? 'alert' : 'status'}>
          <p>{m.tekst}</p>
          <button type="button" className="klein" onClick={() => sluitMelding(m.id)} aria-label="Melding sluiten">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
