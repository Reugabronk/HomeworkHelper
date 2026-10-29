// Gegevensmodel van Verslagcoach. Alles wordt lokaal in de browser opgeslagen.

export type Diepgang = 'basis' | 'uitgebreid';
export type OpdrachtStatus = 'bezig' | 'ingeleverd';
export type HoofdstukId = 'opdracht' | 'theorie' | 'uitwerking' | 'resultaat';

/** Antwoord van de coach dat bij een onderdeel bewaard blijft. */
export interface CoachAntwoord {
  id: string;
  soort: 'feedback' | 'opweg' | 'vraag';
  /** Alleen bij soort 'vraag': de vraag van de student. */
  vraag?: string;
  tekst: string;
  datum: string;
}

/** Gemeenschappelijke velden van alles waar de student zelf tekst bij schrijft. */
export interface Onderdeel {
  id: string;
  tekst: string;
  afbeeldingen: string[];
  coach: CoachAntwoord[];
}

export interface TheorieOnderwerp extends Onderdeel {
  titel: string;
  /** Uitleg van de coach om het onderwerp te leren (geen verslagtekst). */
  uitleg: string;
  vragen: string[];
  status: 'actief' | 'overgeslagen';
  /** Gevuld als het onderwerp al in een eerdere opdracht/verslag stond. */
  alBehandeldIn?: string;
}

export interface Stap extends Onderdeel {
  titel: string;
  /** Korte aanwijzing van de coach: wat moet de student in deze stap laten zien? */
  aanwijzing: string;
  commandos: string;
}

export type Geslaagd = '' | 'ja' | 'nee';

export interface Testcase {
  id: string;
  beschrijving: string;
  verwacht: string;
  werkelijk: string;
  geslaagd: Geslaagd;
}

export interface Resultaat {
  eindresultaat: Onderdeel;
  testcases: Testcase[];
  /** Coachantwoorden over de testcases als geheel. */
  testcasesCoach: CoachAntwoord[];
  reflectievragen: string[];
  reflectie: Onderdeel;
}

export interface ChatBericht {
  id: string;
  rol: 'student' | 'coach';
  tekst: string;
  datum: string;
  /** In welk hoofdstuk de student zat toen het bericht werd verstuurd. */
  hoofdstuk?: HoofdstukId;
}

export interface Opdracht {
  id: string;
  vak: string;
  titel: string;
  opdrachtTekst: string;
  opdrachtAfbeeldingen: string[];
  status: OpdrachtStatus;
  ingeleverdOp?: string;
  diepgang: Diepgang;
  /** Korte samenvatting van de opdracht door de coach. */
  samenvatting: string;
  planGemaaktOp?: string;
  theorie: TheorieOnderwerp[];
  stappen: Stap[];
  resultaat: Resultaat;
  chat: ChatBericht[];
  aangemaakt: string;
  gewijzigd: string;
}

/** Een verkleinde afbeelding (screenshot of foto). */
export interface Afbeelding {
  id: string;
  mediaType: 'image/png' | 'image/jpeg';
  breedte: number;
  hoogte: number;
  data: ArrayBuffer;
  /** Optioneel bijschrift; wordt in Word gebruikt als "Figuur n: ...". */
  bijschrift: string;
  aangemaakt: string;
}

/** Een theorie-onderwerp uit een eerder (geïmporteerd) verslag. */
export interface EerdereTheorie {
  id: string;
  onderwerp: string;
  bron: string;
  vak?: string;
  datum: string;
}

/** Het Word-sjabloon dat de student zelf heeft geüpload. */
export interface OpgeslagenSjabloon {
  naam: string;
  data: ArrayBuffer;
  geupload: string;
}
