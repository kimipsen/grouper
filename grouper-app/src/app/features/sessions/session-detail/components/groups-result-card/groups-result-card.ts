import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { GroupingResult } from '../../../../../models/group.model';
import { Person } from '../../../../../models/person.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-groups-result-card',
  templateUrl: './groups-result-card.html',
  styleUrl: './groups-result-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatIconModule, TranslatePipe],
})
export class GroupsResultCard {
  readonly result = input.required<GroupingResult>();
  readonly people = input.required<Person[]>();

  readonly regenerate = output<void>();

  readonly peopleById = computed(() => new Map(this.people().map(person => [person.id, person])));

  getPersonName(personId: string): string {
    return this.peopleById().get(personId)?.name ?? '';
  }

  getPersonIcon(personId: string): string {
    const person = this.peopleById().get(personId);
    switch (person?.gender) {
      case 'female':
        return 'female';
      case 'male':
        return 'male';
      case 'nonbinary':
        return 'transgender';
      default:
        return 'person';
    }
  }
}
