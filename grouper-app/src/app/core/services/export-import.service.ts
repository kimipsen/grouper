import { Injectable } from '@angular/core';
import { Session } from '../../models/session.model';
import { SessionStorageService } from './session-storage.service';

@Injectable({
  providedIn: 'root'
})
export class ExportImportService {

  constructor(private sessionStorageService: SessionStorageService) { }

  /**
   * Export a session to JSON string
   * @param session Session to export
   * @returns JSON string
   */
  exportSessionToJSON(session: Session): string {
    return this.sessionStorageService.exportSession(session);
  }

  /**
   * Import a session from JSON string
   * @param jsonString JSON string to import
   * @returns Imported session
   * @throws Error if JSON is invalid
   */
  importSessionFromJSON(jsonString: string): Session {
    return this.sessionStorageService.importSession(jsonString);
  }

  /**
   * Export all sessions to JSON string
   * @param sessions Array of sessions to export
   * @returns JSON string
   */
  exportAllSessions(sessions: Session[]): string {
    const sessionsDTO = sessions.map(s =>
      JSON.parse(this.sessionStorageService.exportSession(s))
    );
    return JSON.stringify(sessionsDTO, null, 2);
  }

  /**
   * Import multiple sessions from JSON string
   * @param jsonString JSON string containing array of sessions
   * @returns Array of imported sessions
   * @throws Error if JSON is invalid
   */
  importSessions(jsonString: string): Session[] {
    try {
      const data = JSON.parse(jsonString);

      // Handle single session object
      if (data && !Array.isArray(data) && data.id) {
        return [this.importSessionFromJSON(jsonString)];
      }

      // Handle array of sessions
      if (Array.isArray(data)) {
        return data.map(sessionData =>
          this.importSessionFromJSON(JSON.stringify(sessionData))
        );
      }

      throw new Error('Invalid format: expected session object or array of sessions');
    } catch (error) {
      console.error('Error importing sessions:', error);
      throw new Error('Invalid JSON format. Please check the file and try again.');
    }
  }

  /**
   * Download content as a file
   * @param content File content
   * @param filename Filename for download
   * @param contentType MIME type
   */
  downloadAsFile(content: string, filename: string, contentType: string = 'application/json'): void {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Validate import data structure
   * @param jsonString JSON string to validate
   * @returns Validation result
   */
  validateImportData(jsonString: string): ImportValidationResult {
    try {
      const data = JSON.parse(jsonString);

      // Check if it's a single session
      if (data && !Array.isArray(data) && data.id) {
        return {
          isValid: true,
          sessionCount: 1,
          errors: []
        };
      }

      // Check if it's an array of sessions
      if (Array.isArray(data)) {
        const invalidSessions = data.filter(item =>
          !item || typeof item !== 'object' || !item.id || !item.name
        );

        if (invalidSessions.length > 0) {
          return {
            isValid: false,
            sessionCount: data.length - invalidSessions.length,
            errors: [`${invalidSessions.length} invalid session(s) found in the data`]
          };
        }

        return {
          isValid: true,
          sessionCount: data.length,
          errors: []
        };
      }

      return {
        isValid: false,
        sessionCount: 0,
        errors: ['Invalid format: expected session object or array of sessions']
      };
    } catch (error) {
      return {
        isValid: false,
        sessionCount: 0,
        errors: ['Invalid JSON format']
      };
    }
  }

  /**
   * Generate a filename for export
   * @param sessionName Optional session name to include in filename
   * @returns Generated filename with timestamp
   */
  generateExportFilename(sessionName?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    if (sessionName) {
      const sanitizedName = sessionName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      return `grouper-${sanitizedName}-${timestamp}.json`;
    }
    return `grouper-sessions-${timestamp}.json`;
  }

  /**
   * Read file content from FileReader
   * @param file File to read
   * @returns Promise with file content
   */
  readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        reject(new Error('Invalid file type. Please select a JSON file.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
          resolve(content);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      reader.readAsText(file);
    });
  }
}

/**
 * Import validation result interface
 */
export interface ImportValidationResult {
  isValid: boolean;
  sessionCount: number;
  errors: string[];
}
