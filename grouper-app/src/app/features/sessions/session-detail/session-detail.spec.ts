import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GroupingService } from '../../../core/services/grouping.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SessionService } from '../../../core/services/session.service';
import { GroupingStrategy } from '../../../models/group.model';
import { Session } from '../../../models/session.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
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
      'sessionDetail.regenerateGroups': 'Generate new groups',
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
        provideRouter([]),
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
        provideRouter([]),
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
    expect(fixture.componentInstance.selectedPersonId).toBe((addedPerson as unknown as { id: string }).id);
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
          provideRouter([]),
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

    it('links the "add people first" error to the Add person button in the error summary', async () => {
      const { fixture, notifications } = await setup([], { validateSettings: vi.fn() });

      fixture.componentInstance.generateGroups();
      fixture.detectChanges();

      expect(fixture.componentInstance.groupingFieldErrors()).toEqual([
        { key: 'sessionDetail.snackbar.addPeopleFirst', fieldId: 'add-person-button' },
      ]);
      expect(fixture.componentInstance.groupingError()).toBeNull();
      const link = fixture.nativeElement.querySelector('nav .alert-error a.function-link');
      expect(link?.getAttribute('href')).toBe('#add-person-button');
      expect(fixture.nativeElement.querySelector('#add-person-button')).not.toBeNull();
      expect(notifications.toasts()).toEqual([]);
    });

    it('splits validation errors into field errors and a general alert', async () => {
      const { fixture } = await setup(people, {
        validateSettings: vi.fn().mockReturnValue({
          isValid: false,
          errors: [{ key: 'grouping.errors.groupSizeMin' }, { key: 'unmapped.error', params: { n: 1 } }],
          warnings: [],
        }),
      });

      fixture.componentInstance.generateGroups();

      expect(fixture.componentInstance.groupingFieldErrors()).toEqual([
        { key: 'grouping.errors.groupSizeMin', fieldId: 'group-size' },
      ]);
      expect(fixture.componentInstance.groupingError()).toEqual({ key: 'unmapped.error', params: { n: 1 } });
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
          throw { message: 'grouping.errors.preferencesRequired', params: { count: 0 } };
        }),
      });

      fixture.componentInstance.generateGroups();

      expect(fixture.componentInstance.groupingError()).toEqual({
        key: 'grouping.errors.preferencesRequired',
        params: { count: 0 },
      });
      expect(fixture.componentInstance.groupingFieldErrors()).toEqual([]);
    });

    it('links a thrown "no weights selected" error to the weight checkboxes', async () => {
      const { fixture } = await setup(people, {
        validateSettings: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        createGroupsWithSession: vi.fn(() => {
          throw { message: 'grouping.errors.noWeightsSelected' };
        }),
      });

      fixture.componentInstance.generateGroups();

      expect(fixture.componentInstance.groupingFieldErrors()).toEqual([
        { key: 'grouping.errors.noWeightsSelected', params: undefined, fieldId: 'weight-gender' },
      ]);
      expect(fixture.componentInstance.groupingError()).toBeNull();
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
      fixture.componentInstance.groupingFieldErrors.set([{ key: 'grouping.errors.groupSizeMin', fieldId: 'group-size' }]);

      fixture.componentInstance.generateGroups();

      expect(fixture.componentInstance.groupingError()).toBeNull();
      expect(fixture.componentInstance.groupingFieldErrors()).toEqual([]);
      expect(notifications.toasts()).toEqual([
        expect.objectContaining({ variant: 'success', key: 'sessionDetail.snackbar.groupsGenerated' }),
      ]);
    });
  });

  describe('destructive actions', () => {
    const person: Person = { id: 'p1', name: '', gender: 'female', createdAt: new Date() };
    const weight = { id: 'w1', name: 'Skill', mode: 'balance' as const };

    async function setup() {
      const sessionService = {
        currentSession: signal<Session | null>({
          id: 'session-1',
          name: 'Demo Session',
          description: '',
          people: [person],
          preferences: {},
          groupingHistory: [],
          customWeights: [weight],
          genderMode: 'mixed',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        setCurrentSession: vi.fn(),
        updateSessionGenderMode: vi.fn(),
        updatePreferenceScoring: vi.fn(),
        removePersonFromSession: vi.fn(),
        removeCustomWeight: vi.fn(),
        resetSession: vi.fn(),
        updatePersonInSession: vi.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [SessionDetail],
        providers: [
          { provide: ActivatedRoute, useValue: { params: new BehaviorSubject({ id: 'session-1' }) } },
          provideRouter([]),
          { provide: SessionService, useValue: sessionService },
          { provide: GroupingService, useValue: {} },
          { provide: I18nService, useClass: MockI18nService },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const fixture = TestBed.createComponent(SessionDetail);
      fixture.detectChanges();
      return {
        fixture,
        component: fixture.componentInstance,
        sessionService,
        confirmDialog: TestBed.inject(ConfirmDialogService),
        notifications: TestBed.inject(NotificationService),
      };
    }

    it.each([
      {
        action: 'removePerson',
        run: (component: SessionDetail) => component.removePerson(person),
        request: {
          titleKey: 'sessionDetail.confirm.deletePersonTitle',
          messageKey: 'sessionDetail.confirm.deletePerson',
          confirmKey: 'sessionDetail.confirm.deletePersonAction',
          params: { name: 'sessionDetail.unnamedPerson' },
        },
        serviceMethod: 'removePersonFromSession',
        serviceArgs: ['session-1', 'p1'],
      },
      {
        action: 'removeCustomWeight',
        run: (component: SessionDetail) => component.removeCustomWeight(weight),
        request: {
          titleKey: 'sessionDetail.confirm.deleteWeightTitle',
          messageKey: 'sessionDetail.confirm.deleteWeight',
          confirmKey: 'sessionDetail.confirm.deleteWeightAction',
          params: { name: 'Skill' },
        },
        serviceMethod: 'removeCustomWeight',
        serviceArgs: ['session-1', 'w1'],
      },
      {
        action: 'resetSession',
        run: (component: SessionDetail) => component.resetSession(),
        request: {
          titleKey: 'sessionDetail.confirm.resetSessionTitle',
          messageKey: 'sessionDetail.confirm.resetSession',
          confirmKey: 'sessionDetail.confirm.resetSessionAction',
          params: { name: 'Demo Session' },
        },
        serviceMethod: 'resetSession',
        serviceArgs: ['session-1'],
      },
    ] as const)('$action asks for confirmation and only acts when confirmed', async ({ run, request, serviceMethod, serviceArgs }) => {
      const nativeConfirm = vi.spyOn(window, 'confirm');
      const { component, sessionService, confirmDialog } = await setup();

      const cancelled = run(component);
      expect(confirmDialog.request()).toEqual(expect.objectContaining(request));
      confirmDialog.settle(false);
      await cancelled;
      expect(sessionService[serviceMethod]).not.toHaveBeenCalled();

      const confirmed = run(component);
      confirmDialog.settle(true);
      await confirmed;
      expect(sessionService[serviceMethod]).toHaveBeenCalledWith(...serviceArgs);
      expect(nativeConfirm).not.toHaveBeenCalled();
    });

    it('re-renders the people list after a delete confirmed in the shared modal', async () => {
      const { fixture, component, sessionService, confirmDialog } = await setup();
      sessionService.removePersonFromSession.mockImplementation(() => {
        // SessionService mutates the session in place without changing the signal's reference.
        const session = sessionService.currentSession();
        if (session) session.people = [];
      });
      expect(fixture.nativeElement.querySelectorAll('.person-item')).toHaveLength(1);

      const deletion = component.removePerson(person);
      confirmDialog.settle(true);
      await deletion;
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelectorAll('.person-item')).toHaveLength(0);
    });

    it('keeps the person panel in sync when the person object is replaced or removed', async () => {
      const { fixture, component, sessionService, confirmDialog } = await setup();
      const session = sessionService.currentSession() as Session;
      const root: HTMLElement = fixture.nativeElement;
      const panelHeading = () => root.querySelector('app-person-drawer h3')?.textContent?.trim();
      // Like SessionService: replace the Person object inside the same, mutated session.
      sessionService.updatePersonInSession.mockImplementation((_id: string, updated: Person) => {
        session.people = session.people.map((existing) => (existing.id === updated.id ? updated : existing));
      });
      sessionService.removePersonFromSession.mockImplementation(() => {
        session.people = [];
      });

      root.querySelector<HTMLButtonElement>('.person-name')?.click();
      await fixture.whenStable();
      expect(panelHeading()).toBe('sessionDetail.unnamedPerson');

      const nameInput = root.querySelector<HTMLInputElement>('#person-name') as HTMLInputElement;
      nameInput.value = 'Renamed';
      nameInput.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(component.selectedPerson?.name).toBe('Renamed');
      expect(panelHeading()).toBe('Renamed');

      const deletion = component.removePerson(person);
      confirmDialog.settle(true);
      await deletion;
      await fixture.whenStable();
      expect(component.selectedPerson).toBeNull();
      expect(root.querySelector('app-person-drawer')).toBeNull();
    });
  });
});
