import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Person } from '../../../../../models/person.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-session-people-card',
  templateUrl: './session-people-card.html',
  styleUrl: './session-people-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class SessionPeopleCard {
  readonly people = input.required<Person[]>();

  readonly addPerson = output<void>();
  readonly openPerson = output<Person>();
  readonly removePerson = output<Person>();
}
