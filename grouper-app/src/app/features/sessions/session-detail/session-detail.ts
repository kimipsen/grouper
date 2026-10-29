import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DOCUMENT, DestroyRef, ElementRef, Injector, OnInit, afterNextRender, afterRenderEffect, effect, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Tabs } from 'dkfds';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_PREFERENCE_SCORING, Session, CustomWeightDefinition } from '../../../models/session.model';
import { Gender, Person } from '../../../models/person.model';
import { PreferenceType } from '../../../models/preference.model';
import { GenderMode, GroupingStrategy, GroupingSettings, GroupingResult, WeightedGroupingMode } from '../../../models/group.model';
import { GroupingService, ValidationMessage } from '../../../core/services/grouping.service';
import { SessionService } from '../../../core/services/session.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { I18nService } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { SessionPeopleCard } from './components/session-people-card/session-people-card';
import { PersonDrawer } from './components/person-drawer/person-drawer';
import { GroupingConfigCard, GroupingFieldError } from './components/grouping-config-card/grouping-config-card';
import { CustomWeightsCard } from './components/custom-weights-card/custom-weights-card';
import { GroupsResultCard } from './components/groups-result-card/groups-result-card';

export type SessionTab = 'people' | 'weights' | 'groups' | 'results';

const SESSION_TABS: readonly SessionTab[] = ['people', 'weights', 'groups', 'results'];

function isSessionTab(value: string | null | undefined): value is SessionTab {
  return SESSION_TABS.some((tab) => tab === value);
}

