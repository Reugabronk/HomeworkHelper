// Coachknoppen bij een onderdeel: feedback, op weg helpen en een klein vragenvak.
import { useId, useState } from 'react';
import { useApp } from '../../app/context';
import { vraagCoachOverOnderdeel } from '../../ai/coach';
import type { OnderdeelContext } from '../../ai/prompts';
import { nieuwCoachAntwoord } from '../../data/model';
import type { CoachAntwoord, Opdracht } from '../../data/types';
import { AiFoutmelding } from './AiFoutmelding';
import { Markdown } from './Markdown';
import { useAiVerzoek } from './useAiVerzoek';

const SOORT_LABEL: Record<CoachAntwoord['soort'], string> = {
  feedback: 'Feedback',
  opweg: 'Op weg',
  vraag: 'Vraag',
};

function datum(iso: string) {
  return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
}

function Antwoord({ a, onVerwijder }: { a: CoachAntwoord; onVerwijder: () => void }) {
  return (
    <div className="coach-antwoord">
      <div className="meta">
        <span>
          <strong>{SOORT_LABEL[a.soort]}</strong>
          {a.vraag ? `: "${a.vraag}"` : ''} · {datum(a.datum)}
        </span>
        <button type="button" className="link klein" onClick={onVerwijder}>
          Verwijder
        </button>
      </div>
      <Markdown tekst={a.tekst} />
    </div>
  );
}

interface Props {
  opdracht: Opdracht;
  /** Bouwt de actuele context van het onderdeel (tekst, commando's, ...). */
  context: () => { onderdeel: OnderdeelContext; afbeeldingIds: string[] };
  antwoorden: CoachAntwoord[];
  onWijzigAntwoorden: (fn: (a: CoachAntwoord[]) => CoachAntwoord[]) => void;
  vraagLabel?: string;
  /** Verberg "Help me op weg" (bijv. bij testcases). */
  zonderOpWeg?: boolean;
}

export function CoachVak({ opdracht, context, antwoorden, onWijzigAntwoorden, vraagLabel = 'Vraag iets over deze stap', zonderOpWeg }: Props) {
  const { omgeving, heeftSleutel } = useApp();
  const { bezig, liveTekst, fout, foutInInstellingen, voerUit, stop } = useAiVerzoek();
  const [vraag, setVraag] = useState('');
  const [bezigMet, setBezigMet] = useState<CoachAntwoord['soort'] | null>(null);
  const vraagId = useId();

  const vraagCoach = async (soort: CoachAntwoord['soort'], vraagTekst?: string) => {
    setBezigMet(soort);
    const { onderdeel, afbeeldingIds } = context();
    const tekst = await voerUit((opties) =>
      vraagCoachOverOnderdeel(omgeving, soort, opdracht, onderdeel, afbeeldingIds, vraagTekst, opties),
    );
    setBezigMet(null);
    if (tekst !== undefined) {
      onWijzigAntwoorden((lijst) => [nieuwCoachAntwoord(soort, tekst, vraagTekst), ...lijst]);
      if (soort === 'vraag') setVraag('');
    }
  };

  const [laatste, ...eerdere] = antwoorden;

  return (
    <div className="coachvak">
      <div className="rij">
        <button type="button" onClick={() => vraagCoach('feedback')} disabled={bezig}>
          Feedback op mijn tekst
        </button>
        {!zonderOpWeg && (
          <button type="button" onClick={() => vraagCoach('opweg')} disabled={bezig}>
            Help me op weg
          </button>
        )}
        {bezig && (
          <button type="button" className="klein" onClick={stop}>
            Stop
          </button>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (vraag.trim()) void vraagCoach('vraag', vraag.trim());
        }}
      >
        <label htmlFor={vraagId} className="sr-only">
          {vraagLabel}
        </label>
        <input id={vraagId} type="text" placeholder={`${vraagLabel}…`} value={vraag} onChange={(e) => setVraag(e.target.value)} disabled={bezig} />
        <button type="submit" disabled={bezig || !vraag.trim()}>
          Vraag
        </button>
      </form>
      {!heeftSleutel && <p className="zacht klein">Vul eerst je API-sleutel in bij Instellingen om de coach te gebruiken.</p>}
      <AiFoutmelding fout={fout} inInstellingen={foutInInstellingen} />
      <div aria-live="polite" aria-busy={bezig}>
        {bezig && (
          <div className="coach-antwoord">
            <div className="meta">
              <span className="laden">{bezigMet ? SOORT_LABEL[bezigMet] : 'Coach'} – de coach denkt na</span>
            </div>
            {liveTekst && <Markdown tekst={liveTekst} />}
          </div>
        )}
      </div>
      {laatste && <Antwoord a={laatste} onVerwijder={() => onWijzigAntwoorden((l) => l.filter((x) => x.id !== laatste.id))} />}
      {eerdere.length > 0 && (
        <details className="klein">
          <summary>Eerdere antwoorden ({eerdere.length})</summary>
          {eerdere.map((a) => (
            <Antwoord key={a.id} a={a} onVerwijder={() => onWijzigAntwoorden((l) => l.filter((x) => x.id !== a.id))} />
          ))}
        </details>
      )}
    </div>
  );
}
