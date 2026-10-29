// Gemeenschappelijke vorm voor alle AI-aanbieders. Een nieuwe aanbieder hoeft alleen
// `AiAanbieder` te implementeren en in `index.ts` te worden geregistreerd.

export type AiInhoud =
  | { type: 'tekst'; tekst: string }
  | { type: 'afbeelding'; mediaType: 'image/png' | 'image/jpeg'; base64: string };

export interface AiBericht {
  rol: 'user' | 'assistant';
  inhoud: AiInhoud[];
}

export interface AiVerzoek {
  systeem: string;
  berichten: AiBericht[];
  maxTokens: number;
  /** Vraag om JSON volgens dit schema (als de aanbieder/het model dat ondersteunt). */
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Wordt aangeroepen terwijl het antwoord binnenkomt (totale tekst tot nu toe). */
  opTekst?: (totaal: string) => void;
}

export interface ModelInfo {
  id: string;
  naam: string;
  /** undefined = onbekend */
  afbeeldingen?: boolean;
}

export interface AanbiederConfig {
  sleutel: string;
  model: string;
  baseUrl?: string;
}

export interface AiAanbieder {
  readonly id: string;
  readonly naam: string;
  lijstModellen(): Promise<ModelInfo[]>;
  genereer(verzoek: AiVerzoek): Promise<string>;
  /** Controleert sleutel en model; geeft een korte melding terug als alles werkt. */
  test(): Promise<string>;
}
