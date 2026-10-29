// Foutmeldingen in gewone taal, voor alle aanbieders.

export type FoutSoort =
  | 'geen-sleutel'
  | 'ongeldige-sleutel'
  | 'geen-toegang'
  | 'tegoed'
  | 'limiet'
  | 'overbelast'
  | 'model-onbekend'
  | 'te-groot'
  | 'ongeldig-verzoek'
  | 'geweigerd'
  | 'afgekapt'
  | 'offline'
  | 'netwerk'
  | 'afgebroken'
  | 'server'
  | 'onbekend';

const MELDINGEN: Record<FoutSoort, string> = {
  'geen-sleutel':
    'Er is nog geen API-sleutel ingevuld. Ga naar Instellingen en vul je eigen sleutel in.',
  'ongeldige-sleutel':
    'De API-sleutel wordt niet geaccepteerd. Controleer of je de hele sleutel goed hebt geplakt, of maak een nieuwe aan.',
  'geen-toegang':
    'Je sleutel heeft geen toegang tot dit model of deze functie. Kies een ander model of controleer je account.',
  tegoed:
    'Je account heeft geen tegoed meer of er is een betaalprobleem. Controleer je tegoed bij je AI-aanbieder.',
  limiet:
    'Je hebt de limiet van je account bereikt (te veel verzoeken of tokens). Wacht even en probeer het opnieuw.',
  overbelast: 'De AI-dienst is op dit moment erg druk. Probeer het over een minuut opnieuw.',
  'model-onbekend':
    'Dit model bestaat niet of is niet beschikbaar voor jouw sleutel. Kies een ander model in Instellingen.',
  'te-groot':
    'Het verzoek is te groot (bijvoorbeeld te veel of te grote afbeeldingen). Stuur minder screenshots mee.',
  'ongeldig-verzoek': 'Het verzoek werd geweigerd door de AI-dienst.',
  geweigerd:
    'De AI wilde op dit verzoek niet antwoorden. Formuleer je vraag anders of probeer een ander model.',
  afgekapt: 'Het antwoord was te lang en is afgebroken. Probeer het opnieuw of kies "basis".',
  offline: 'Je bent niet verbonden met internet. Controleer je verbinding en probeer het opnieuw.',
  netwerk:
    'De AI-dienst is niet bereikbaar. Controleer je internetverbinding (of het adres bij een eigen aanbieder) en probeer het opnieuw.',
  afgebroken: 'Het verzoek is gestopt.',
  server: 'Er ging iets mis bij de AI-dienst. Probeer het later opnieuw.',
  onbekend: 'Er ging iets mis bij het verzoek aan de AI.',
};

export class AiFout extends Error {
  readonly soort: FoutSoort;
  readonly detail?: string;
  readonly status?: number;

  constructor(soort: FoutSoort, detail?: string, status?: number) {
    super(MELDINGEN[soort]);
    this.name = 'AiFout';
    this.soort = soort;
    this.detail = detail;
    this.status = status;
  }

  /** Melding voor de gebruiker, eventueel met technische details erbij. */
  get volledigeMelding(): string {
    return this.detail && this.soort !== 'afgebroken' ? `${this.message} (${this.detail})` : this.message;
  }
}

/** Zet een HTTP-status (plus optioneel fouttype van de aanbieder) om naar een AiFout. */
export function foutVoorStatus(status: number, detail?: string, type?: string): AiFout {
  if (type === 'billing_error' || type === 'insufficient_quota') return new AiFout('tegoed', detail, status);
  if (type === 'overloaded_error') return new AiFout('overbelast', detail, status);
  switch (status) {
    case 400:
      // Sommige aanbieders melden een tegoedprobleem als 400.
      if (detail && /credit balance|billing|quota/i.test(detail)) {
        return new AiFout('tegoed', detail, status);
      }
      return new AiFout('ongeldig-verzoek', detail, status);
    case 401:
      return new AiFout('ongeldige-sleutel', detail, status);
    case 402:
      return new AiFout('tegoed', detail, status);
    case 403:
      return new AiFout('geen-toegang', detail, status);
    case 404:
      return new AiFout('model-onbekend', detail, status);
    case 408:
      return new AiFout('netwerk', detail, status);
    case 413:
      return new AiFout('te-groot', detail, status);
    case 429:
      return new AiFout('limiet', detail, status);
    case 529:
    case 503:
      return new AiFout('overbelast', detail, status);
    default:
      return status >= 500 ? new AiFout('server', detail, status) : new AiFout('onbekend', detail, status);
  }
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function netwerkFout(detail?: string): AiFout {
  return new AiFout(isOffline() ? 'offline' : 'netwerk', detail);
}

/** Leesbare melding voor elke fout (ook als het geen AiFout is). */
export function foutMelding(fout: unknown): string {
  if (fout instanceof AiFout) return fout.volledigeMelding;
  if (fout instanceof Error) return fout.message;
  return String(fout);
}
