export interface Person {
  id: string;
  name: string;
  email?: string;
  createdAt: Date;
}

export interface PersonDTO {
  id: string;
  name: string;
  email?: string;
  createdAt: string; // ISO string for storage
}
