import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_PREFERENCE_SCORING, PreferenceScoring, Session } from '../../models/session.model';
import { Person } from '../../models/person.model';
import { PreferenceMap, PreferenceType } from '../../models/preference.model';
import { GroupingResult } from '../../models/group.model';
import { SessionStorageService } from './session-storage.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionStorageService = inject(SessionStorageService);

  // State management
  private readonly sessionsSignal = signal<Session[]>([]);
  readonly sessions = this.sessionsSignal.asReadonly();
  readonly sessions$ = toObservable(this.sessions);

  private readonly currentSessionSignal = signal<Session | null>(null);
  readonly currentSession = this.currentSessionSignal.asReadonly();
  readonly currentSession$ = toObservable(this.currentSession);

  // Auto-save timer
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Load sessions on initialization
    this.loadAllSessions();
  }

  /**
   * Load all sessions from storage
   */
  loadAllSessions(): void {
    const sessions = this.sessionStorageService.loadSessions();
    this.sessionsSignal.set(sessions);

    // Restore current session
    const currentSessionId = this.sessionStorageService.getCurrentSessionId();
    if (currentSessionId) {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      if (currentSession) {
        this.currentSessionSignal.set(currentSession);
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
      preferenceScoring: { ...DEFAULT_PREFERENCE_SCORING },
      groupingHistory: [],
      customWeights: [],
      genderMode: 'mixed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const sessions = [...this.sessionsSignal()];
    sessions.push(newSession);
    this.sessionsSignal.set(sessions);
    this.triggerSave();

    return newSession;
  }

  /**
   * Update an existing session
   * @param session Session to update
   */
  updateSession(session: Session): void {
    session.updatedAt = new Date();
    const sessions = [...this.sessionsSignal()];
    const index = sessions.findIndex(s => s.id === session.id);

    if (index !== -1) {
      sessions[index] = session;
      this.sessionsSignal.set(sessions);

      // Update current session if it's the one being updated
      if (this.currentSessionSignal()?.id === session.id) {
        this.currentSessionSignal.set(session);
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
    const sessions = this.sessionsSignal().filter(s => s.id !== id);
    this.sessionsSignal.set(sessions);

    // Clear current session if it was deleted
    if (this.currentSessionSignal()?.id === id) {
      this.currentSessionSignal.set(null);
    }
  }

  /**
   * Set the current active session
   * @param id Session ID
   */
  setCurrentSession(id: string): void {
    const session = this.sessionsSignal().find(s => s.id === id);
    if (session) {
      this.currentSessionSignal.set(session);
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
    session.preferenceScoring = { ...DEFAULT_PREFERENCE_SCORING };
    session.groupingHistory = [];
    session.customWeights = [];
    session.genderMode = 'mixed';
    this.updateSession(session);
  }

  /**
   * Clear the current session
   */
  clearCurrentSession(): void {
    this.currentSessionSignal.set(null);
    this.sessionStorageService.clearCurrentSessionId();
  }

  /**
   * Get current session (synchronous)
   * @returns Current session or null
   */
  getCurrentSession(): Session | null {
    return this.currentSessionSignal();
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

  updatePreferenceScoring(sessionId: string, scoring: PreferenceScoring): void {
    const session = this.getSessionById(sessionId);
    if (!session) return;

    session.preferenceScoring = {
      wantWith: Number.isFinite(scoring.wantWith) ? scoring.wantWith : DEFAULT_PREFERENCE_SCORING.wantWith,
      avoid: Number.isFinite(scoring.avoid) ? scoring.avoid : DEFAULT_PREFERENCE_SCORING.avoid,
    };
    this.updateSession(session);
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
    return this.sessionsSignal().find(s => s.id === id);
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
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistSessions();
      this.saveTimeout = null;
    }, 500);
  }

  /**
   * Persist all sessions to storage
   */
  private persistSessions(): void {
    this.sessionStorageService.saveSessions(this.sessionsSignal());
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

    const sessions = [...this.sessionsSignal()];
    sessions.push(session);
    this.sessionsSignal.set(sessions);
    this.triggerSave();

    return session;
  }
}
