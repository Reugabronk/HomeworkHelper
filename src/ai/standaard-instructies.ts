// Standaardinstructies voor de AI-coach. Wordt in de volgende stap aangevuld.

export type Strengheid = 'mild' | 'normaal' | 'streng';
export type Niveau = 'mbo2' | 'mbo3' | 'mbo4' | 'hbo';
export type Taalniveau = 'A2' | 'B1' | 'B2' | 'C1';

export interface CoachInstellingen {
  strengheid: Strengheid;
  niveau: Niveau;
  taal: string;
  taalniveau: Taalniveau;
  eigenInstructies: string;
  maatstaf: string;
}

export const STANDAARD_COACH_INSTELLINGEN: CoachInstellingen = {
  strengheid: 'normaal',
  niveau: 'mbo4',
  taal: 'Nederlands',
  taalniveau: 'B1',
  eigenInstructies: '',
  maatstaf: '',
};
