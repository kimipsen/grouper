export enum PreferenceType {
  WANT_WITH = 'WANT_WITH',
  AVOID = 'AVOID'
}

export interface Preference {
  personId: string;
  targetPersonId: string;
  type: PreferenceType;
}

export type PreferenceMap = Record<string, {
    wantWith: string[];
    avoid: string[];
  }>;
