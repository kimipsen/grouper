import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Session } from '../../../models/session.model';
import { SessionService } from '../../../core/services/session.service';
import { ExportImportService } from '../../../core/services/export-import.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { I18nService } from '../../../core/services/i18n.service';
import { SessionListHeader } from './components/session-list-header/session-list-header';
import { SessionListEmptyState } from './components/session-list-empty-state/session-list-empty-state';
import { SessionListCard } from './components/session-list-card/session-list-card';

@Component({
  selector: 'app-session-list',
  templateUrl: './session-list.html',
  styleUrl: './session-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    SessionListHeader,
    SessionListEmptyState,
    SessionListCard,
  ]
})
export class SessionList {
  private sessionService = inject(SessionService);
  private exportImportService = inject(ExportImportService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private i18n = inject(I18nService);

  readonly sessions = this.sessionService.sessions;
  readonly currentDateLocale = computed(() => {
    const currentLocale = (this.i18n as I18nService & { currentLocale?: () => unknown }).currentLocale;
    currentLocale?.();
    return this.i18n.getCurrentDateLocale();
  });

  constructor() {
    const currentLocale = (this.i18n as I18nService & { currentLocale?: () => unknown }).currentLocale;
    if (currentLocale) {
      effect(() => {
        currentLocale();
        this.cdr.detectChanges();
      });
    }

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.cdr.detectChanges();
      });
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

  deleteSession(session: Session): void {
    if (confirm(this.i18n.t('sessionList.confirm.deleteSession', { name: session.name }))) {
      this.sessionService.deleteSession(session.id);
      this.snackBar.open(this.i18n.t('sessionList.snackbar.deleted'), this.i18n.t('common.close'), {
        duration: 3000
      });
    }
  }

  exportSession(session: Session): void {
    try {
      const json = this.sessionService.exportSession(session.id);
      const filename = this.exportImportService.generateExportFilename(session.name);
      this.exportImportService.downloadAsFile(json, filename);
      this.snackBar.open(this.i18n.t('sessionList.snackbar.exported'), this.i18n.t('common.close'), {
        duration: 3000
      });
    } catch {
      this.snackBar.open(this.i18n.t('sessionList.snackbar.exportFailed'), this.i18n.t('common.close'), {
        duration: 3000
      });
    }
  }

  async importSession(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const file = target?.files?.[0];
      if (file) {
        try {
          const content = await this.exportImportService.readFileContent(file);
          this.sessionService.importSession(content);
          this.snackBar.open(this.i18n.t('sessionList.snackbar.imported'), this.i18n.t('common.close'), {
            duration: 3000
          });
        } catch {
          this.snackBar.open(this.i18n.t('sessionList.snackbar.importFailed'), this.i18n.t('common.close'), {
            duration: 5000
          });
        }
      }
    };
    input.click();
  }
}
