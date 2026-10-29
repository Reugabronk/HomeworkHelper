// Stap-voor-stap uitleg om gratis een Gemini-sleutel te maken.
export const GEMINI_SLEUTEL_URL = 'https://aistudio.google.com/apikey';

export function GeminiStappen() {
  return (
    <ol style={{ margin: '0.25rem 0 0.5rem', paddingLeft: '1.3rem' }}>
      <li>
        Open{' '}
        <a href={GEMINI_SLEUTEL_URL} target="_blank" rel="noreferrer noopener">
          Google AI Studio
        </a>{' '}
        (nieuw tabblad) en log in met je Google-account.
      </li>
      <li>
        Klik op <strong>Create API key</strong> (API-sleutel maken). Accepteer de voorwaarden als daarom wordt gevraagd.
      </li>
      <li>
        Klik op <strong>Copy</strong> om de sleutel te kopiëren (hij begint met <code>AIza</code>).
      </li>
      <li>
        Plak de sleutel bij <strong>Instellingen</strong> en klik op <strong>Sleutel opslaan</strong>. Klaar!
      </li>
    </ol>
  );
}

export function GeminiVoorwaarden() {
  return (
    <ul className="klein" style={{ margin: 0 }}>
      <li>Gratis, met een limiet per minuut en per dag. Is de limiet op, wacht dan even of probeer het morgen weer.</li>
      <li>
        Bij gratis gebruik mag Google je vragen en antwoorden gebruiken om zijn producten te verbeteren, en kunnen mensen meelezen. Zet er dus geen
        persoonlijke of geheime gegevens in (zoals wachtwoorden of je adres).
      </li>
      <li>Volgens de voorwaarden van Google moet je 18 jaar of ouder zijn om de Gemini API te gebruiken.</li>
    </ul>
  );
}
