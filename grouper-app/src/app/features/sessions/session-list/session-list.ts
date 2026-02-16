import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Session } from '../../../models/session.model';
import { SessionService } from '../../../core/services/session.service';
import { ExportImportService } from '../../../core/services/export-import.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { I18nService } from '../../../core/services/i18n.service';

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
    private router: Router,
    private i18n: I18nService
  ) {}

  get currentDateLocale(): string {
    return this.i18n.getCurrentDateLocale();
  }

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
    const name = prompt(this.i18n.t('sessionList.prompt.sessionName'));
    if (name && name.trim()) {
      const session = this.sessionService.createSession(name.trim());
      this.sessionService.setCurrentSession(session.id);
      this.router.navigate(['/session', session.id]);
      this.snackBar.open(this.i18n.t('sessionList.snackbar.created'), this.i18n.t('common.close'), {
        duration: 3000
      });
    }
  }

  openSession(session: Session): void {
    this.sessionService.setCurrentSession(session.id);
    this.router.navigate(['/session', session.id]);
  }

  deleteSession(session: Session, event: Event): void {
    event.stopPropagation();
    if (confirm(this.i18n.t('sessionList.confirm.deleteSession', { name: session.name }))) {
      this.sessionService.deleteSession(session.id);
      this.snackBar.open(this.i18n.t('sessionList.snackbar.deleted'), this.i18n.t('common.close'), {
        duration: 3000
      });
    }
  }

  exportSession(session: Session, event: Event): void {
    event.stopPropagation();
    try {
      const json = this.sessionService.exportSession(session.id);
      const filename = this.exportImportService.generateExportFilename(session.name);
      this.exportImportService.downloadAsFile(json, filename);
      this.snackBar.open(this.i18n.t('sessionList.snackbar.exported'), this.i18n.t('common.close'), {
        duration: 3000
      });
    } catch (error) {
      this.snackBar.open(this.i18n.t('sessionList.snackbar.exportFailed'), this.i18n.t('common.close'), {
        duration: 3000
      });
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
          this.sessionService.importSession(content);
          this.snackBar.open(this.i18n.t('sessionList.snackbar.imported'), this.i18n.t('common.close'), {
            duration: 3000
          });
        } catch (error) {
          this.snackBar.open(this.i18n.t('sessionList.snackbar.importFailed'), this.i18n.t('common.close'), {
            duration: 5000
          });
        }
      }
    };
    input.click();
  }
}
