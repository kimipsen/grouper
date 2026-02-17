import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject } from 'rxjs';
import { GroupingService } from '../../../core/services/grouping.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SessionService } from '../../../core/services/session.service';
import { GroupingStrategy } from '../../../models/group.model';
import { Session } from '../../../models/session.model';
import { SessionDetail } from './session-detail';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'sessionDetail.peopleTitle') {
      return `People (${params?.['count']})`;
    }
    if (key === 'sessionDetail.groupLabel') {
      return `Group ${params?.['index']}`;
    }
    const labels: Record<string, string> = {
      'sessionDetail.noPeople': 'No people yet',
      'sessionDetail.addPerson': 'Add Person',
      'sessionDetail.preferencesTitle': 'Preferences',
      'sessionDetail.preferencesMinPeople': 'Add at least 2 people to set preferences',
      'sessionDetail.customWeights.title': 'Custom Weights',
      'sessionDetail.createGroupsTitle': 'Create Groups',
      'sessionDetail.strategy': 'Strategy',
      'sessionDetail.strategyRandom': 'Random',
      'sessionDetail.strategyPreferenceBased': 'Preference-Based',
      'sessionDetail.strategyWeighted': 'Weighted',
      'sessionDetail.groupSize': 'Group Size',
      'sessionDetail.allowPartialGroups': 'Allow partial groups',
      'sessionDetail.generateGroups': 'Generate Groups',
      'sessionDetail.generatedGroups': 'Generated Groups',
      'sessionDetail.preferenceNone': '-',
      'sessionDetail.preferenceWantWith': 'Want with',
      'sessionDetail.preferenceAvoid': 'Avoid',
      'common.back': 'Back',
      'sessionDetail.regenerateGroupsAria': 'Regenerate groups',
      'sessionDetail.genderMode.label': 'Gender mode',
      'sessionDetail.genderMode.mixed': 'Mixed',
      'sessionDetail.genderMode.single': 'Single',
      'sessionDetail.genderMode.ignore': 'Ignore',
      'sessionDetail.preferenceScoring.title': 'Preference scoring',
      'sessionDetail.preferenceScoring.wantWith': 'Prefer score',
      'sessionDetail.preferenceScoring.avoid': 'Avoid score',
      'sessionDetail.resetSession': 'Reset Session',
    };
    return labels[key] ?? key;
  }

  getCurrentDateLocale(): string {
    return 'en-US';
  }
}

describe('SessionDetail accessibility', () => {
  it('renders labeled controls for grouping configuration', async () => {
    const params$ = new BehaviorSubject({ id: 'session-1' });
    const currentSession = signal<Session | null>({
      id: 'session-1',
      name: 'Demo Session',
      description: '',
      people: [],
      preferences: {},
      preferenceScoring: { wantWith: 2, avoid: -2 },
      groupingHistory: [],
      customWeights: [],
      genderMode: 'mixed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await TestBed.configureTestingModule({
      imports: [SessionDetail],
      providers: [
        { provide: ActivatedRoute, useValue: { params: params$ } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: SessionService,
          useValue: {
            currentSession,
            setCurrentSession: vi.fn(),
            updateSessionGenderMode: vi.fn(),
            updatePreferenceScoring: vi.fn(),
          },
        },
        {
          provide: GroupingService,
          useValue: {
            validateSettings: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
            createGroups: vi.fn().mockReturnValue({
              groups: [],
              strategy: GroupingStrategy.RANDOM,
              settings: { strategy: GroupingStrategy.RANDOM, groupSize: 3, allowPartialGroups: true },
              timestamp: new Date(),
            }),
          },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionDetail);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const backButton = root.querySelector('button[aria-label]');
    expect(backButton?.getAttribute('aria-label')).toBe('Back');

    const labels = root.textContent ?? '';
    expect(labels).toContain('Create Groups');
    expect(labels).toContain('Strategy');
    expect(labels).toContain('Group Size');

    const unlabeledButton = Array.from(root.querySelectorAll('button')).find((button) => {
      const aria = button.getAttribute('aria-label')?.trim();
      const text = button.textContent?.trim();
      return !aria && !text;
    });
    expect(unlabeledButton).toBeUndefined();
  });
});
