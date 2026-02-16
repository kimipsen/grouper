import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
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

describe('SessionList', () => {
  it('renders localized heading text', async () => {
    const sessions$ = new BehaviorSubject<Session[]>([]);

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [SessionList, TranslatePipe],
      providers: [
        { provide: SessionService, useValue: { sessions$ } },
        { provide: ExportImportService, useValue: {} },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
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
});
