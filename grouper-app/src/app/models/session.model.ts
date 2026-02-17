import { Person, PersonDTO } from './person.model';
import { PreferenceMap } from './preference.model';
import { GroupingResult, GroupingResultDTO } from './group.model';

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
  groupingHistory: GroupingResultDTO[];
  customWeights: CustomWeightDefinition[];
  genderMode?: 'mixed' | 'single' | 'ignore';
  createdAt: string; // ISO string for storage
  updatedAt: string; // ISO string for storage
}
