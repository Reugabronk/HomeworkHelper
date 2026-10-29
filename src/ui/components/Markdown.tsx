import { Fragment, useMemo, type ReactNode } from 'react';
import { leesMarkdown, type Inline } from '../markdown';

function inline(delen: Inline[]): ReactNode[] {
  return delen.map((d, i) => {
    switch (d.type) {
      case 'tekst':
        return <Fragment key={i}>{d.tekst}</Fragment>;
      case 'code':
        return <code key={i}>{d.tekst}</code>;
      case 'vet':
        return <strong key={i}>{inline(d.kinderen)}</strong>;
      case 'cursief':
        return <em key={i}>{inline(d.kinderen)}</em>;
    }
  });
}

/** Toont Markdown van de coach veilig (zonder HTML in te voegen). */
export function Markdown({ tekst }: { tekst: string }) {
  const blokken = useMemo(() => leesMarkdown(tekst), [tekst]);
  return (
    <div className="markdown">
      {blokken.map((b, i) => {
        switch (b.type) {
          case 'kop': {
            // Koppen in antwoorden klein houden: ze staan binnen een kaart.
            const Tag = b.niveau <= 2 ? 'h4' : 'h5';
            return <Tag key={i}>{inline(b.inhoud)}</Tag>;
          }
          case 'alinea':
            return (
              <p key={i}>
                {b.regels.map((r, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(r)}
                  </Fragment>
                ))}
              </p>
            );
          case 'lijst': {
            const Tag = b.genummerd ? 'ol' : 'ul';
            return (
              <Tag key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </Tag>
            );
          }
          case 'code':
            return (
              <pre key={i}>
                <code>{b.tekst}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
