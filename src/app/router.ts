// Eenvoudige hash-router (#/...). Werkt op GitHub Pages zonder serverconfiguratie.
import { useEffect, useState } from 'react';
import type { HoofdstukId } from '../data/types';

export type Route =
  | { pagina: 'overzicht' }
  | { pagina: 'nieuw' }
  | { pagina: 'opdracht'; id: string; tab: HoofdstukId | 'export' }
  | { pagina: 'instellingen' }
  | { pagina: 'coach' }
  | { pagina: 'theorie' }
  | { pagina: 'onbekend' };

const TABS = ['opdracht', 'theorie', 'uitwerking', 'resultaat', 'export'] as const;

export function leesRoute(hash: string): Route {
  const delen = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (delen[0]) {
    case undefined:
      return { pagina: 'overzicht' };
    case 'nieuw':
      return { pagina: 'nieuw' };
    case 'instellingen':
      return { pagina: 'instellingen' };
    case 'coach':
      return { pagina: 'coach' };
    case 'theorie':
      return { pagina: 'theorie' };
    case 'opdracht': {
      if (!delen[1]) return { pagina: 'onbekend' };
      const tab = (TABS as readonly string[]).includes(delen[2] ?? '') ? (delen[2] as (typeof TABS)[number]) : 'opdracht';
      return { pagina: 'opdracht', id: delen[1], tab };
    }
    default:
      return { pagina: 'onbekend' };
  }
}

export function routeNaarHash(route: Route): string {
  switch (route.pagina) {
    case 'overzicht':
    case 'onbekend':
      return '#/';
    case 'opdracht':
      return `#/opdracht/${encodeURIComponent(route.id)}/${route.tab}`;
    default:
      return `#/${route.pagina}`;
  }
}

export function ga(route: Route): void {
  window.location.hash = routeNaarHash(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => leesRoute(window.location.hash));
  useEffect(() => {
    const bij = () => setRoute(leesRoute(window.location.hash));
    window.addEventListener('hashchange', bij);
    return () => window.removeEventListener('hashchange', bij);
  }, []);
  return route;
}
