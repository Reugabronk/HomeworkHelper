// De app-schil: kop met navigatie, de pagina's en meldingen.
import { useEffect } from 'react';
import { CoachInstructies } from '../ui/pages/CoachInstructies';
import { EerdereTheorie } from '../ui/pages/EerdereTheorie';
import { Instellingen } from '../ui/pages/Instellingen';
import { NieuweOpdracht } from '../ui/pages/NieuweOpdracht';
import { Overzicht } from '../ui/pages/Overzicht';
import { OpdrachtPagina } from '../ui/pages/opdracht/OpdrachtPagina';
import { GeminiStappen } from '../ui/components/GeminiUitleg';
import { Toasts } from '../ui/components/Toasts';
import { useApp } from './context';
import { routeNaarHash, useRoute, type Route } from './router';

const NAV: { route: Route; label: string }[] = [
  { route: { pagina: 'overzicht' }, label: 'Opdrachten' },
  { route: { pagina: 'nieuw' }, label: 'Nieuwe opdracht' },
  { route: { pagina: 'theorie' }, label: 'Eerdere theorie' },
  { route: { pagina: 'coach' }, label: 'Coach-instructies' },
  { route: { pagina: 'instellingen' }, label: 'Instellingen' },
];

const TITELS: Partial<Record<Route['pagina'], string>> = {
  overzicht: 'Opdrachten',
  nieuw: 'Nieuwe opdracht',
  theorie: 'Eerdere theorie',
  coach: 'Coach-instructies',
  instellingen: 'Instellingen',
};

function Pagina({ route }: { route: Route }) {
  switch (route.pagina) {
    case 'overzicht':
      return <Overzicht />;
    case 'nieuw':
      return <NieuweOpdracht />;
    case 'opdracht':
      return <OpdrachtPagina key={route.id} id={route.id} tab={route.tab} />;
    case 'instellingen':
      return <Instellingen />;
    case 'coach':
      return <CoachInstructies />;
    case 'theorie':
      return <EerdereTheorie />;
    default:
      return (
        <div className="kaart">
          <h1>Pagina niet gevonden</h1>
          <a href="#/">Naar je opdrachten</a>
        </div>
      );
  }
}

export function App() {
  const route = useRoute();
  const { heeftSleutel, instellingen } = useApp();

  useEffect(() => {
    const titel = TITELS[route.pagina];
    document.title = titel ? `${titel} – Verslagcoach` : 'Verslagcoach';
    if (route.pagina !== 'opdracht') window.scrollTo(0, 0);
  }, [route]);

  const actief = (r: Route) => r.pagina === route.pagina;

  return (
    <>
      <a className="overslaan" href="#inhoud" onClick={(e) => {
        e.preventDefault();
        document.getElementById('inhoud')?.focus();
      }}>
        Naar de inhoud
      </a>
      <header className="kop">
        <div className="kop-binnen">
          <a className="logo" href="#/">
            <img src="./favicon.svg" alt="" />
            Verslagcoach
          </a>
          <nav className="hoofdnav" aria-label="Hoofdmenu">
            {NAV.map((n) => (
              <a key={n.label} href={routeNaarHash(n.route)} aria-current={actief(n.route) ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main id="inhoud" tabIndex={-1}>
        {!heeftSleutel && route.pagina !== 'instellingen' && instellingen.ai.aanbieder !== 'gemini' && (
          <p className="melding waarschuwing">
            Vul eerst je API-sleutel in om de AI-coach te gebruiken. <a href="#/instellingen">Naar Instellingen</a>
          </p>
        )}
        {!heeftSleutel && route.pagina !== 'instellingen' && instellingen.ai.aanbieder === 'gemini' && (
          <div className="melding waarschuwing" style={{ marginBottom: '1.25rem' }}>
            <p>
              <strong>Welkom bij Verslagcoach!</strong> Om de AI-coach te gebruiken heb je één keer een gratis sleutel van Google Gemini nodig:
            </p>
            <GeminiStappen />
            <a className="knop primair" href="#/instellingen">
              Sleutel invullen in Instellingen
            </a>
          </div>
        )}
        <Pagina route={route} />
      </main>
      <footer className="voet">
        Verslagcoach bewaart alles alleen in deze browser. Geen tracking, geen eigen server. De coach helpt je leren; jij schrijft het verslag.
      </footer>
      <Toasts />
    </>
  );
}
