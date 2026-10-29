import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { Person } from '../../../../../models/person.model';
import { getAxeViolations } from '../../../../../../testing/axe';
import { SessionPeopleCard } from './session-people-card';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'sessionDetail.peopleTitle') {
      return `People (${params?.['count']})`;
    }

    const labels: Record<string, string> = {
      'sessionDetail.noPeople': 'No people',
      'sessionDetail.addPerson': 'Add Person',
      'sessionDetail.unnamedPerson': 'Unnamed person',
      'common.delete': 'Delete',
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
    const removeButtons = fixture.nativeElement.querySelectorAll('.person-item .person-delete');

    nameButtons[0].click();
    removeButtons[0].click();
    fixture.nativeElement.querySelector('.add-button').click();

    expect(fixture.nativeElement.textContent).toContain('People (3)');
    expect(openSpy).toHaveBeenCalledWith(people[0]);
    expect(removeSpy).toHaveBeenCalledWith(people[0]);
    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('uses DKFDS function links with a per-person accessible name and a secondary add button', async () => {
    await TestBed.configureTestingModule({
      imports: [SessionPeopleCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionPeopleCard);
    fixture.componentRef.setInput('people', [...people, { id: 'p4', name: '', gender: 'unspecified', createdAt: new Date() }]);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const deletes = Array.from(root.querySelectorAll<HTMLButtonElement>('.person-delete'));
    expect(deletes.map((button) => button.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Delete Alice',
      'Delete Bob',
      'Delete Taylor',
      'Delete Unnamed person',
    ]);
    expect(deletes.every((button) => button.classList.contains('function-link'))).toBe(true);
    expect(root.querySelector('.button-warning')).toBeNull();
    expect(root.querySelector('#add-person-button')?.className).toContain('button-secondary');
    expect(root.querySelector('.button-primary')).toBeNull();
    expect(await getAxeViolations(root)).toEqual([]);
  });

  it('shows the empty message as plain text without a list', async () => {
    await TestBed.configureTestingModule({
      imports: [SessionPeopleCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionPeopleCard);
    fixture.componentRef.setInput('people', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ul')).toBeNull();
    expect(fixture.nativeElement.querySelector('p')?.textContent?.trim()).toBe('No people');
  });
});