@Component({
  selector: 'app-session-detail',
  templateUrl: './session-detail.html',
  styleUrl: './session-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    TranslatePipe,
    SessionPeopleCard,
    PersonDrawer,
    GroupingConfigCard,
    CustomWeightsCard,
    GroupsResultCard,
  ]
})
export class SessionDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private cdr = inject(ChangeDetectorRef);
  private document = inject(DOCUMENT);
  private sessionService = inject(SessionService);
  private groupingService = inject(GroupingService);
  private notifications = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private i18n = inject(I18nService);

  session: Session | null = null;

  // Grouping settings
  readonly groupingStrategyControl = new FormControl<GroupingStrategy>(GroupingStrategy.RANDOM, { nonNullable: true });
  readonly groupSizeControl = new FormControl<number>(3, { nonNullable: true });
  readonly allowPartialGroupsControl = new FormControl<boolean>(true, { nonNullable: true });
  readonly genderModeControl = new FormControl<GenderMode>('mixed', { nonNullable: true });
  readonly preferenceWantWithControl = new FormControl<number>(DEFAULT_PREFERENCE_SCORING.wantWith, { nonNullable: true });
  readonly preferenceAvoidControl = new FormControl<number>(DEFAULT_PREFERENCE_SCORING.avoid, { nonNullable: true });
  readonly newWeightNameControl = new FormControl<string>('', { nonNullable: true });
  readonly newWeightModeControl = new FormControl<WeightedGroupingMode>('balance', { nonNullable: true });
  selectedWeightIds: string[] = [];
  selectedPersonId: string | null = null;
  panelFocus: 'heading' | 'name' = 'heading';

  /**
   * Looked up on every read: SessionService replaces person objects inside a session that is
   * mutated in place, so a stored Person reference would go stale (e.g. the panel heading).
   */
  get selectedPerson(): Person | null {
    return this.selectedPersonId ? this.getPersonById(this.selectedPersonId) : null;
  }
  readonly genderWeightId = '__gender__';

  // Current grouping result
  currentResult: GroupingResult | null = null;
  readonly groupingError = signal<ValidationMessage | null>(null);
  readonly groupingFieldErrors = signal<GroupingFieldError[]>([]);

  /** Grouping errors that belong to a control; they are linked from the error summary. */
  private static readonly GROUPING_ERROR_FIELDS: Record<string, string> = {
    'sessionDetail.snackbar.addPeopleFirst': 'add-person-button',
    'grouping.errors.noPeople': 'add-person-button',
    'grouping.errors.groupSizeMin': 'group-size',
    'grouping.errors.noWeightsSelected': 'weight-gender',
  };

  // Enum for template
  GroupingStrategy = GroupingStrategy;

  readonly tabs: { id: SessionTab; labelKey: string }[] = [
    { id: 'people', labelKey: 'sessionDetail.tabs.people' },
    { id: 'weights', labelKey: 'sessionDetail.tabs.weights' },
    { id: 'groups', labelKey: 'sessionDetail.tabs.groups' },
    { id: 'results', labelKey: 'sessionDetail.tabs.results' },
  ];
  readonly activeTab = signal<SessionTab>('people');
  private readonly tabContainer = viewChild<ElementRef<HTMLElement>>('tabContainer');
  private dkfdsTabs: { container: HTMLElement; tabs: Tabs } | null = null;

  constructor() {
    // The tab container is rendered once a session is loaded; DKFDS tabs are initialised once per container.
    afterRenderEffect(() => {
      const container = this.tabContainer()?.nativeElement;
      if (!container || this.dkfdsTabs?.container === container) return;
      const tabs = new Tabs(container);
      tabs.init();
      this.dkfdsTabs = { container, tabs };
    });
  }

  get sortedPeople(): Person[] {
    if (!this.session) {
      return [];
    }

    const locale = this.i18n.getCurrentDateLocale();
    return [...this.session.people].sort((a, b) => {
      const byName = a.name.localeCompare(b.name, locale, { sensitivity: 'base' });
      if (byName !== 0) {
        return byName;
      }
      return a.id.localeCompare(b.id);
    });
  }

  ngOnInit(): void {
    const initialTab = this.route.snapshot.queryParamMap.get('tab');
    if (isSessionTab(initialTab)) {
      this.activeTab.set(initialTab);
    }

    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const sessionId = params['id'];
        if (sessionId) {
          this.sessionService.setCurrentSession(sessionId);
        }
      });

    effect(() => {
      const session = this.sessionService.currentSession();
      this.session = session;
      if (!session) {
        this.router.navigate(['/sessions']);
        return;
      }

      this.genderModeControl.setValue(session.genderMode ?? 'mixed', { emitEvent: false });
      const scoring = session.preferenceScoring ?? DEFAULT_PREFERENCE_SCORING;
      this.preferenceWantWithControl.setValue(scoring.wantWith, { emitEvent: false });
      this.preferenceAvoidControl.setValue(scoring.avoid, { emitEvent: false });
    }, { injector: this.injector });

    this.genderModeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(mode => {
      if (!this.session) return;
      this.sessionService.updateSessionGenderMode(this.session.id, mode);
    });

    this.preferenceWantWithControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => {
      this.updatePreferenceScore('wantWith', value);
    });

    this.preferenceAvoidControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => {
      this.updatePreferenceScore('avoid', value);
    });
  }

  // People management
  addPerson(): void {
    if (!this.session) return;

    const person: Person = {
      id: uuidv4(),
      name: '',
      gender: 'unspecified',
      createdAt: new Date()
    };
    this.sessionService.addPersonToSession(this.session.id, person);
    this.panelFocus = 'name';
    this.selectedPersonId = person.id;
    this.notifications.success('sessionDetail.snackbar.personAdded');
  }

  async removePerson(person: Person): Promise<void> {
    if (!this.session) return;

    const confirmed = await this.confirmDialog.confirm({
      titleKey: 'sessionDetail.confirm.deletePersonTitle',
      messageKey: 'sessionDetail.confirm.deletePerson',
      confirmKey: 'sessionDetail.confirm.deletePersonAction',
      params: { name: person.name || this.i18n.t('sessionDetail.unnamedPerson') },
    });
    if (!confirmed || !this.session) return;

    this.sessionService.removePersonFromSession(this.session.id, person.id);
    this.refreshAfterConfirm();
    this.notifications.success('sessionDetail.snackbar.personRemoved');
  }

  async resetSession(): Promise<void> {
    if (!this.session) return;

    const confirmed = await this.confirmDialog.confirm({
      titleKey: 'sessionDetail.confirm.resetSessionTitle',
      messageKey: 'sessionDetail.confirm.resetSession',
      confirmKey: 'sessionDetail.confirm.resetSessionAction',
      params: { name: this.session.name },
    });
    if (!confirmed || !this.session) return;

    this.sessionService.resetSession(this.session.id);
    this.refreshAfterConfirm();
    this.notifications.success('sessionDetail.snackbar.sessionReset');
  }

  addCustomWeight(): void {
    if (!this.session) return;
    const name = this.newWeightNameControl.value.trim();
    if (!name) return;

    this.sessionService.addCustomWeight(this.session.id, name, this.newWeightModeControl.value);
    this.newWeightNameControl.setValue('');
  }

  renameCustomWeight(weight: CustomWeightDefinition, name: string): void {
    if (!this.session) return;
    this.sessionService.renameCustomWeight(this.session.id, weight.id, name);
  }

  updateCustomWeightMode(weight: CustomWeightDefinition, mode: WeightedGroupingMode): void {
    if (!this.session) return;
    this.sessionService.updateCustomWeightMode(this.session.id, weight.id, mode);
  }

  async removeCustomWeight(weight: CustomWeightDefinition): Promise<void> {
    if (!this.session) return;

    const confirmed = await this.confirmDialog.confirm({
      titleKey: 'sessionDetail.confirm.deleteWeightTitle',
      messageKey: 'sessionDetail.confirm.deleteWeight',
      confirmKey: 'sessionDetail.confirm.deleteWeightAction',
      params: { name: weight.name || this.i18n.t('sessionDetail.customWeights.weightLabel') },
    });
    if (!confirmed || !this.session) return;

    this.sessionService.removeCustomWeight(this.session.id, weight.id);
    this.refreshAfterConfirm();

    if (this.selectedWeightIds.includes(weight.id)) {
      this.selectedWeightIds = this.selectedWeightIds.filter(id => id !== weight.id);
    }
  }

  updatePersonGender(personId: string, gender: Gender | string): void {
    if (!this.session) return;
    const person = this.getPersonById(personId);
    if (!person) return;
    const normalizedGender: Gender = gender === 'female' || gender === 'male' || gender === 'nonbinary' || gender === 'unspecified'
      ? gender
      : 'unspecified';
    const updated: Person = { ...person, gender: normalizedGender };
    this.sessionService.updatePersonInSession(this.session.id, updated);
  }

  updatePersonName(personId: string, name: string): void {
    if (!this.session) return;
    const person = this.getPersonById(personId);
    if (!person) return;
    const updated: Person = { ...person, name };
    this.sessionService.updatePersonInSession(this.session.id, updated);
  }

  updatePersonWeight(personId: string, weightId: string, value: number): void {
    if (!this.session) return;
    this.sessionService.setPersonWeight(this.session.id, personId, weightId, value);
  }

  openPersonWeights(person: Person): void {
    this.panelFocus = 'heading';
    this.selectedPersonId = person.id;
  }

  /** Closes the person panel and returns focus to that person's name in the list. */
  closePersonWeights(): void {
    const personId = this.selectedPersonId;
    this.selectedPersonId = null;
    if (personId) {
      afterNextRender(() => this.document.getElementById(`person-name-${personId}`)?.focus(), { injector: this.injector });
    }
  }

  toggleWeightSelection(weightId: string): void {
    if (this.selectedWeightIds.includes(weightId)) {
      this.selectedWeightIds = this.selectedWeightIds.filter(id => id !== weightId);
    } else {
      this.selectedWeightIds = [...this.selectedWeightIds, weightId];
    }
  }

  // Preference management
  setPreference(personId: string, targetPersonId: string, type: PreferenceType | null): void {
    if (!this.session) return;

    if (type === null) {
      this.sessionService.removePreference(this.session.id, personId, targetPersonId);
    } else {
      this.sessionService.setPreference(this.session.id, personId, targetPersonId, type);
    }
  }

  onPreferenceChange(personId: string, targetPersonId: string, value: string): void {
    if (value === 'none') {
      this.setPreference(personId, targetPersonId, null);
    } else if (value === 'wantWith') {
      this.setPreference(personId, targetPersonId, PreferenceType.WANT_WITH);
    } else if (value === 'avoid') {
      this.setPreference(personId, targetPersonId, PreferenceType.AVOID);
    }
  }

  updatePreferenceScore(type: 'wantWith' | 'avoid', value: number): void {
    if (!this.session) return;
    const nextValue = Number.isFinite(value) ? value : 0;
    const current = this.session.preferenceScoring ?? DEFAULT_PREFERENCE_SCORING;

    this.sessionService.updatePreferenceScoring(this.session.id, {
      ...current,
      [type]: nextValue,
    });
  }

  // Grouping
  generateGroups(): void {
    if (!this.session) return;

    if (this.session.people.length === 0) {
      this.showGroupingErrors([{ key: 'sessionDetail.snackbar.addPeopleFirst' }]);
      return;
    }

    const settings: GroupingSettings = {
      strategy: this.groupingStrategyControl.value,
      groupSize: this.groupSizeControl.value,
      allowPartialGroups: this.allowPartialGroupsControl.value,
      genderMode: this.genderModeControl.value,
      weightIds: this.selectedWeightIds
    };

    const validation = this.groupingService.validateSettings(this.session.people.length, settings);
    if (!validation.isValid) {
      this.showGroupingErrors(validation.errors);
      return;
    }

    try {
      this.currentResult = this.groupingService.createGroupsWithSession(
        this.session,
        settings,
        this.i18n.getCurrentDateLocale()
      );

      this.sessionService.addGroupingResult(this.session.id, this.currentResult);
      this.showGroupingErrors([]);
      this.showResults();
      this.notifications.success('sessionDetail.snackbar.groupsGenerated');
    } catch (error: unknown) {
      this.showGroupingErrors([this.getGroupingErrorMessage(error)]);
    }
  }

  /** Called by DKFDS when a tab is selected; keeps the selected tab in the URL so reloading keeps it. */
  onTabSelected(tab: SessionTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      queryParams: { tab: tab === 'people' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  selectTab(tab: SessionTab): void {
    const button = this.document.getElementById(`session-tab-${tab}`);
    if (this.dkfdsTabs && button) {
      this.dkfdsTabs.tabs.activateTab(button, false);
    } else {
      this.onTabSelected(tab);
    }
  }

  /** Moves focus to a field, first selecting the tab it is on (for links that cross tabs). */
  focusField(fieldId: string): void {
    const field = this.document.getElementById(fieldId);
    const tab = field?.closest('[role="tabpanel"]')?.id.replace('session-tabpanel-', '');
    if (isSessionTab(tab) && tab !== this.activeTab()) {
      this.selectTab(tab);
    }
    field?.focus();
  }

  regenerateGroups(): void {
    this.generateGroups();
  }

  /** After generating from the Create groups tab, show the Results tab and move focus to it. */
  private showResults(): void {
    if (this.activeTab() === 'results') return;
    this.selectTab('results');
    this.document.getElementById('session-tabpanel-results')?.focus();
  }

  /**
   * SessionService mutates the session in place, so currentSession() keeps the same reference and
   * doesn't notify this view. Actions confirmed in the shared modal finish outside this view's own
   * event handlers, so the view has to be marked for check explicitly.
   */
  private refreshAfterConfirm(): void {
    this.cdr.markForCheck();
  }

  /** Field errors go to the error summary; the first error without a field is shown as an alert. */
  private showGroupingErrors(errors: ValidationMessage[]): void {
    const fields = SessionDetail.GROUPING_ERROR_FIELDS;
    this.groupingFieldErrors.set(
      errors.filter((error) => fields[error.key]).map((error) => ({ ...error, fieldId: fields[error.key] })),
    );
    this.groupingError.set(errors.find((error) => !fields[error.key]) ?? null);
  }

  private getGroupingErrorMessage(error: unknown): ValidationMessage {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        const params = (error as { params?: Record<string, string | number> }).params;
        return { key: message, params };
      }
    }
    return { key: 'sessionDetail.snackbar.failedGenerateGroups' };
  }

  private getPersonById(personId: string): Person | null {
    if (!this.session) {
      return null;
    }
    return this.session.people.find((person) => person.id === personId) ?? null;
  }

}
