import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Session } from '../../../models/session.model';
import { SessionService } from '../../../core/services/session.service';
import { ExportImportService } from '../../../core/services/export-import.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { I18nService } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { SessionListHeader } from './components/session-list-header/session-list-header';
import { SessionListEmptyState } from './components/session-list-empty-state/session-list-empty-state';
import { SessionListCard } from './components/session-list-card/session-list-card';
import { SessionCreateForm } from './components/session-create-form/session-create-form';

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
    SessionCreateForm,
    TranslatePipe,
  ]
})
export class SessionList {
  private sessionService = inject(SessionService);
  private exportImportService = inject(ExportImportService);
  private notifications = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private i18n = inject(I18nService);

  readonly sessions = this.sessionService.sessions;
  readonly errorKey = signal<string | null>(null);
  readonly showCreateForm = signal(false);
  private readonly header = viewChild.required(SessionListHeader);
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

  openCreateForm(): void {
    this.showCreateForm.set(true);
  }

  cancelCreateForm(): void {
    this.showCreateForm.set(false);
    this.header().focusNewSession();
  }

  createNewSession(name: string): void {
    const session = this.sessionService.createSession(name);
    this.showCreateForm.set(false);
    this.sessionService.setCurrentSession(session.id);
    this.router.navigate(['/session', session.id]);
    this.notifications.success('sessionList.snackbar.created');
  }

  openSession(session: Session): void {
    this.sessionService.setCurrentSession(session.id);
    this.router.navigate(['/session', session.id]);
  }

  async deleteSession(session: Session): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      titleKey: 'sessionList.confirm.deleteSessionTitle',
      messageKey: 'sessionList.confirm.deleteSession',
      confirmKey: 'sessionList.confirm.deleteSessionAction',
      params: { name: session.name },
    });
    if (confirmed) {
      this.sessionService.deleteSession(session.id);
      this.notifications.success('sessionList.snackbar.deleted');
    }
  }

  exportSession(session: Session): void {
    try {
      const json = this.sessionService.exportSession(session.id);
      const filename = this.exportImportService.generateExportFilename(session.name);
      this.exportImportService.downloadAsFile(json, filename);
      this.errorKey.set(null);
      this.notifications.success('sessionList.snackbar.exported');
    } catch {
      this.errorKey.set('sessionList.snackbar.exportFailed');
    }
  }

  dismissError(): void {
    this.errorKey.set(null);
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
          this.errorKey.set(null);
          this.notifications.success('sessionList.snackbar.imported');
        } catch {
          this.errorKey.set('sessionList.snackbar.importFailed');
        }
      }
    };
    input.click();
  }
}
