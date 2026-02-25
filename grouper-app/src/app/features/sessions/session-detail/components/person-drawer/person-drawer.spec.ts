import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { Person } from '../../../../../models/person.model';
import { PersonDrawer } from './person-drawer';

class MockI18nService {
  t(key: string): string {
    const labels: Record<string, string> = {
      'sessionDetail.customWeights.personWeightsTitle': 'Person weights',
      'sessionDetail.nameLabel': 'Name',
      'sessionDetail.unnamedPerson': 'Unnamed person',
      'sessionDetail.gender.label': 'Gender',
      'sessionDetail.gender.female': 'Female',
      'sessionDetail.gender.male': 'Male',
      'sessionDetail.gender.nonbinary': 'Nonbinary',
      'sessionDetail.gender.unspecified': 'Unspecified',
      'sessionDetail.preferencesTitle': 'Preferences',
      'sessionDetail.preferencesMinPeople': 'Need more people',
      'sessionDetail.preferenceNone': 'None',
      'sessionDetail.preferenceWantWith': 'Want with',
      'sessionDetail.preferenceAvoid': 'Avoid',
      'sessionDetail.customWeights.empty': 'No weights',
    };
    return labels[key] ?? key;
  }
}

const selectedPerson: Person = {
  id: 'p1',
  name: 'Alice',
  gender: 'female',
  weights: { w1: 5 },
  createdAt: new Date(),
};

const otherPerson: Person = {
  id: 'p2',
  name: 'Bob',
  gender: 'male',
  weights: { w1: 7 },
  createdAt: new Date(),
};

describe('PersonDrawer', () => {
  it('renders and emits drawer actions', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonDrawer],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PersonDrawer);
    fixture.componentRef.setInput('selectedPerson', selectedPerson);
    fixture.componentRef.setInput('people', [selectedPerson, otherPerson]);
    fixture.componentRef.setInput('customWeights', [{ id: 'w1', name: 'Karakter' }]);
    fixture.componentRef.setInput('preferences', {
      p1: { wantWith: ['p2'], avoid: [] },
    });

    const closeSpy = vi.fn();
    const nameSpy = vi.fn();
    const genderSpy = vi.fn();
    const preferenceSpy = vi.fn();
    const weightSpy = vi.fn();

    fixture.componentInstance.closeDrawer.subscribe(closeSpy);
    fixture.componentInstance.updateName.subscribe(nameSpy);
    fixture.componentInstance.updateGender.subscribe(genderSpy);
    fixture.componentInstance.updatePreference.subscribe(preferenceSpy);
    fixture.componentInstance.updateWeight.subscribe(weightSpy);

    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector('input[matinput]');
    nameInput.value = 'Alicia';
    nameInput.dispatchEvent(new Event('input'));

    const closeButton = fixture.nativeElement.querySelector('.drawer-header button');
    closeButton.click();

    const selects = fixture.nativeElement.querySelectorAll('select');
    selects[0].value = 'male';
    selects[0].dispatchEvent(new Event('change'));

    selects[1].value = 'avoid';
    selects[1].dispatchEvent(new Event('change'));

    const weightInput = fixture.nativeElement.querySelector('.weight-input');
    weightInput.value = '9';
    weightInput.dispatchEvent(new Event('change'));

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(nameSpy).toHaveBeenCalledWith('Alicia');
    expect(genderSpy).toHaveBeenCalledWith('male');
    expect(preferenceSpy).toHaveBeenCalledWith({ targetPersonId: 'p2', value: 'avoid' });
    expect(weightSpy).toHaveBeenCalledWith({ weightId: 'w1', value: 9 });
  });
});
