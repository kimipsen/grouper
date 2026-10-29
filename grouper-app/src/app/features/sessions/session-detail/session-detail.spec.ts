import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GroupingService } from '../../../core/services/grouping.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SessionService } from '../../../core/services/session.service';
import { GroupingStrategy } from '../../../models/group.model';
import { Session } from '../../../models/session.model';
import { NotificationService } from '../../../core/services/notification.service';
import { Person } from '../../../models/person.model';
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
    };
    return labels[key] ?? key;
  }

  getCurrentDateLocale(): string {
    return 'en-US';
  }
}

describe('SessionDetail', () => {
  it('renders localized group configuration title', async () => {
    const params$ = new BehaviorSubject({ id: 'session-1' });
    const currentSession = signal<Session | null>({
      id: 'session-1',
      name: 'Demo Session',
      description: '',
      people: [],
      preferences: {},
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
            addPersonToSession: vi.fn(),
            updatePersonInSession: vi.fn(),
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
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionDetail);
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent;
    expect(content).toContain('Create Groups');
    expect(content).toContain('Custom Weights');
  });

  it('adds a blank person with unspecified gender without prompts', async () => {
    const params$ = new BehaviorSubject({ id: 'session-1' });
    const addPersonToSession = vi.fn();
    const currentSession = signal<Session | null>({
      id: 'session-1',
      name: 'Demo Session',
      description: '',
      people: [],
      preferences: {},
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
            addPersonToSession,
            updatePersonInSession: vi.fn(),
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
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionDetail);
    fixture.detectChanges();

    fixture.componentInstance.addPerson();

    expect(addPersonToSession).toHaveBeenCalledTimes(1);
    const addedPerson = addPersonToSession.mock.calls[0][1] as { name: string; gender: string };
    expect(addedPerson.name).toBe('');
    expect(addedPerson.gender).toBe('unspecified');
    expect(fixture.componentInstance.selectedPerson).toEqual(expect.objectContaining({ name: '', gender: 'unspecified' }));
  });

  describe('grouping feedback', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Anna', gender: 'female', createdAt: new Date() },
      { id: 'p2', name: 'Bo', gender: 'male', createdAt: new Date() },
    ];

    async function setup(sessionPeople: Person[], groupingService: Record<string, unknown>) {
      const currentSession = signal<Session | null>({
        id: 'session-1',
        name: 'Demo Session',
        description: '',
        people: sessionPeople,
        preferences: {},
        groupingHistory: [],
        customWeights: [],
        genderMode: 'mixed',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await TestBed.configureTestingModule({
        imports: [SessionDetail],
        providers: [
          { provide: ActivatedRoute, useValue: { params: new BehaviorSubject({ id: 'session-1' }) } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          {
            provide: SessionService,
            useValue: {
              currentSession,
              setCurrentSession: vi.fn(),
              updateSessionGenderMode: vi.fn(),
              updatePreferenceScoring: vi.fn(),
              addGroupingResult: vi.fn(),
            },
          },
          { provide: GroupingService, useValue: groupingService },
          { provide: I18nService, useClass: MockI18nService },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const fixture = TestBed.createComponent(SessionDetail);
      fixture.detectChanges();
      return { fixture, notifications: TestBed.inject(NotificationService) };
    }

    const result = {
      groups: [],
      strategy: GroupingStrategy.RANDOM,
      settings: { strategy: GroupingStrategy.RANDOM, groupSize: 2, allowPartialGroups: true },
      timestamp: new Date(),
    };

    it('shows an error alert instead of a toast when there are no people', async () => {
      const { fixture, notifications } = await setup([], { validateSettings: vi.fn() });

      fixture.componentInstance.generateGroups();
      fixture.detectChanges();

      expect(fixture.componentInstance.groupingError()).toEqual({ key: 'sessionDetail.snackbar.addPeopleFirst' });
      expect(fixture.nativeElement.querySelector('.alert-error')?.textContent).toContain('sessionDetail.snackbar.addPeopleFirst');
      expect(notifications.toasts()).toEqual([]);
    });

    it('shows the first validation error with its params', async () => {
      const error = { key: 'grouping.warnings.groupSizeLargerThanPeople', params: { groupSize: 5, peopleCount: 2 } };
      const { fixture } = await setup(people, {
        validateSettings: vi.fn().mockReturnValue({ isValid: false, errors: [error, { key: 'other' }], warnings: [] }),
      });

      fixture.componentInstance.generateGroups();

      expect(fixture.componentInstance.groupingError()).toEqual(error);
    });

    it('turns a thrown grouping error into a translatable message', async () => {
      const { fixture } = await setup(people, {
        validateSettings: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        createGroupsWithSession: vi.fn(() => {
          throw { message: 'grouping.errors.noWeightsSelected', params: { count: 0 } };
        }),
      });

      fixture.componentInstance.generateGroups();

      expect(fixture.componentInstance.groupingError()).toEqual({
        key: 'grouping.errors.noWeightsSelected',
        params: { count: 0 },
      });
    });

    it('falls back to a generic message for unknown errors', async () => {
      const { fixture } = await setup(people, {
        validateSettings: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        createGroupsWithSession: vi.fn(() => {
          throw 'boom';
        }),
      });

      fixture.componentInstance.generateGroups();

      expect(fixture.componentInstance.groupingError()).toEqual({ key: 'sessionDetail.snackbar.failedGenerateGroups' });
    });

    it('clears the error and shows a success toast when groups are generated', async () => {
      const { fixture, notifications } = await setup(people, {
        validateSettings: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        createGroupsWithSession: vi.fn().mockReturnValue(result),
      });
      fixture.componentInstance.groupingError.set({ key: 'previous' });

      fixture.componentInstance.generateGroups();

      expect(fixture.componentInstance.groupingError()).toBeNull();
      expect(notifications.toasts()).toEqual([
        expect.objectContaining({ variant: 'success', key: 'sessionDetail.snackbar.groupsGenerated' }),
      ]);
    });
  });
});
