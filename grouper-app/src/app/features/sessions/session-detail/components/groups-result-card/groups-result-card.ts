import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GroupingResult } from '../../../../../models/group.model';
import { Person } from '../../../../../models/person.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-groups-result-card',
  templateUrl: './groups-result-card.html',
  styleUrl: './groups-result-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class GroupsResultCard {
  readonly result = input.required<GroupingResult>();
  readonly people = input.required<Person[]>();

  readonly regenerate = output<void>();

  readonly peopleById = computed(() => new Map(this.people().map(person => [person.id, person])));

  getPersonName(personId: string): string {
    return this.peopleById().get(personId)?.name ?? '';
  }
}
