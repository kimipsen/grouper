import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { GroupingResult } from '../../../../../models/group.model';
import { Gender, Person } from '../../../../../models/person.model';
import { I18nService } from '../../../../../core/services/i18n.service';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';
import { strategyLabelKey } from '../../strategy-label';

@Component({
  selector: 'app-groups-result-card',
  templateUrl: './groups-result-card.html',
  styleUrl: './groups-result-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class GroupsResultCard {
  private readonly i18n = inject(I18nService);

  readonly result = input.required<GroupingResult>();
  readonly people = input.required<Person[]>();
  readonly historical = input(false);

  readonly regenerate = output<void>();

  readonly peopleById = computed(() => new Map(this.people().map(person => [person.id, person])));

  readonly strategyKey = computed(() => strategyLabelKey(this.result().strategy));
  readonly generatedAt = computed(() => this.formatDate(this.result().timestamp));
  readonly weightsCount = computed(() => this.result().settings.weightIds?.length ?? 0);

  getPersonName(personId: string): string {
    return this.peopleById().get(personId)?.name ?? '';
  }

  getPersonGender(personId: string): Gender {
    return this.peopleById().get(personId)?.gender ?? 'unspecified';
  }

  isRemovedPerson(personId: string): boolean {
    return !this.peopleById().has(personId);
  }

  private formatDate(timestamp: Date): string {
    return new Intl.DateTimeFormat(this.i18n.getCurrentDateLocale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(timestamp);
  }
}
