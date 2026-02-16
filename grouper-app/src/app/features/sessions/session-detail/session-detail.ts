import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../../../models/session.model';
import { Person } from '../../../models/person.model';
import { PreferenceType } from '../../../models/preference.model';
import { GroupingStrategy, GroupingSettings, GroupingResult } from '../../../models/group.model';
import { GroupingService, ValidationMessage } from '../../../core/services/grouping.service';
import { SessionService } from '../../../core/services/session.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-session-detail',
  standalone: false,
  templateUrl: './session-detail.html',
  styleUrl: './session-detail.scss',
})
export class SessionDetail implements OnInit, OnDestroy {
  session: Session | null = null;
  private destroy$ = new Subject<void>();

  // Grouping settings
  groupingStrategy: GroupingStrategy = GroupingStrategy.RANDOM;
  groupSize: number = 3;
  allowPartialGroups: boolean = true;

  // Current grouping result
  currentResult: GroupingResult | null = null;

  // Enum for template
  GroupingStrategy = GroupingStrategy;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessionService: SessionService,
    private groupingService: GroupingService,
    private snackBar: MatSnackBar,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const sessionId = params['id'];
        if (sessionId) {
          this.sessionService.setCurrentSession(sessionId);
        }
      });

    this.sessionService.currentSession$
      .pipe(takeUntil(this.destroy$))
      .subscribe(session => {
        this.session = session;
        if (!session) {
          this.router.navigate(['/sessions']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // People management
  addPerson(): void {
    if (!this.session) return;

    const name = prompt(this.i18n.t('sessionDetail.prompt.personName'));
    if (name && name.trim()) {
      const person: Person = {
        id: uuidv4(),
        name: name.trim(),
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

  // Grouping
  generateGroups(): void {
    if (!this.session) return;

    if (this.session.people.length === 0) {
      this.showSnack('sessionDetail.snackbar.addPeopleFirst');
      return;
    }

    const settings: GroupingSettings = {
      strategy: this.groupingStrategy,
      groupSize: this.groupSize,
      allowPartialGroups: this.allowPartialGroups
    };

    const validation = this.groupingService.validateSettings(this.session.people.length, settings);
    if (!validation.isValid) {
      this.showValidationMessage(validation.errors[0]);
      return;
    }

    try {
      this.currentResult = this.groupingService.createGroups(
        this.session.people,
        settings,
        this.session.preferences
      );

      this.sessionService.addGroupingResult(this.session.id, this.currentResult);
      this.showSnack('sessionDetail.snackbar.groupsGenerated', 2000);
    } catch (error: any) {
      const message = typeof error?.message === 'string'
        ? this.i18n.t(error.message, error.params)
        : this.i18n.t('sessionDetail.snackbar.failedGenerateGroups');
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
}
