import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { Person } from '../../../../../models/person.model';
import { SessionPeopleCard } from './session-people-card';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'sessionDetail.peopleTitle') {
      return `People (${params?.['count']})`;
    }

    const labels: Record<string, string> = {
      'sessionDetail.noPeople': 'No people',
      'sessionDetail.addPerson': 'Add Person',
    };
    return labels[key] ?? key;
  }
}

const people: Person[] = [
  { id: 'p1', name: 'Alice', gender: 'female', createdAt: new Date() },
  { id: 'p2', name: 'Bob', gender: 'male', createdAt: new Date() },
  { id: 'p3', name: 'Taylor', gender: 'nonbinary', createdAt: new Date() },
];

describe('SessionPeopleCard', () => {
  it('renders people and emits actions', async () => {
    await TestBed.configureTestingModule({
      imports: [SessionPeopleCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionPeopleCard);
    fixture.componentRef.setInput('people', people);

    const addSpy = vi.fn();
    const openSpy = vi.fn();
    const removeSpy = vi.fn();
    fixture.componentInstance.addPerson.subscribe(addSpy);
    fixture.componentInstance.openPerson.subscribe(openSpy);
    fixture.componentInstance.removePerson.subscribe(removeSpy);

    fixture.detectChanges();

    const nameButtons = fixture.nativeElement.querySelectorAll('.person-name');
    const removeButtons = fixture.nativeElement.querySelectorAll('button[color="warn"]');

    nameButtons[0].click();
    removeButtons[0].click();
    fixture.nativeElement.querySelector('.add-button').click();

    const icons = [...fixture.nativeElement.querySelectorAll('.person-item > mat-icon')]
      .map((icon: HTMLElement) => icon.textContent?.trim());

    expect(fixture.nativeElement.textContent).toContain('People (3)');
    expect(icons).toEqual(['female', 'male', 'transgender']);
    expect(openSpy).toHaveBeenCalledWith(people[0]);
    expect(removeSpy).toHaveBeenCalledWith(people[0]);
    expect(addSpy).toHaveBeenCalledTimes(1);
  });
});
