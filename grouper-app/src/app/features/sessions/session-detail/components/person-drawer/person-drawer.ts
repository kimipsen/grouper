import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { CustomWeightDefinition } from '../../../../../models/session.model';
import { Gender, Person } from '../../../../../models/person.model';
import { PreferenceMap } from '../../../../../models/preference.model';
import { TranslatePipe } from '../../../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-person-drawer',
  templateUrl: './person-drawer.html',
  styleUrl: './person-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, TranslatePipe],
})
export class PersonDrawer {
  readonly selectedPerson = input.required<Person>();
  readonly people = input.required<Person[]>();
  readonly customWeights = input.required<CustomWeightDefinition[]>();
  readonly preferences = input.required<PreferenceMap>();

  readonly closeDrawer = output<void>();
  readonly updateName = output<string>();
  readonly updateGender = output<Gender>();
  readonly updatePreference = output<{ targetPersonId: string; value: string }>();
  readonly updateWeight = output<{ weightId: string; value: number }>();

  readonly otherPeople = computed(() => this.people().filter(person => person.id !== this.selectedPerson().id));

  getPreference(targetPersonId: string): string {
    const prefs = this.preferences()[this.selectedPerson().id];
    if (!prefs) {
      return 'none';
    }

    if (prefs.wantWith.includes(targetPersonId)) {
      return 'wantWith';
    }
    if (prefs.avoid.includes(targetPersonId)) {
      return 'avoid';
    }
    return 'none';
  }

  onGenderChange(gender: string): void {
    const normalized: Gender = gender === 'female' || gender === 'male' || gender === 'nonbinary' || gender === 'unspecified'
      ? gender
      : 'unspecified';

    this.updateGender.emit(normalized);
  }
}
