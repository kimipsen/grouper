import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { Person } from '../../../../../models/person.model';
import { getAxeViolations } from '../../../../../../testing/axe';
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
      'sessionDetail.preferencePerson': 'Person',
      'sessionDetail.preferenceWantWith': 'Want with',
      'sessionDetail.preferenceAvoid': 'Avoid',
      'sessionDetail.customWeights.empty': 'No weights',
      'sessionDetail.customWeights.weightLabel': 'Weight',
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
    fixture.componentRef.setInput('customWeights', [{ id: 'w1', name: 'Karakter', mode: 'balance' }]);
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

    const nameInput = fixture.nativeElement.querySelector('#person-name');
    nameInput.value = 'Alicia';
    nameInput.dispatchEvent(new Event('input'));

    const closeButton = fixture.nativeElement.querySelector('.drawer-header button');
    closeButton.click();

    expect(fixture.nativeElement.querySelector('#person-preference-p2-wantWith').checked).toBe(true);
    fixture.nativeElement.querySelector('#person-gender-male').click();
    fixture.nativeElement.querySelector('#person-preference-p2-avoid').click();

    const weightInput = fixture.nativeElement.querySelector('.weight-input');
    weightInput.value = '9';
    weightInput.dispatchEvent(new Event('change'));

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(nameSpy).toHaveBeenCalledWith('Alicia');
    expect(genderSpy).toHaveBeenCalledWith('male');
    expect(preferenceSpy).toHaveBeenCalledWith({ targetPersonId: 'p2', value: 'avoid' });
    expect(weightSpy).toHaveBeenCalledWith({ weightId: 'w1', value: 9 });
  });

  it('uses radio groups for gender and a labelled preference table, and has no axe violations', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonDrawer],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PersonDrawer);
    fixture.componentRef.setInput('selectedPerson', selectedPerson);
    fixture.componentRef.setInput('people', [selectedPerson, otherPerson]);
    fixture.componentRef.setInput('customWeights', [{ id: 'w1', name: 'Karakter', mode: 'balance' }]);
    fixture.componentRef.setInput('preferences', {});
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const weightInput = root.querySelector<HTMLInputElement>('.weight-input');

    expect(root.querySelector('select')).toBeNull();
    expect(Array.from(root.querySelectorAll('.preference-table thead th')).map((th) => th.textContent?.trim())).toEqual([
      'Person',
      'None',
      'Want with',
      'Avoid',
    ]);
    expect(root.querySelector('.preference-table tbody th[scope="row"]')?.textContent?.trim()).toBe('Bob');
    expect(Array.from(root.querySelectorAll('.preference-table tbody label')).map((label) => label.textContent?.trim())).toEqual([
      'Bob: None',
      'Bob: Want with',
      'Bob: Avoid',
    ]);
    expect(root.querySelector<HTMLInputElement>('#person-preference-p2-none')?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('#person-gender-female')?.checked).toBe(true);
    expect(weightInput?.id).toBe('person-weight-w1');
    expect(root.querySelector(`label[for="person-weight-w1"]`)?.textContent?.trim()).toBe('Karakter');
    expect(await getAxeViolations(root)).toEqual([]);
  });

  it('falls back to readable labels for unnamed people and weights', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonDrawer],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PersonDrawer);
    fixture.componentRef.setInput('selectedPerson', selectedPerson);
    fixture.componentRef.setInput('people', [selectedPerson, { ...otherPerson, name: '' }]);
    fixture.componentRef.setInput('customWeights', [{ id: 'w1', name: '', mode: 'balance' }]);
    fixture.componentRef.setInput('preferences', {});
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.preference-table tbody th')?.textContent?.trim()).toBe('Unnamed person');
    expect(root.querySelector('label[for="person-preference-p2-avoid"]')?.textContent?.trim()).toBe('Unnamed person: Avoid');
    expect(root.querySelector('label[for="person-weight-w1"]')?.textContent?.trim()).toBe('Weight');
    expect(await getAxeViolations(root)).toEqual([]);
  });

  it.each([
    ['heading', 'person-drawer-heading'],
    ['name', 'person-name'],
  ] as const)('moves focus to the %s when the panel opens', async (initialFocus, expectedId) => {
    await TestBed.configureTestingModule({
      imports: [PersonDrawer],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PersonDrawer);
    fixture.componentRef.setInput('selectedPerson', selectedPerson);
    fixture.componentRef.setInput('people', [selectedPerson, otherPerson]);
    fixture.componentRef.setInput('customWeights', []);
    fixture.componentRef.setInput('preferences', {});
    fixture.componentRef.setInput('initialFocus', initialFocus);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe(expectedId);
    expect(root.querySelector('aside')?.getAttribute('aria-labelledby')).toBe('person-drawer-heading');
    root.remove();
  });
});
