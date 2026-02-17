import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import {
  DEFAULT_PREFERENCE_SCORING,
  PreferenceScoring,
  Session,
  SessionDTO,
} from '../../models/session.model';

const SESSIONS_STORAGE_KEY = 'grouper_sessions';
const CURRENT_SESSION_ID_KEY = 'grouper_current_session_id';
const MAX_EXPORTED_GROUPING_HISTORY = 5;

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {
  private storageService = inject(StorageService);


  /**
   * Save all sessions to localStorage
   * @param sessions Array of sessions to save
   */
  saveSessions(sessions: Session[]): void {
    const sessionsDTO = sessions.map(s => this.sessionToDTO(s));
    this.storageService.setItem<SessionDTO[]>(SESSIONS_STORAGE_KEY, sessionsDTO);
  }

  /**
   * Load all sessions from localStorage
   * @returns Array of sessions
   */
  loadSessions(): Session[] {
    const sessionsDTO = this.storageService.getItem<SessionDTO[]>(SESSIONS_STORAGE_KEY);
    if (!sessionsDTO || !Array.isArray(sessionsDTO)) {
      return [];
    }
    return sessionsDTO.map(dto => this.dtoToSession(dto));
  }

  /**
   * Get a single session by ID
   * @param id Session ID
   * @returns Session or null if not found
   */
  getSessionById(id: string): Session | null {
    const sessions = this.loadSessions();
    return sessions.find(s => s.id === id) || null;
  }

  /**
   * Get all sessions
   * @returns Array of all sessions
   */
  getAllSessions(): Session[] {
    return this.loadSessions();
  }

  /**
   * Delete a session by ID
   * @param id Session ID to delete
   */
  deleteSession(id: string): void {
    const sessions = this.loadSessions();
    const filteredSessions = sessions.filter(s => s.id !== id);
    this.saveSessions(filteredSessions);

    // Clear current session if it was deleted
    const currentSessionId = this.getCurrentSessionId();
    if (currentSessionId === id) {
      this.clearCurrentSessionId();
    }
  }

  /**
   * Save current session ID
   * @param id Session ID
   */
  saveCurrentSessionId(id: string): void {
    this.storageService.setItem(CURRENT_SESSION_ID_KEY, id);
  }

  /**
   * Get current session ID
   * @returns Current session ID or null
   */
  getCurrentSessionId(): string | null {
    return this.storageService.getItem<string>(CURRENT_SESSION_ID_KEY);
  }

  /**
   * Clear current session ID
   */
  clearCurrentSessionId(): void {
    this.storageService.removeItem(CURRENT_SESSION_ID_KEY);
  }

  /**
   * Export a session to JSON string
   * @param session Session to export
   * @returns JSON string
   */
  exportSession(session: Session): string {
    const dto = this.sessionToDTO({
      ...session,
      groupingHistory: session.groupingHistory.slice(-MAX_EXPORTED_GROUPING_HISTORY),
    });
    return JSON.stringify(dto, null, 2);
  }

  /**
   * Import a session from JSON string
   * @param jsonData JSON string
   * @returns Session object
   * @throws Error if JSON is invalid
   */
  importSession(jsonData: string): Session {
    try {
      const dto = JSON.parse(jsonData) as SessionDTO;
      this.validateSessionDTO(dto);
      return this.dtoToSession(dto);
    } catch (error) {
      console.error('Error importing session:', error);
      throw new Error('Invalid session data. Please check the JSON format.');
    }
  }

  /**
   * Convert Session to SessionDTO for storage
   */
  private sessionToDTO(session: Session): SessionDTO {
    return {
      id: session.id,
      name: session.name,
      description: session.description,
      people: session.people.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        gender: p.gender,
        weights: p.weights,
        createdAt: p.createdAt.toISOString()
      })),
      preferences: session.preferences,
      preferenceScoring: this.normalizePreferenceScoring(session.preferenceScoring),
      groupingHistory: session.groupingHistory.map(gr => ({
        groups: gr.groups,
        strategy: gr.strategy,
        settings: gr.settings,
        timestamp: gr.timestamp.toISOString(),
        overallSatisfaction: gr.overallSatisfaction
      })),
      customWeights: session.customWeights,
      genderMode: session.genderMode,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }

  /**
   * Convert SessionDTO to Session for use in app
   */
  private dtoToSession(dto: SessionDTO): Session {
    return {
      id: dto.id,
      name: dto.name,
      description: dto.description,
      people: dto.people.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        gender: p.gender ?? 'unspecified',
        weights: p.weights ?? {},
        createdAt: new Date(p.createdAt)
      })),
      preferences: dto.preferences || {},
      preferenceScoring: this.normalizePreferenceScoring(dto.preferenceScoring),
      groupingHistory: dto.groupingHistory.map(gr => ({
        groups: gr.groups,
        strategy: gr.strategy,
        settings: gr.settings,
        timestamp: new Date(gr.timestamp),
        overallSatisfaction: gr.overallSatisfaction
      })),
      customWeights: dto.customWeights ?? [],
      genderMode: dto.genderMode ?? 'mixed',
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt)
    };
  }

  /**
   * Validate SessionDTO structure
   * @throws Error if validation fails
   */
  private validateSessionDTO(dto: unknown): void {
    if (!dto || typeof dto !== 'object') {
      throw new Error('Invalid session data: not an object');
    }
    const session = dto as SessionDTO;
    if (!session.id || typeof session.id !== 'string') {
      throw new Error('Invalid session data: missing or invalid id');
    }
    if (!session.name || typeof session.name !== 'string') {
      throw new Error('Invalid session data: missing or invalid name');
    }
    if (!Array.isArray(session.people)) {
      throw new Error('Invalid session data: people must be an array');
    }
    if (typeof session.preferences !== 'object') {
      throw new Error('Invalid session data: preferences must be an object');
    }
    if (!Array.isArray(session.groupingHistory)) {
      throw new Error('Invalid session data: groupingHistory must be an array');
    }
    if (session.preferenceScoring !== undefined) {
      if (typeof session.preferenceScoring !== 'object' || session.preferenceScoring === null) {
        throw new Error('Invalid session data: preferenceScoring must be an object');
      }
      if (typeof session.preferenceScoring.wantWith !== 'number' || !Number.isFinite(session.preferenceScoring.wantWith)) {
        throw new Error('Invalid session data: preferenceScoring.wantWith must be a finite number');
      }
      if (typeof session.preferenceScoring.avoid !== 'number' || !Number.isFinite(session.preferenceScoring.avoid)) {
        throw new Error('Invalid session data: preferenceScoring.avoid must be a finite number');
      }
    }
    if (session.customWeights !== undefined && !Array.isArray(session.customWeights)) {
      throw new Error('Invalid session data: customWeights must be an array');
    }
  }

  private normalizePreferenceScoring(scoring?: PreferenceScoring): PreferenceScoring {
    return {
      wantWith: Number.isFinite(scoring?.wantWith)
        ? (scoring?.wantWith as number)
        : DEFAULT_PREFERENCE_SCORING.wantWith,
      avoid: Number.isFinite(scoring?.avoid)
        ? (scoring?.avoid as number)
        : DEFAULT_PREFERENCE_SCORING.avoid,
    };
  }
}
