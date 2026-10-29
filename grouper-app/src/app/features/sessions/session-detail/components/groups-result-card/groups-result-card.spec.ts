import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { GroupingStrategy } from '../../../../../models/group.model';
import { Person } from '../../../../../models/person.model';
import { getAxeViolations } from '../../../../../../testing/axe';
import { GroupsResultCard } from './groups-result-card';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'sessionDetail.groupLabel') {
      return `Group ${params?.['index']}`;
    }
    if (key === 'sessionDetail.score') {
      return `Score ${params?.['score']}`;
    }
    if (key === 'sessionDetail.satisfaction') {
      return `Satisfaction ${params?.['score']}`;
    }

    const labels: Record<string, string> = {
      'sessionDetail.generatedGroups': 'Generated Groups',
      'sessionDetail.regenerateGroups': 'Generate new groups',
      'sessionDetail.unnamedPerson': 'Unnamed person',
      'sessionDetail.gender.female': 'Female',
      'sessionDetail.gender.male': 'Male',
      'sessionDetail.gender.unspecified': 'Unspecified',
    };
    return labels[key] ?? key;
  }
}

describe('GroupsResultCard', () => {
  it('renders group members and emits regenerate', async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsResultCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(GroupsResultCard);
    fixture.componentRef.setInput('people', [
      { id: 'p1', name: 'Alice', gender: 'female', createdAt: new Date() } as Person,
      { id: 'p2', name: 'Bob', gender: 'male', createdAt: new Date() } as Person,
    ]);
    fixture.componentRef.setInput('result', {
      groups: [{ id: 'g1', name: 'Group 1', memberIds: ['p1', 'p2'], satisfactionScore: 8 }],
      strategy: GroupingStrategy.RANDOM,
      settings: { strategy: GroupingStrategy.RANDOM, groupSize: 2, allowPartialGroups: true },
      timestamp: new Date(),
      overallSatisfaction: 8,
    });

    const regenSpy = vi.fn();
    fixture.componentInstance.regenerate.subscribe(regenSpy);

    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();

    const content = fixture.nativeElement.textContent;

    expect(content).toContain('Generated Groups');
    expect(content).toContain('Alice');
    expect(content).toContain('Bob');
    expect(regenSpy).toHaveBeenCalledTimes(1);
  });

  it('shows each member\'s gender as a badge, falling back to unspecified', async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsResultCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(GroupsResultCard);
    fixture.componentRef.setInput('people', [
      { id: 'p1', name: 'Alice', gender: 'female', createdAt: new Date() } as Person,
      { id: 'p2', name: 'Sam', createdAt: new Date() } as Person,
    ]);
    fixture.componentRef.setInput('result', {
      groups: [{ id: 'g1', name: 'Group 1', memberIds: ['p1', 'p2'] }],
      strategy: GroupingStrategy.RANDOM,
      settings: { strategy: GroupingStrategy.RANDOM, groupSize: 2, allowPartialGroups: true },
      timestamp: new Date(),
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    const members = Array.from(root.querySelectorAll<HTMLElement>('.group-members li'));
    expect(members.map((member) => member.querySelector('.badge')?.textContent?.trim())).toEqual(['Female', 'Unspecified']);
    expect(members.map((member) => member.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Alice, Female',
      'Sam, Unspecified',
    ]);
    expect(await getAxeViolations(root)).toEqual([]);
  });

  it('uses DKFDS cards and badges, a distinct regenerate label, and falls back for unnamed members', async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsResultCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(GroupsResultCard);
    fixture.componentRef.setInput('people', [
      { id: 'p1', name: 'Alice', gender: 'female', createdAt: new Date() } as Person,
      { id: 'p2', name: '', gender: 'male', createdAt: new Date() } as Person,
    ]);
    fixture.componentRef.setInput('result', {
      groups: [
        { id: 'g1', name: 'Group 1', memberIds: ['p1'], satisfactionScore: 8 },
        { id: 'g2', name: 'Group 2', memberIds: ['p2'] },
      ],
      strategy: GroupingStrategy.PREFERENCE_BASED,
      settings: { strategy: GroupingStrategy.PREFERENCE_BASED, groupSize: 1, allowPartialGroups: true },
      timestamp: new Date(),
      overallSatisfaction: 8,
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.regenerate-button')?.textContent?.trim()).toBe('Generate new groups');
    expect(root.querySelector('.groups-header .badge.badge-info')?.textContent?.trim()).toBe('Satisfaction 8');
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('Generated Groups');

    const groups = Array.from(root.querySelectorAll<HTMLElement>('.card-row > li .group-card'));
    expect(groups.map((group) => group.querySelector('h3')?.textContent?.trim())).toEqual(['Group 1', 'Group 2']);
    expect(groups[0].getAttribute('aria-labelledby')).toBe(groups[0].querySelector('h3')?.id);
    expect(groups[0].querySelector('.card-content > .badge')?.textContent?.trim()).toBe('Score 8');
    expect(groups[1].querySelector('.card-content > .badge')).toBeNull();
    expect(groups[1].querySelector('.group-members li')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Unnamed person, Male');
    expect(await getAxeViolations(root)).toEqual([]);
  });
});
