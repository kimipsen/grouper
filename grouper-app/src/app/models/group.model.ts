export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  satisfactionScore?: number;
}

export interface GroupingResult {
  groups: Group[];
  strategy: GroupingStrategy;
  settings: GroupingSettings;
  timestamp: Date;
  overallSatisfaction?: number;
}

export interface GroupingResultDTO {
  groups: Group[];
  strategy: GroupingStrategy;
  settings: GroupingSettings;
  timestamp: string; // ISO string for storage
  overallSatisfaction?: number;
}

export enum GroupingStrategy {
  RANDOM = 'RANDOM',
  PREFERENCE_BASED = 'PREFERENCE_BASED',
  WEIGHTED = 'WEIGHTED'
}

export interface GroupingSettings {
  strategy: GroupingStrategy;
  groupSize: number;
  allowPartialGroups?: boolean;
  genderMode?: GenderMode;
  weightIds?: string[];
}

export type GenderMode = 'mixed' | 'single' | 'ignore';
