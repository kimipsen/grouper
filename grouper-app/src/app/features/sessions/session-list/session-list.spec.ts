import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { Router } from '@angular/router';
import { I18nService } from '../../../core/services/i18n.service';
import { ExportImportService } from '../../../core/services/export-import.service';
import { SessionService } from '../../../core/services/session.service';
import { Session } from '../../../models/session.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
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

  describe('create and delete', () => {
    let attached: HTMLElement | null = null;
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

    async function setup(initial: Session[]) {
      const sessionService = {
        sessions: signal<Session[]>(initial),
        createSession: vi.fn().mockReturnValue({ ...session, id: 'new-id' }),
        setCurrentSession: vi.fn(),
        deleteSession: vi.fn(),
      };
      const router = { navigate: vi.fn(), events: EMPTY };

      await TestBed.configureTestingModule({
        imports: [SessionList],
        providers: [
          { provide: SessionService, useValue: sessionService },
          { provide: ExportImportService, useValue: {} },
          { provide: Router, useValue: router },
          { provide: I18nService, useClass: MockI18nService },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(SessionList);
      const root = fixture.nativeElement as HTMLElement;
      document.body.appendChild(root);
      attached = root;
      await fixture.whenStable();
      return {
        fixture,
        root,
        sessionService,
        router,
        notifications: TestBed.inject(NotificationService),
        confirmDialog: TestBed.inject(ConfirmDialogService),
      };
    }

    afterEach(() => {
      attached?.remove();
      attached = null;
    });

    it('replaces the empty state with the create form and creates a session without prompt()', async () => {
      const prompt = vi.spyOn(window, 'prompt');
      const { fixture, root, sessionService, router, notifications } = await setup([]);

      fixture.componentInstance.openCreateForm();
      await fixture.whenStable();

      expect(root.querySelector('app-session-list-empty-state')).toBeNull();
      expect(root.querySelector('app-session-create-form')).not.toBeNull();

      fixture.componentInstance.createNewSession('Workshop');
      await fixture.whenStable();

      expect(prompt).not.toHaveBeenCalled();
      expect(sessionService.createSession).toHaveBeenCalledWith('Workshop');
      expect(router.navigate).toHaveBeenCalledWith(['/session', 'new-id']);
      expect(root.querySelector('app-session-create-form')).toBeNull();
      expect(notifications.toasts()[0]).toEqual(expect.objectContaining({ key: 'sessionList.snackbar.created' }));
    });

    it('hides the form and returns focus to the New session button on cancel', async () => {
      const { fixture, root } = await setup([session]);
      fixture.componentInstance.openCreateForm();
      await fixture.whenStable();

      fixture.componentInstance.cancelCreateForm();
      await fixture.whenStable();

      expect(root.querySelector('app-session-create-form')).toBeNull();
      expect(document.activeElement?.textContent?.trim()).toBe('New Session');
    });

    it.each([
      [true, 1],
      [false, 0],
    ])('deletes only when the confirmation resolves %s', async (confirmed, deletes) => {
      const confirm = vi.spyOn(window, 'confirm');
      const { fixture, sessionService, confirmDialog, notifications } = await setup([session]);

      const deletion = fixture.componentInstance.deleteSession(session);
      expect(confirmDialog.request()).toEqual(
        expect.objectContaining({
          titleKey: 'sessionList.confirm.deleteSessionTitle',
          messageKey: 'sessionList.confirm.deleteSession',
          confirmKey: 'sessionList.confirm.deleteSessionAction',
          params: { name: 'Demo' },
        }),
      );
      confirmDialog.settle(confirmed);
      await deletion;

      expect(confirm).not.toHaveBeenCalled();
      expect(sessionService.deleteSession).toHaveBeenCalledTimes(deletes);
      expect(notifications.toasts()).toHaveLength(deletes);
    });
  });
});
