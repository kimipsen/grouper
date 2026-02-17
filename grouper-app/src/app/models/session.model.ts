import { Person, PersonDTO } from './person.model';
import { PreferenceMap } from './preference.model';
import { GroupingResult, GroupingResultDTO } from './group.model';

export interface PreferenceScoring {
  wantWith: number;
  avoid: number;
}

export const DEFAULT_PREFERENCE_SCORING: PreferenceScoring = {
  wantWith: 2,
  avoid: -2,
};

export interface CustomWeightDefinition {
  id: string;
  name: string;
}

export interface Session {
  id: string;
  name: string;
  description?: string;
  people: Person[];
  preferences: PreferenceMap;
  preferenceScoring?: PreferenceScoring;
  groupingHistory: GroupingResult[];
  customWeights: CustomWeightDefinition[];
  genderMode?: 'mixed' | 'single' | 'ignore';
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDTO {
  id: string;
  name: string;
  description?: string;
  people: PersonDTO[];
  preferences: PreferenceMap;
  preferenceScoring?: PreferenceScoring;
  groupingHistory: GroupingResultDTO[];
  customWeights: CustomWeightDefinition[];
  genderMode?: 'mixed' | 'single' | 'ignore';
  createdAt: string; // ISO string for storage
  updatedAt: string; // ISO string for storage
}
