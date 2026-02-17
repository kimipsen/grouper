import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { I18nService } from '../../../core/services/i18n.service';
import { ExportImportService } from '../../../core/services/export-import.service';
import { SessionService } from '../../../core/services/session.service';
import { Session } from '../../../models/session.model';
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
    };
    return labels[key] ?? key;
  }

  getCurrentDateLocale(): string {
    return 'en-US';
  }
}

describe('SessionList accessibility', () => {
  it('renders accessible controls in the empty state', async () => {
    const sessions = signal<Session[]>([]);

    await TestBed.configureTestingModule({
      imports: [SessionList],
      providers: [
        { provide: SessionService, useValue: { sessions } },
        { provide: ExportImportService, useValue: {} },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionList);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Sessions');

    const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
    const unlabeledButton = buttons.find((button) => {
      const aria = button.getAttribute('aria-label')?.trim();
      const text = button.textContent?.trim();
      return !aria && !text;
    });
    expect(unlabeledButton).toBeUndefined();
  });
});
