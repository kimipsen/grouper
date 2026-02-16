import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../../../models/session.model';
import { Person } from '../../../models/person.model';
import { PreferenceType } from '../../../models/preference.model';
import { GroupingStrategy, GroupingSettings, GroupingResult } from '../../../models/group.model';
import { SessionService } from '../../../core/services/session.service';
import { GroupingService } from '../../../core/services/grouping.service';
import { MatSnackBar } from '@angular/material/snack-bar';

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
    private snackBar: MatSnackBar
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

    const name = prompt('Enter person name:');
    if (name && name.trim()) {
      const person: Person = {
        id: uuidv4(),
        name: name.trim(),
        createdAt: new Date()
      };
      this.sessionService.addPersonToSession(this.session.id, person);
      this.snackBar.open('Person added', 'Close', { duration: 2000 });
    }
  }

  removePerson(person: Person): void {
    if (!this.session) return;

    if (confirm(`Remove ${person.name}?`)) {
      this.sessionService.removePersonFromSession(this.session.id, person.id);
      this.snackBar.open('Person removed', 'Close', { duration: 2000 });
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
      this.snackBar.open('Please add people first', 'Close', { duration: 3000 });
      return;
    }

    const settings: GroupingSettings = {
      strategy: this.groupingStrategy,
      groupSize: this.groupSize,
      allowPartialGroups: this.allowPartialGroups
    };

    const validation = this.groupingService.validateSettings(this.session.people.length, settings);
    if (!validation.isValid) {
      this.snackBar.open(validation.errors[0], 'Close', { duration: 3000 });
      return;
    }

    try {
      this.currentResult = this.groupingService.createGroups(
        this.session.people,
        settings,
        this.session.preferences
      );

      this.sessionService.addGroupingResult(this.session.id, this.currentResult);
      this.snackBar.open('Groups generated successfully', 'Close', { duration: 2000 });
    } catch (error: any) {
      this.snackBar.open(error.message || 'Failed to generate groups', 'Close', { duration: 3000 });
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
}
