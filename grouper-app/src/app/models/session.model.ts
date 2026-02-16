import { Person, PersonDTO } from './person.model';
import { PreferenceMap } from './preference.model';
import { GroupingResult, GroupingResultDTO } from './group.model';

export interface Session {
  id: string;
  name: string;
  description?: string;
  people: Person[];
  preferences: PreferenceMap;
  groupingHistory: GroupingResult[];
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
  createdAt: string; // ISO string for storage
  updatedAt: string; // ISO string for storage
}
