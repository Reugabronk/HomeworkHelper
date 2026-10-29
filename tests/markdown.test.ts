import { describe, expect, it } from 'vitest';
import { leesInline, leesMarkdown } from '../src/ui/markdown';
import { leesRoute, routeNaarHash } from '../src/app/router';

describe('markdown van de coach', () => {
  it('leest koppen, lijsten, codeblokken en alinea\'s', () => {
    const blokken = leesMarkdown('## Kop\n\n**Wat gaat goed**\n- punt 1\n- punt 2\n\n1. een\n2. twee\n\n```\nls -la\n```\ntekst');
    expect(blokken.map((b) => b.type)).toEqual(['kop', 'alinea', 'lijst', 'lijst', 'code', 'alinea']);
    expect(blokken[2]).toMatchObject({ type: 'lijst', genummerd: false });
    expect(blokken[3]).toMatchObject({ type: 'lijst', genummerd: true });
    expect(blokken[4]).toEqual({ type: 'code', tekst: 'ls -la' });
  });

  it('laat HTML als gewone tekst staan', () => {
    const inline = leesInline('<img src=x onerror=alert(1)> **vet**');
    expect(inline[0]).toEqual({ type: 'tekst', tekst: '<img src=x onerror=alert(1)> ' });
    expect(inline[1]).toMatchObject({ type: 'vet' });
  });

  it('ziet snake_case niet als cursief', () => {
    expect(leesInline('isc_dhcp_server')).toEqual([{ type: 'tekst', tekst: 'isc_dhcp_server' }]);
    expect(leesInline('een `code` stuk')[1]).toEqual({ type: 'code', tekst: 'code' });
  });
});

describe('router', () => {
  it('leest en maakt routes', () => {
    expect(leesRoute('#/opdracht/abc/theorie')).toEqual({ pagina: 'opdracht', id: 'abc', tab: 'theorie' });
    expect(leesRoute('#/opdracht/abc/onzin')).toEqual({ pagina: 'opdracht', id: 'abc', tab: 'opdracht' });
    expect(leesRoute('')).toEqual({ pagina: 'overzicht' });
    expect(routeNaarHash({ pagina: 'opdracht', id: 'a b', tab: 'export' })).toBe('#/opdracht/a%20b/export');
  });
});
