import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { Session, SessionDTO } from '../../models/session.model';
import { PersonDTO } from '../../models/person.model';
import { GroupingResultDTO } from '../../models/group.model';

const SESSIONS_STORAGE_KEY = 'grouper_sessions';
const CURRENT_SESSION_ID_KEY = 'grouper_current_session_id';

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {

  constructor(private storageService: StorageService) { }

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
    const dto = this.sessionToDTO(session);
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
        createdAt: p.createdAt.toISOString()
      })),
      preferences: session.preferences,
      groupingHistory: session.groupingHistory.map(gr => ({
        groups: gr.groups,
        strategy: gr.strategy,
        settings: gr.settings,
        timestamp: gr.timestamp.toISOString(),
        overallSatisfaction: gr.overallSatisfaction
      })),
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
        createdAt: new Date(p.createdAt)
      })),
      preferences: dto.preferences || {},
      groupingHistory: dto.groupingHistory.map(gr => ({
        groups: gr.groups,
        strategy: gr.strategy,
        settings: gr.settings,
        timestamp: new Date(gr.timestamp),
        overallSatisfaction: gr.overallSatisfaction
      })),
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt)
    };
  }

  /**
   * Validate SessionDTO structure
   * @throws Error if validation fails
   */
  private validateSessionDTO(dto: any): void {
    if (!dto || typeof dto !== 'object') {
      throw new Error('Invalid session data: not an object');
    }
    if (!dto.id || typeof dto.id !== 'string') {
      throw new Error('Invalid session data: missing or invalid id');
    }
    if (!dto.name || typeof dto.name !== 'string') {
      throw new Error('Invalid session data: missing or invalid name');
    }
    if (!Array.isArray(dto.people)) {
      throw new Error('Invalid session data: people must be an array');
    }
    if (typeof dto.preferences !== 'object') {
      throw new Error('Invalid session data: preferences must be an object');
    }
    if (!Array.isArray(dto.groupingHistory)) {
      throw new Error('Invalid session data: groupingHistory must be an array');
    }
  }
}
