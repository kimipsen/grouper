import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { GroupingStrategy } from '../../../../../models/group.model';
import { Person } from '../../../../../models/person.model';
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
      'sessionDetail.regenerateGroupsAria': 'Regenerate',
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
    const memberIcons = [...fixture.nativeElement.querySelectorAll('.member mat-icon')]
      .map((icon: HTMLElement) => icon.textContent?.trim());

    expect(content).toContain('Generated Groups');
    expect(content).toContain('Alice');
    expect(content).toContain('Bob');
    expect(memberIcons).toEqual(['female', 'male']);
    expect(regenSpy).toHaveBeenCalledTimes(1);
  });
});
