import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { Router } from '@angular/router';
import { I18nService } from '../../../core/services/i18n.service';
import { ExportImportService } from '../../../core/services/export-import.service';
import { SessionService } from '../../../core/services/session.service';
import { Session } from '../../../models/session.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SessionList } from './session-list';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'sessionList.peopleCount') {
      return `${params?.['count']} people`;
    }
    if (key === 'sessionList.groupingsCount') {
      return `${params?.['count']} groupings`;
    }
    const labels: Record<string, string> = {
      'sessionList.title': 'Sessions',
      'sessionList.emptyTitle': 'No sessions yet',
      'sessionList.emptyDescription': 'Create a new session to start grouping people',
      'sessionList.newSession': 'New Session',
      'sessionList.createFirstSession': 'Create First Session',
      'common.import': 'Import',
      'common.open': 'Open',
      'common.export': 'Export',
      'common.delete': 'Delete',
      'common.close': 'Close',
      'notifications.error': 'Error:',
      'sessionList.snackbar.exportFailed': 'Failed to export session',
    };
    return labels[key] ?? key;
  }

  getCurrentDateLocale(): string {
    return 'en-US';
  }
}

describe('SessionList', () => {
  it('renders localized heading text', async () => {
    const sessions = signal<Session[]>([]);

    await TestBed.configureTestingModule({
      imports: [SessionList],
      providers: [
        { provide: SessionService, useValue: { sessions } },
        { provide: ExportImportService, useValue: {} },
        { provide: Router, useValue: { navigate: vi.fn(), events: EMPTY } },
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionList);
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent;
    expect(content).toContain('Sessions');
    expect(content).toContain('No sessions yet');
  });

  describe('export feedback', () => {
    const session: Session = {
      id: 's1',
      name: 'Demo',
      people: [],
      preferences: {},
      groupingHistory: [],
      customWeights: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    async function setup(exportSession: () => string) {
      await TestBed.configureTestingModule({
        imports: [SessionList],
        providers: [
          { provide: SessionService, useValue: { sessions: signal<Session[]>([session]), exportSession } },
          {
            provide: ExportImportService,
            useValue: { generateExportFilename: () => 'demo.json', downloadAsFile: vi.fn() },
          },
          { provide: Router, useValue: { navigate: vi.fn(), events: EMPTY } },
          { provide: I18nService, useClass: MockI18nService },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const fixture = TestBed.createComponent(SessionList);
      fixture.detectChanges();
      return { fixture, root: fixture.nativeElement as HTMLElement, notifications: TestBed.inject(NotificationService) };
    }

    it('shows a dismissible DKFDS error alert instead of a toast when export fails', async () => {
      const { fixture, root, notifications } = await setup(() => {
        throw new Error('boom');
      });

      fixture.componentInstance.exportSession(session);
      fixture.detectChanges();

      const alert = root.querySelector('.alert.alert-error');
      expect(alert?.getAttribute('role')).toBe('alert');
      expect(alert?.querySelector('.alert-heading')?.textContent?.trim()).toBe('Error: Failed to export session');
      expect(notifications.toasts()).toEqual([]);

      alert?.querySelector<HTMLButtonElement>('.alert-close')?.click();
      fixture.detectChanges();
      expect(root.querySelector('.alert')).toBeNull();
    });

    it('clears a previous error and shows a success toast when export succeeds', async () => {
      const { fixture, root, notifications } = await setup(() => '{}');
      fixture.componentInstance.errorKey.set('sessionList.snackbar.exportFailed');

      fixture.componentInstance.exportSession(session);
      fixture.detectChanges();

      expect(root.querySelector('.alert')).toBeNull();
      expect(notifications.toasts()).toEqual([
        expect.objectContaining({ variant: 'success', key: 'sessionList.snackbar.exported' }),
      ]);
    });
  });
});
