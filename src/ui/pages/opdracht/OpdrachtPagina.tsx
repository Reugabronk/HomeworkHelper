// Een opdracht met de tabbladen Opdracht, hoofdstuk 1-3 en Word-export.
import { useEffect, useRef } from 'react';
import { routeNaarHash } from '../../../app/router';
import type { HoofdstukId } from '../../../data/types';
import { ChatPaneel } from '../../components/ChatPaneel';
import { useOpdracht } from '../../useOpdracht';
import { ExportTab } from './ExportTab';
import { OpdrachtTab } from './OpdrachtTab';
import { ResultaatTab } from './ResultaatTab';
import { TheorieTab } from './TheorieTab';
import { UitwerkingTab } from './UitwerkingTab';

export type OpdrachtTabId = HoofdstukId | 'export';

const TABS: { id: OpdrachtTabId; label: string }[] = [
  { id: 'opdracht', label: 'Opdracht' },
  { id: 'theorie', label: '1. Theorie' },
  { id: 'uitwerking', label: '2. Uitwerking' },
  { id: 'resultaat', label: '3. Resultaat' },
  { id: 'export', label: 'Word' },
];

export function OpdrachtPagina({ id, tab }: { id: string; tab: OpdrachtTabId }) {
  const { opdracht, wijzig, opgeslagen } = useOpdracht(id);
  const kopRef = useRef<HTMLHeadingElement>(null);

  // Bij wisselen van tab de focus naar de kop zetten (fijn voor schermlezers).
  useEffect(() => {
    kopRef.current?.focus();
  }, [tab]);

  if (opdracht === undefined) return <p className="laden">Opdracht laden</p>;
  if (opdracht === null) {
    return (
      <div className="kaart">
        <h1>Opdracht niet gevonden</h1>
        <p>
          Deze opdracht bestaat niet (meer). <a href="#/">Terug naar het overzicht</a>
        </p>
      </div>
    );
  }

  const hoofdstuk: HoofdstukId = tab === 'export' ? 'opdracht' : tab;
  const props = { opdracht, wijzig };

  return (
    <>
      <div className="paginakop">
        <div>
          <p className="zacht klein" style={{ margin: 0 }}>
            <a href="#/">Opdrachten</a> / {opdracht.vak || 'Zonder vak'}
          </p>
          <h1 ref={kopRef} tabIndex={-1}>
            {opdracht.titel || 'Opdracht zonder titel'}
          </h1>
        </div>
        <div className="rij">
          <span className={`label-pil ${opdracht.status}`}>{opdracht.status === 'ingeleverd' ? 'Ingeleverd' : 'Bezig'}</span>
          <span className="zacht klein" role="status">
            {opgeslagen ? 'Opgeslagen' : 'Opslaan…'}
          </span>
        </div>
      </div>
      <nav className="tabs" aria-label="Onderdelen van het verslag">
        {TABS.map((t) => (
          <a key={t.id} href={routeNaarHash({ pagina: 'opdracht', id, tab: t.id })} aria-current={t.id === tab ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      {tab === 'opdracht' && <OpdrachtTab {...props} />}
      {tab === 'theorie' && <TheorieTab {...props} />}
      {tab === 'uitwerking' && <UitwerkingTab {...props} />}
      {tab === 'resultaat' && <ResultaatTab {...props} />}
      {tab === 'export' && <ExportTab {...props} />}
      <ChatPaneel opdracht={opdracht} hoofdstuk={hoofdstuk} wijzig={wijzig} />
    </>
  );
}
