import { ChangeDetectorRef, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GroupingService } from '../../../core/services/grouping.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SessionService } from '../../../core/services/session.service';
import { SessionStorageService } from '../../../core/services/session-storage.service';
import { GroupingStrategy } from '../../../models/group.model';
import { Session } from '../../../models/session.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { Person } from '../../../models/person.model';
import { getAxeViolations } from '../../../../testing/axe';
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
        addPersonToSession: vi.fn(),
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

    it('updates the gender badge in the people list when gender changes in the person panel', async () => {
      const { fixture, sessionService } = await setup();
      const session = sessionService.currentSession() as Session;
      const root: HTMLElement = fixture.nativeElement;
      sessionService.updatePersonInSession.mockImplementation((_id: string, updated: Person) => {
        session.people = session.people.map((existing) => (existing.id === updated.id ? updated : existing));
      });

      root.querySelector<HTMLButtonElement>('#person-name-p1')?.click();
      await fixture.whenStable();
      expect(root.querySelector('#person-name-p1 .badge')?.textContent?.trim()).toBe('sessionDetail.gender.female');

      root.querySelector<HTMLInputElement>('#person-gender-male')?.click();
      await fixture.whenStable();
      expect(root.querySelector('#person-name-p1 .badge')?.textContent?.trim()).toBe('sessionDetail.gender.male');
    });

    it('returns focus to the person name when the panel closes, and focuses the name field for a new person', async () => {
      const { fixture, component, sessionService } = await setup();
      const root: HTMLElement = fixture.nativeElement;
      document.body.appendChild(root);
      sessionService.addPersonToSession.mockImplementation((_id: string, added: Person) => {
        (sessionService.currentSession() as Session).people.push(added);
      });

      root.querySelector<HTMLButtonElement>('#person-name-p1')?.click();
      await fixture.whenStable();
      expect(document.activeElement?.id).toBe('person-drawer-heading');

      root.querySelector<HTMLButtonElement>('app-person-drawer .drawer-header button')?.click();
      await fixture.whenStable();
      expect(root.querySelector('app-person-drawer')).toBeNull();
      expect(document.activeElement?.id).toBe('person-name-p1');

      root.querySelector<HTMLButtonElement>('#add-person-button')?.click();
      await fixture.whenStable();
      expect(component.panelFocus).toBe('name');
      expect(document.activeElement?.id).toBe('person-name');
      root.remove();
    });
  });

  describe('tabs', () => {
    const person: Person = { id: 'p1', name: 'Ada', gender: 'female', createdAt: new Date() };
    const result = {
      groups: [],
      strategy: GroupingStrategy.RANDOM,
      settings: { strategy: GroupingStrategy.RANDOM, groupSize: 2, allowPartialGroups: true },
      timestamp: new Date(),
    };

    async function setup(options: { people?: Person[]; tab?: string } = {}) {
      const currentSession = signal<Session | null>({
        id: 'session-1',
        name: 'Demo Session',
        description: '',
        people: options.people ?? [person],
        preferences: {},
        groupingHistory: [],
        customWeights: [],
        genderMode: 'mixed',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const queryParams: Record<string, string> = options.tab ? { tab: options.tab } : {};

      await TestBed.configureTestingModule({
        imports: [SessionDetail],
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { params: new BehaviorSubject({ id: 'session-1' }), snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
          {
            provide: SessionService,
            useValue: {
              currentSession,
              setCurrentSession: vi.fn(),
              updateSessionGenderMode: vi.fn(),
              updatePreferenceScoring: vi.fn(),
              // Like the real service: mutates the session's history in place.
              addGroupingResult: vi.fn().mockImplementation((_id: string, added: typeof result) => {
                currentSession()?.groupingHistory.push(added);
              }),
            },
          },
          {
            provide: GroupingService,
            useValue: {
              validateSettings: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
              createGroupsWithSession: vi.fn().mockReturnValue(result),
            },
          },
          { provide: I18nService, useClass: MockI18nService },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(SessionDetail);
      const root: HTMLElement = fixture.nativeElement;
      document.body.appendChild(root);
      await fixture.whenStable();
      return { fixture, component: fixture.componentInstance, root, navigate };
    }

    function tab(root: HTMLElement, id: string): HTMLButtonElement {
      return root.querySelector<HTMLButtonElement>(`#session-tab-${id}`) as HTMLButtonElement;
    }

    function visiblePanels(root: HTMLElement): string[] {
      return Array.from(root.querySelectorAll<HTMLElement>('.tab-panel'))
        .filter((panel) => !panel.hidden)
        .map((panel) => panel.id);
    }

    afterEach(() => document.querySelectorAll('app-session-detail').forEach((element) => element.remove()));

    it('renders DKFDS tabs with the People tab selected and no axe violations', async () => {
      const { root } = await setup();

      const tablist = root.querySelector('.tab-container > .tab-list[role="tablist"]');
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.tab-list > button.tab-button[role="tab"]'));
      expect(tablist?.getAttribute('aria-label')).toBe('sessionDetail.tabs.label');
      expect(buttons.map((button) => button.textContent?.trim())).toEqual([
        'sessionDetail.tabs.people',
        'sessionDetail.tabs.weights',
        'sessionDetail.tabs.groups',
        'sessionDetail.tabs.results',
      ]);
      expect(buttons.map((button) => button.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
      expect(buttons.map((button) => button.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
      for (const button of buttons) {
        const panel = root.querySelector(`#${button.getAttribute('aria-controls')}`);
        expect(panel?.getAttribute('role')).toBe('tabpanel');
        expect(panel?.getAttribute('aria-labelledby')).toBe(button.id);
      }
      expect(visiblePanels(root)).toEqual(['session-tabpanel-people']);
      expect(await getAxeViolations(root)).toEqual([]);
    });

    it('switches tabs on click and with the arrow, Home and End keys, keeping the tab in the URL', async () => {
      const { fixture, component, root, navigate } = await setup();

      tab(root, 'groups').click();
      await fixture.whenStable();
      expect(component.activeTab()).toBe('groups');
      expect(visiblePanels(root)).toEqual(['session-tabpanel-groups']);
      expect(tab(root, 'groups').getAttribute('aria-selected')).toBe('true');
      expect(tab(root, 'people').getAttribute('tabindex')).toBe('-1');
      expect(navigate).toHaveBeenLastCalledWith([], { queryParams: { tab: 'groups' }, queryParamsHandling: 'merge', replaceUrl: true });

      tab(root, 'groups').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await fixture.whenStable();
      expect(component.activeTab()).toBe('results');
      expect(document.activeElement).toBe(tab(root, 'results'));

      tab(root, 'results').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await fixture.whenStable();
      expect(document.activeElement).toBe(tab(root, 'people'));
      expect(navigate).toHaveBeenLastCalledWith([], { queryParams: { tab: null }, queryParamsHandling: 'merge', replaceUrl: true });

      tab(root, 'people').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await fixture.whenStable();
      expect(component.activeTab()).toBe('results');

      tab(root, 'results').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await fixture.whenStable();
      expect(component.activeTab()).toBe('groups');
      expect(visiblePanels(root)).toEqual(['session-tabpanel-groups']);

      tab(root, 'groups').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await fixture.whenStable();
      expect(component.activeTab()).toBe('people');
      expect(document.activeElement).toBe(tab(root, 'people'));
    });

    it('opens the tab named in the URL and ignores unknown tab names', async () => {
      const { root } = await setup({ tab: 'weights' });
      expect(visiblePanels(root)).toEqual(['session-tabpanel-weights']);
      expect(tab(root, 'weights').getAttribute('aria-selected')).toBe('true');
      root.remove();
      TestBed.resetTestingModule();

      const fallback = await setup({ tab: 'unknown' });
      expect(visiblePanels(fallback.root)).toEqual(['session-tabpanel-people']);
    });

    it('shows an empty state on the Results tab before groups are generated', async () => {
      const { root } = await setup({ tab: 'results' });

      const panel = root.querySelector('#session-tabpanel-results');
      expect(visiblePanels(root)).toEqual(['session-tabpanel-results']);
      expect(panel?.textContent).toContain('sessionDetail.tabs.resultsEmpty');
      expect(panel?.querySelector('app-groups-result-card')).toBeNull();
    });

    it('switches to the Results tab and focuses it after groups are generated', async () => {
      const { fixture, component, root } = await setup({ tab: 'groups' });

      root.querySelector<HTMLButtonElement>('#session-tabpanel-groups .button-primary')?.click();
      await fixture.whenStable();

      expect(component.activeTab()).toBe('results');
      expect(visiblePanels(root)).toEqual(['session-tabpanel-results']);
      expect(document.activeElement?.id).toBe('session-tabpanel-results');
      expect(root.querySelector('#session-tabpanel-results app-groups-result-card')).not.toBeNull();
    });

    it('keeps focus on the Results tab when groups are regenerated there', async () => {
      const { fixture, component, root } = await setup({ tab: 'results' });
      component.generateGroups();
      await fixture.whenStable();

      const regenerate = root.querySelector<HTMLButtonElement>('#session-tabpanel-results app-groups-result-card button');
      regenerate?.focus();
      regenerate?.click();
      await fixture.whenStable();

      expect(component.activeTab()).toBe('results');
      expect(document.activeElement).toBe(regenerate);
    });

    it('follows an error summary link to the Add person button on the People tab', async () => {
      const { fixture, component, root } = await setup({ people: [], tab: 'groups' });
      component.generateGroups();
      await fixture.whenStable();

      root.querySelector<HTMLAnchorElement>('#session-tabpanel-groups nav a.function-link')?.click();
      await fixture.whenStable();

      expect(component.activeTab()).toBe('people');
      expect(visiblePanels(root)).toEqual(['session-tabpanel-people']);
      expect(tab(root, 'people').getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement?.id).toBe('add-person-button');
    });

    it('stays on the current tab when an error summary link points to a field on it', async () => {
      const { fixture, component } = await setup({ tab: 'groups' });
      await fixture.whenStable();

      component.focusField('group-size');

      expect(component.activeTab()).toBe('groups');
      expect(document.activeElement?.id).toBe('group-size');
    });

    it('goes from the person panel to the weight name field on the Custom weights tab', async () => {
      const { fixture, component, root } = await setup();
      root.querySelector<HTMLButtonElement>('#person-name-p1')?.click();
      await fixture.whenStable();

      root.querySelector<HTMLButtonElement>('app-person-drawer .drawer-section button.function-link')?.click();
      await fixture.whenStable();

      expect(component.activeTab()).toBe('weights');
      expect(visiblePanels(root)).toEqual(['session-tabpanel-weights']);
      expect(document.activeElement?.id).toBe('new-weight-name');
    });
  });
});

describe('SessionDetail history view', () => {
  class HistoryI18nService {
    locale = 'en-US';
    t(key: string, params?: Record<string, string | number>): string {
      return params ? `${key} ${Object.values(params).join(' ')}` : key;
    }
    getCurrentDateLocale(): string {
      return this.locale;
    }
  }

  function entry(day: number, strategy = GroupingStrategy.RANDOM, overallSatisfaction?: number) {
    return {
      groups: [],
      strategy,
      settings: { strategy, groupSize: 2, allowPartialGroups: true },
      timestamp: new Date(Date.UTC(2026, 2, day, 12, 0, 0)),
      overallSatisfaction,
    };
  }

  function makeSession(id: string, history: ReturnType<typeof entry>[]): Session {
    return {
      id,
      name: id,
      description: '',
      people: [{ id: 'p1', name: 'Ada', gender: 'female', createdAt: new Date() }],
      preferences: {},
      groupingHistory: history,
      customWeights: [],
      genderMode: 'mixed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async function setup(sessions: Session[], options: { tab?: string } = {}) {
    const storage = {
      loadSessions: () => sessions,
      getCurrentSessionId: () => sessions[0].id,
      saveSessions: vi.fn(),
      saveCurrentSessionId: vi.fn(),
      clearCurrentSessionId: vi.fn(),
    };
    const i18n = new HistoryI18nService();
    const createGroupsWithSession = vi.fn().mockImplementation(() => entry(20));
    const params$ = new BehaviorSubject({ id: sessions[0].id });
    const queryParams: Record<string, string> = { tab: options.tab ?? 'results' };

    await TestBed.configureTestingModule({
      imports: [SessionDetail],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: params$, snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
        { provide: SessionStorageService, useValue: storage },
        {
          provide: GroupingService,
          useValue: {
            validateSettings: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
            createGroupsWithSession,
          },
        },
        { provide: I18nService, useValue: i18n },
      ],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SessionDetail);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, root, i18n, params$, sessionService: TestBed.inject(SessionService) };
  }

  const alertOf = (root: HTMLElement) => root.querySelector<HTMLElement>('#history-alert');
  const entryButtons = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLButtonElement>('.history-entry'));

  afterEach(() => document.querySelectorAll('app-session-detail').forEach((element) => element.remove()));

  it('shows the latest result after load without generating, and no historical alert', async () => {
    const { root, component } = await setup([makeSession('s1', [entry(1), entry(2), entry(3)])]);

    expect(component.viewedResult).toBe(component.latestResult);
    expect(root.querySelector('app-groups-result-card')).not.toBeNull();
    expect(alertOf(root)).toBeNull();
    expect(root.textContent).not.toContain('sessionDetail.tabs.resultsEmpty');
  });

  it('lists entries newest-first', async () => {
    const { root, component } = await setup([makeSession('s1', [entry(1), entry(2, GroupingStrategy.WEIGHTED), entry(3)])]);

    expect(component.historyEntries().map((e) => e.index)).toEqual([2, 1, 0]);
    expect(entryButtons(root)).toHaveLength(3);
    expect(entryButtons(root)[1].textContent).toContain('sessionDetail.strategyWeighted');
    expect(entryButtons(root)[0].getAttribute('aria-current')).toBe('true');
  });

  it('shows an older entry read-only with the dated alert and moves focus to it', async () => {
    const history = [entry(1), entry(2), entry(3)];
    const { fixture, root, component } = await setup([makeSession('s1', history)]);

    entryButtons(root)[2].click();
    await fixture.whenStable();

    expect(component.viewedHistoryIndex()).toBe(0);
    expect(component.viewedResult).toBe(component.session?.groupingHistory[0]);
    const alert = alertOf(root);
    expect(alert?.getAttribute('role')).toBe('status');
    expect(alert?.textContent).toContain('sessionDetail.history.viewingFrom');
    expect(alert?.textContent).toContain(component.formatResultDate(history[0]));
    expect(alert?.textContent).toContain('2026');
    expect(document.activeElement).toBe(alert);
    expect(root.querySelector('app-groups-result-card .button')).toBeNull();
    expect(entryButtons(root).map((b) => b.getAttribute('aria-current'))).toEqual([null, null, 'true']);
  });

  it('re-focuses the alert when another older entry is selected and ignores re-selecting the same entry', async () => {
    const { fixture, root, component } = await setup([makeSession('s1', [entry(1), entry(2), entry(3)])]);

    component.selectHistoryEntry(0);
    await fixture.whenStable();
    (document.activeElement as HTMLElement).blur();
    component.selectHistoryEntry(0);
    await fixture.whenStable();
    expect(document.activeElement).not.toBe(alertOf(root));

    component.selectHistoryEntry(1);
    await fixture.whenStable();
    expect(component.viewedHistoryIndex()).toBe(1);
    expect(document.activeElement).toBe(alertOf(root));
  });

  it('returns to the latest with "Show latest result" and focuses the card heading', async () => {
    const { fixture, root, component } = await setup([makeSession('s1', [entry(1), entry(2)])]);
    component.selectHistoryEntry(0);
    await fixture.whenStable();

    alertOf(root)?.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();

    expect(component.viewedHistoryIndex()).toBeNull();
    expect(alertOf(root)).toBeNull();
    expect(document.activeElement?.id).toBe('results-heading');
  });

  it('treats selecting the newest entry as latest mode without an alert', async () => {
    const { fixture, root, component } = await setup([makeSession('s1', [entry(1), entry(2)])]);

    component.selectHistoryEntry(1);
    await fixture.whenStable();

    expect(component.viewedHistoryIndex()).toBeNull();
    expect(alertOf(root)).toBeNull();
  });

  it('returns to the latest when a grouping is generated while viewing history, without focusing the alert', async () => {
    const { fixture, root, component } = await setup([makeSession('s1', [entry(1), entry(2)])]);
    component.selectHistoryEntry(0);
    await fixture.whenStable();

    component.generateGroups();
    await fixture.whenStable();

    expect(component.viewedHistoryIndex()).toBeNull();
    expect(alertOf(root)).toBeNull();
    expect(component.historyEntries().map((e) => e.index)).toEqual([2, 1, 0]);
    expect(entryButtons(root)).toHaveLength(3);
    expect(document.activeElement?.id).not.toBe('results-heading');
  });

  it('shows the empty text and no list for an empty history, and no list for a single entry', async () => {
    const empty = await setup([makeSession('s1', [])]);
    expect(empty.root.textContent).toContain('sessionDetail.tabs.resultsEmpty');
    expect(empty.root.querySelector('app-groups-history-list .history-list')).toBeNull();
    empty.root.remove();
    TestBed.resetTestingModule();

    const single = await setup([makeSession('s1', [entry(1)])]);
    expect(single.root.querySelector('app-groups-result-card')).not.toBeNull();
    expect(single.root.querySelector('app-groups-history-list .history-list')).toBeNull();
  });

  it('falls back to the empty state after a confirmed reset while viewing history', async () => {
    const { fixture, root, component } = await setup([makeSession('s1', [entry(1), entry(2)])]);
    component.selectHistoryEntry(0);
    await fixture.whenStable();

    const reset = component.resetSession();
    TestBed.inject(ConfirmDialogService).settle(true);
    await reset;
    await fixture.whenStable();

    expect(component.viewedHistoryIndex()).toBeNull();
    expect(component.historyEntries()).toEqual([]);
    expect(alertOf(root)).toBeNull();
    expect(root.textContent).toContain('sessionDetail.tabs.resultsEmpty');
  });

  it('clamps a stale index to the latest and resets it when the session changes', async () => {
    const { fixture, root, component, sessionService, params$ } = await setup([
      makeSession('s1', [entry(1), entry(2), entry(3)]),
      makeSession('s2', [entry(4)]),
    ]);
    component.selectHistoryEntry(0);
    await fixture.whenStable();

    component.viewedHistoryIndex.set(9);
    expect(component.isViewingHistory).toBe(false);
    expect(component.viewedResult).toBe(component.latestResult);

    component.viewedHistoryIndex.set(0);
    params$.next({ id: 's2' });
    sessionService.setCurrentSession('s2');
    await fixture.whenStable();

    expect(component.session?.id).toBe('s2');
    expect(component.viewedHistoryIndex()).toBeNull();
    expect(alertOf(root)).toBeNull();
    expect(component.historyEntries().map((e) => e.index)).toEqual([0]);
  });

  it('updates the alert date when the locale changes while viewing history', async () => {
    const { fixture, root, component, i18n } = await setup([makeSession('s1', [entry(1), entry(2)])]);
    component.selectHistoryEntry(0);
    await fixture.whenStable();
    const before = alertOf(root)?.textContent;

    i18n.locale = 'da-DK';
    fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();

    expect(alertOf(root)?.textContent).not.toBe(before);
    expect(alertOf(root)?.textContent).toContain(component.formatResultDate(component.session!.groupingHistory[0]));
  });

  it('selects the right entry for identical timestamps and renders a badge for satisfaction 0', async () => {
    const first = entry(1, GroupingStrategy.RANDOM, 0);
    const second = entry(1, GroupingStrategy.WEIGHTED, 5);
    const { fixture, root, component } = await setup([makeSession('s1', [first, second, entry(2)])]);

    expect(entryButtons(root)[2].querySelector('.badge')).not.toBeNull();
    entryButtons(root)[1].click();
    await fixture.whenStable();

    expect(component.viewedResult).toBe(component.session?.groupingHistory[1]);
  });

  it('keeps the history list input stable across change detection with no history change', async () => {
    const { fixture, component } = await setup([makeSession('s1', [entry(1), entry(2)])]);
    const before = component.historyEntries();

    fixture.detectChanges();
    component.selectHistoryEntry(0);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.historyEntries()).toBe(before);
  });

  it('has no axe violations for the Results tab in history mode', async () => {
    const { fixture, root, component } = await setup([makeSession('s1', [entry(1, GroupingStrategy.RANDOM, 0), entry(2), entry(3)])]);
    component.selectHistoryEntry(0);
    await fixture.whenStable();

    expect(await getAxeViolations(root)).toEqual([]);
  });
});
