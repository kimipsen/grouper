export type Gender = 'female' | 'male' | 'nonbinary' | 'unspecified';

export interface Person {
  id: string;
  name: string;
  email?: string;
  gender?: Gender;
  weights?: Record<string, number>;
  createdAt: Date;
}

export interface PersonDTO {
  id: string;
  name: string;
  email?: string;
  gender?: Gender;
  weights?: Record<string, number>;
  createdAt: string; // ISO string for storage
}
