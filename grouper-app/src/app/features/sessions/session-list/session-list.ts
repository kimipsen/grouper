import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Session } from '../../../models/session.model';
import { SessionService } from '../../../core/services/session.service';
import { ExportImportService } from '../../../core/services/export-import.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-session-list',
  standalone: false,
  templateUrl: './session-list.html',
  styleUrl: './session-list.scss',
})
export class SessionList implements OnInit, OnDestroy {
  sessions: Session[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private sessionService: SessionService,
    private exportImportService: ExportImportService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.sessionService.sessions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(sessions => {
        this.sessions = sessions;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  createNewSession(): void {
    const name = prompt('Enter session name:');
    if (name && name.trim()) {
      const session = this.sessionService.createSession(name.trim());
      this.sessionService.setCurrentSession(session.id);
      this.router.navigate(['/session', session.id]);
      this.snackBar.open('Session created successfully', 'Close', { duration: 3000 });
    }
  }

  openSession(session: Session): void {
    this.sessionService.setCurrentSession(session.id);
    this.router.navigate(['/session', session.id]);
  }

  deleteSession(session: Session, event: Event): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete session "${session.name}"?`)) {
      this.sessionService.deleteSession(session.id);
      this.snackBar.open('Session deleted', 'Close', { duration: 3000 });
    }
  }

  exportSession(session: Session, event: Event): void {
    event.stopPropagation();
    try {
      const json = this.sessionService.exportSession(session.id);
      const filename = this.exportImportService.generateExportFilename(session.name);
      this.exportImportService.downloadAsFile(json, filename);
      this.snackBar.open('Session exported successfully', 'Close', { duration: 3000 });
    } catch (error) {
      this.snackBar.open('Failed to export session', 'Close', { duration: 3000 });
    }
  }

  async importSession(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const content = await this.exportImportService.readFileContent(file);
          const session = this.sessionService.importSession(content);
          this.snackBar.open('Session imported successfully', 'Close', { duration: 3000 });
        } catch (error) {
          this.snackBar.open('Failed to import session: Invalid file', 'Close', { duration: 5000 });
        }
      }
    };
    input.click();
  }
}
