import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { v4 as uuidv4 } from 'uuid';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DEFAULT_PREFERENCE_SCORING, Session, CustomWeightDefinition } from '../../../models/session.model';
import { Gender, Person } from '../../../models/person.model';
import { PreferenceType } from '../../../models/preference.model';
import { GenderMode, GroupingStrategy, GroupingSettings, GroupingResult } from '../../../models/group.model';
import { GroupingService, ValidationMessage } from '../../../core/services/grouping.service';
import { SessionService } from '../../../core/services/session.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { I18nService } from '../../../core/services/i18n.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-session-detail',
  templateUrl: './session-detail.html',
  styleUrl: './session-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe
  ]
})
export class SessionDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private sessionService = inject(SessionService);
  private groupingService = inject(GroupingService);
  private snackBar = inject(MatSnackBar);
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
  selectedWeightIds: string[] = [];
  selectedPerson: Person | null = null;
  readonly genderWeightId = '__gender__';

  // Current grouping result
  currentResult: GroupingResult | null = null;

  // Enum for template
  GroupingStrategy = GroupingStrategy;

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

    const name = prompt(this.i18n.t('sessionDetail.prompt.personName'));
    if (name && name.trim()) {
      const gender = this.promptGender();
      if (!gender) return;
      const person: Person = {
        id: uuidv4(),
        name: name.trim(),
        gender,
        createdAt: new Date()
      };
      this.sessionService.addPersonToSession(this.session.id, person);
      this.showSnack('sessionDetail.snackbar.personAdded', 2000);
    }
  }

  removePerson(person: Person): void {
    if (!this.session) return;

    if (confirm(this.i18n.t('sessionDetail.confirm.removePerson', { name: person.name }))) {
      this.sessionService.removePersonFromSession(this.session.id, person.id);
      this.showSnack('sessionDetail.snackbar.personRemoved', 2000);
    }
  }

  resetSession(): void {
    if (!this.session) return;

    if (confirm(this.i18n.t('sessionDetail.confirm.resetSession', { name: this.session.name }))) {
      this.sessionService.resetSession(this.session.id);
      this.showSnack('sessionDetail.snackbar.sessionReset', 2000);
    }
  }

  addCustomWeight(): void {
    if (!this.session) return;
    const name = this.newWeightNameControl.value.trim();
    if (!name) return;

    this.sessionService.addCustomWeight(this.session.id, name);
    this.newWeightNameControl.setValue('');
  }

  renameCustomWeight(weight: CustomWeightDefinition, name: string): void {
    if (!this.session) return;
    this.sessionService.renameCustomWeight(this.session.id, weight.id, name);
  }

  removeCustomWeight(weight: CustomWeightDefinition): void {
    if (!this.session) return;
    this.sessionService.removeCustomWeight(this.session.id, weight.id);

    if (this.selectedWeightIds.includes(weight.id)) {
      this.selectedWeightIds = this.selectedWeightIds.filter(id => id !== weight.id);
    }
  }

  updatePersonGender(person: Person, gender: Gender | string): void {
    if (!this.session) return;
    const normalizedGender: Gender = gender === 'female' || gender === 'male' || gender === 'nonbinary' || gender === 'unspecified'
      ? gender
      : 'unspecified';
    const updated: Person = { ...person, gender: normalizedGender };
    this.sessionService.updatePersonInSession(this.session.id, updated);
  }

  updatePersonWeight(person: Person, weightId: string, value: number): void {
    if (!this.session) return;
    this.sessionService.setPersonWeight(this.session.id, person.id, weightId, value);
  }

  openPersonWeights(person: Person): void {
    this.selectedPerson = person;
  }

  closePersonWeights(): void {
    this.selectedPerson = null;
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

  getPreference(personId: string, targetPersonId: string): string {
    if (!this.session || !this.session.preferences[personId]) {
      return 'none';
    }

    const prefs = this.session.preferences[personId];
    if (prefs.wantWith.includes(targetPersonId)) {
      return 'wantWith';
    } else if (prefs.avoid.includes(targetPersonId)) {
      return 'avoid';
    }
    return 'none';
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
      this.showSnack('sessionDetail.snackbar.addPeopleFirst');
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
      this.showValidationMessage(validation.errors[0]);
      return;
    }

    try {
      this.currentResult = this.groupingService.createGroupsWithSession(
        this.session,
        settings,
        this.i18n.getCurrentDateLocale()
      );

      this.sessionService.addGroupingResult(this.session.id, this.currentResult);
      this.showSnack('sessionDetail.snackbar.groupsGenerated', 2000);
    } catch (error: unknown) {
      const message = this.getGroupingErrorMessage(error);
      this.snackBar.open(message, this.i18n.t('common.close'), { duration: 3000 });
    }
  }

  regenerateGroups(): void {
    this.generateGroups();
  }

  getPersonName(personId: string): string {
    if (!this.session) return '';
    const person = this.session.people.find(p => p.id === personId);
    return person ? person.name : '';
  }

  back(): void {
    this.router.navigate(['/sessions']);
  }

  private showSnack(messageKey: string, duration = 3000): void {
    this.snackBar.open(this.i18n.t(messageKey), this.i18n.t('common.close'), { duration });
  }

  private showValidationMessage(message: ValidationMessage): void {
    this.snackBar.open(this.i18n.t(message.key, message.params), this.i18n.t('common.close'), {
      duration: 3000
    });
  }

  private getGroupingErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        const params = (error as { params?: Record<string, string | number> }).params;
        return this.i18n.t(message, params);
      }
    }
    return this.i18n.t('sessionDetail.snackbar.failedGenerateGroups');
  }

  private promptGender(): Gender | null {
    const response = prompt(
      this.i18n.t('sessionDetail.prompt.gender'),
      this.i18n.t('sessionDetail.gender.unspecified')
    );
    if (!response) return null;
    const normalized = response.trim().toLowerCase();

    if (normalized === this.i18n.t('sessionDetail.gender.female').toLowerCase() || normalized === 'female' || normalized === 'f') {
      return 'female';
    }
    if (normalized === this.i18n.t('sessionDetail.gender.male').toLowerCase() || normalized === 'male' || normalized === 'm') {
      return 'male';
    }
    if (normalized === this.i18n.t('sessionDetail.gender.nonbinary').toLowerCase() || normalized === 'nonbinary' || normalized === 'nb') {
      return 'nonbinary';
    }
    if (normalized === this.i18n.t('sessionDetail.gender.unspecified').toLowerCase() || normalized === 'unspecified' || normalized === 'u') {
      return 'unspecified';
    }

    return 'unspecified';
  }
}
