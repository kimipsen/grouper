import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Person } from '../../../../../models/person.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-session-people-card',
  templateUrl: './session-people-card.html',
  styleUrl: './session-people-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatIconModule, TranslatePipe],
})
export class SessionPeopleCard {
  readonly people = input.required<Person[]>();

  readonly addPerson = output<void>();
  readonly openPerson = output<Person>();
  readonly removePerson = output<Person>();

  getPersonIcon(person: Person): string {
    switch (person.gender) {
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
