import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../../models/session.model';
import { Gender, Person } from '../../models/person.model';
import { PreferenceMap, PreferenceType } from '../../models/preference.model';
import { GroupingResult } from '../../models/group.model';
import { SessionStorageService } from './session-storage.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionStorageService = inject(SessionStorageService);

  // State management
  private sessionsSubject = new BehaviorSubject<Session[]>([]);
  public sessions$ = this.sessionsSubject.asObservable();

  private currentSessionSubject = new BehaviorSubject<Session | null>(null);
  public currentSession$ = this.currentSessionSubject.asObservable();

  // Auto-save trigger
  private saveTriggered = new Subject<void>();

  constructor() {
    // Set up auto-save with debouncing
    this.saveTriggered.pipe(
      debounceTime(500)
    ).subscribe(() => {
      this.persistSessions();
    });

    // Load sessions on initialization
    this.loadAllSessions();
  }

  /**
   * Load all sessions from storage
   */
  loadAllSessions(): void {
    const sessions = this.sessionStorageService.loadSessions();
    this.sessionsSubject.next(sessions);

    // Restore current session
    const currentSessionId = this.sessionStorageService.getCurrentSessionId();
    if (currentSessionId) {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      if (currentSession) {
        this.currentSessionSubject.next(currentSession);
      }
    }
  }

  /**
   * Create a new session
   * @param name Session name
   * @param description Optional description
   * @returns Created session
   */
  createSession(name: string, description?: string): Session {
    const newSession: Session = {
      id: uuidv4(),
      name,
      description,
      people: [],
      preferences: {},
      groupingHistory: [],
      customWeights: [],
      genderMode: 'mixed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const sessions = this.sessionsSubject.value;
    sessions.push(newSession);
    this.sessionsSubject.next([...sessions]);
    this.triggerSave();

    return newSession;
  }

  /**
   * Update an existing session
   * @param session Session to update
   */
  updateSession(session: Session): void {
    session.updatedAt = new Date();
    const sessions = this.sessionsSubject.value;
    const index = sessions.findIndex(s => s.id === session.id);

    if (index !== -1) {
      sessions[index] = session;
      this.sessionsSubject.next([...sessions]);

      // Update current session if it's the one being updated
      if (this.currentSessionSubject.value?.id === session.id) {
        this.currentSessionSubject.next(session);
      }

      this.triggerSave();
    }
  }

  /**
   * Delete a session
   * @param id Session ID to delete
   */
  deleteSession(id: string): void {
    this.sessionStorageService.deleteSession(id);
    const sessions = this.sessionsSubject.value.filter(s => s.id !== id);
    this.sessionsSubject.next(sessions);

    // Clear current session if it was deleted
    if (this.currentSessionSubject.value?.id === id) {
      this.currentSessionSubject.next(null);
    }
  }

  /**
   * Set the current active session
   * @param id Session ID
   */
  setCurrentSession(id: string): void {
    const session = this.sessionsSubject.value.find(s => s.id === id);
    if (session) {
      this.currentSessionSubject.next(session);
      this.sessionStorageService.saveCurrentSessionId(id);
    }
  }

  /**
   * Reset session contents (people, preferences, grouping history)
   * @param id Session ID
   */
  resetSession(id: string): void {
    const session = this.getSessionById(id);
    if (!session) return;

    session.people = [];
    session.preferences = {};
    session.groupingHistory = [];
    session.customWeights = [];
    session.genderMode = 'mixed';
    this.updateSession(session);
  }

  /**
   * Clear the current session
   */
  clearCurrentSession(): void {
    this.currentSessionSubject.next(null);
    this.sessionStorageService.clearCurrentSessionId();
  }

  /**
   * Get current session (synchronous)
   * @returns Current session or null
   */
  getCurrentSession(): Session | null {
    return this.currentSessionSubject.value;
  }

  /**
   * Add a person to a session
   * @param sessionId Session ID
   * @param person Person to add
   */
  addPersonToSession(sessionId: string, person: Person): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      person.createdAt = new Date();
      person.gender = person.gender ?? 'unspecified';
      person.weights = this.ensurePersonWeights(session, person.weights);
      session.people.push(person);
      this.updateSession(session);
    }
  }

  /**
   * Update a person in a session
   * @param sessionId Session ID
   * @param person Updated person
   */
  updatePersonInSession(sessionId: string, person: Person): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      const index = session.people.findIndex(p => p.id === person.id);
      if (index !== -1) {
        session.people[index] = {
          ...person,
          gender: person.gender ?? 'unspecified',
          weights: this.ensurePersonWeights(session, person.weights)
        };
        this.updateSession(session);
      }
    }
  }

  updateSessionGenderMode(sessionId: string, genderMode: 'mixed' | 'single' | 'ignore'): void {
    const session = this.getSessionById(sessionId);
    if (!session) return;

    session.genderMode = genderMode;
    this.updateSession(session);
  }

  addCustomWeight(sessionId: string, name: string): string | null {
    const session = this.getSessionById(sessionId);
    if (!session) return null;

    const trimmed = name.trim();
    if (!trimmed) return null;

    const id = uuidv4();
    session.customWeights.push({ id, name: trimmed });

    session.people = session.people.map(person => ({
      ...person,
      weights: { ...this.ensurePersonWeights(session, person.weights), [id]: 0 }
    }));

    this.updateSession(session);
    return id;
  }

  renameCustomWeight(sessionId: string, weightId: string, name: string): void {
    const session = this.getSessionById(sessionId);
    if (!session) return;

    const trimmed = name.trim();
    if (!trimmed) return;

    const weight = session.customWeights.find(item => item.id === weightId);
    if (!weight) return;

    weight.name = trimmed;
    this.updateSession(session);
  }

  removeCustomWeight(sessionId: string, weightId: string): void {
    const session = this.getSessionById(sessionId);
    if (!session) return;

    session.customWeights = session.customWeights.filter(weight => weight.id !== weightId);
    session.people = session.people.map(person => {
      const weights = { ...this.ensurePersonWeights(session, person.weights) };
      delete weights[weightId];
      return { ...person, weights };
    });

    this.updateSession(session);
  }

  setPersonWeight(sessionId: string, personId: string, weightId: string, value: number): void {
    const session = this.getSessionById(sessionId);
    if (!session) return;

    const person = session.people.find(p => p.id === personId);
    if (!person) return;

    const weights = this.ensurePersonWeights(session, person.weights);
    weights[weightId] = value;
    person.weights = weights;
    this.updateSession(session);
  }

  private ensurePersonWeights(session: Session, weights?: Record<string, number>): Record<string, number> {
    const normalized: Record<string, number> = { ...weights };
    for (const weight of session.customWeights) {
      if (normalized[weight.id] === undefined) {
        normalized[weight.id] = 0;
      }
    }
    return normalized;
  }

  /**
   * Remove a person from a session
   * @param sessionId Session ID
   * @param personId Person ID to remove
   */
  removePersonFromSession(sessionId: string, personId: string): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      session.people = session.people.filter(p => p.id !== personId);

      // Also remove any preferences related to this person
      this.removePersonPreferences(session, personId);

      this.updateSession(session);
    }
  }

  /**
   * Update preferences for a session
   * @param sessionId Session ID
   * @param preferences Updated preference map
   */
  updatePreferences(sessionId: string, preferences: PreferenceMap): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      session.preferences = preferences;
      this.updateSession(session);
    }
  }

  /**
   * Set a preference for a person
   * @param sessionId Session ID
   * @param personId Person who has the preference
   * @param targetPersonId Person the preference is about
   * @param type Preference type (WANT_WITH or AVOID)
   */
  setPreference(sessionId: string, personId: string, targetPersonId: string, type: PreferenceType): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      if (!session.preferences[personId]) {
        session.preferences[personId] = { wantWith: [], avoid: [] };
      }

      const prefs = session.preferences[personId];

      // Remove from both arrays first
      prefs.wantWith = prefs.wantWith.filter(id => id !== targetPersonId);
      prefs.avoid = prefs.avoid.filter(id => id !== targetPersonId);

      // Add to appropriate array
      if (type === PreferenceType.WANT_WITH) {
        prefs.wantWith.push(targetPersonId);
      } else if (type === PreferenceType.AVOID) {
        prefs.avoid.push(targetPersonId);
      }

      this.updateSession(session);
    }
  }

  /**
   * Remove a preference
   * @param sessionId Session ID
   * @param personId Person who has the preference
   * @param targetPersonId Person the preference is about
   */
  removePreference(sessionId: string, personId: string, targetPersonId: string): void {
    const session = this.getSessionById(sessionId);
    if (session && session.preferences[personId]) {
      const prefs = session.preferences[personId];
      prefs.wantWith = prefs.wantWith.filter(id => id !== targetPersonId);
      prefs.avoid = prefs.avoid.filter(id => id !== targetPersonId);
      this.updateSession(session);
    }
  }

  /**
   * Add a grouping result to history
   * @param sessionId Session ID
   * @param result Grouping result to add
   */
  addGroupingResult(sessionId: string, result: GroupingResult): void {
    const session = this.getSessionById(sessionId);
    if (session) {
      session.groupingHistory.push(result);
      this.updateSession(session);
    }
  }

  /**
   * Get session by ID (synchronous)
   * @param id Session ID
   * @returns Session or undefined
   */
  private getSessionById(id: string): Session | undefined {
    return this.sessionsSubject.value.find(s => s.id === id);
  }

  /**
   * Remove all preferences related to a person
   * @param session Session to clean up
   * @param personId Person ID to remove preferences for
   */
  private removePersonPreferences(session: Session, personId: string): void {
    // Remove the person's own preferences
    delete session.preferences[personId];

    // Remove references to this person in other people's preferences
    Object.keys(session.preferences).forEach(pid => {
      const prefs = session.preferences[pid];
      prefs.wantWith = prefs.wantWith.filter(id => id !== personId);
      prefs.avoid = prefs.avoid.filter(id => id !== personId);
    });
  }

  /**
   * Trigger auto-save
   */
  private triggerSave(): void {
    this.saveTriggered.next();
  }

  /**
   * Persist all sessions to storage
   */
  private persistSessions(): void {
    this.sessionStorageService.saveSessions(this.sessionsSubject.value);
  }

  /**
   * Export a session to JSON
   * @param sessionId Session ID to export
   * @returns JSON string
   */
  exportSession(sessionId: string): string {
    const session = this.getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return this.sessionStorageService.exportSession(session);
  }

  /**
   * Import a session from JSON
   * @param jsonData JSON string
   * @returns Imported session
   */
  importSession(jsonData: string): Session {
    const session = this.sessionStorageService.importSession(jsonData);

    // Generate new ID to avoid conflicts
    session.id = uuidv4();
    session.updatedAt = new Date();

    const sessions = this.sessionsSubject.value;
    sessions.push(session);
    this.sessionsSubject.next([...sessions]);
    this.triggerSave();

    return session;
  }
}
