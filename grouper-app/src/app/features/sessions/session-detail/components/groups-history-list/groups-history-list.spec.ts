import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { GroupingResult, GroupingStrategy } from '../../../../../models/group.model';
import { getAxeViolations } from '../../../../../../testing/axe';
import { GroupsHistoryEntry, GroupsHistoryList } from './groups-history-list';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'sessionDetail.history.entryLabel') {
      return `${params?.['strategy']}, ${params?.['date']}, ${params?.['satisfaction']}`;
    }
    if (key === 'sessionDetail.history.count') {
      return `${params?.['count']} groupings`;
    }
    if (key === 'sessionDetail.satisfaction') {
      return `Satisfaction ${params?.['score']}`;
    }
    const labels: Record<string, string> = {
      'sessionDetail.history.title': 'Previous groupings',
      'sessionDetail.strategyRandom': 'Random',
      'sessionDetail.strategyPreferenceBased': 'Preference-based',
      'sessionDetail.strategyWeighted': 'Weighted',
    };
    return labels[key] ?? key;
  }
}

function makeEntry(
  index: number,
  strategy: GroupingStrategy,
  overallSatisfaction?: number,
  timestamp = new Date(Date.UTC(2026, 0, 1 + index, 12, 0)),
): GroupsHistoryEntry {
  const result: GroupingResult = {
    groups: [],
    strategy,
    settings: { strategy, groupSize: 2, allowPartialGroups: true },
    timestamp,
    overallSatisfaction,
  };
  return { index, result };
}

describe('GroupsHistoryList', () => {
  let fixture: ComponentFixture<GroupsHistoryList>;

  async function setup(entries: GroupsHistoryEntry[], selectedIndex: number | null = null) {
    await TestBed.configureTestingModule({
      imports: [GroupsHistoryList],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();
    fixture = TestBed.createComponent(GroupsHistoryList);
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('selectedIndex', selectedIndex);
    fixture.componentRef.setInput('locale', 'en-US');
    fixture.detectChanges();
  }

  const buttons = () => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'));

  it('renders entries in the order given with strategy labels', async () => {
    await setup([
      makeEntry(2, GroupingStrategy.WEIGHTED, 5),
      makeEntry(1, GroupingStrategy.PREFERENCE_BASED, 4),
      makeEntry(0, GroupingStrategy.RANDOM),
    ]);

    const text = buttons().map(button => button.textContent ?? '');
    expect(text).toHaveLength(3);
    expect(text[0]).toContain('Weighted');
    expect(text[1]).toContain('Preference-based');
    expect(text[2]).toContain('Random');
    expect(fixture.nativeElement.querySelector('h3').textContent).toContain('Previous groupings');
    expect(fixture.nativeElement.querySelector('h3').textContent).toContain('3 groupings');
  });

  it('renders a hidden badge only when satisfaction is defined (0 included)', async () => {
    await setup([
      makeEntry(2, GroupingStrategy.RANDOM, 0),
      makeEntry(1, GroupingStrategy.RANDOM, undefined),
    ]);

    const [first, second] = buttons();
    const badge = first.querySelector('.badge.badge-info');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('aria-hidden')).toBe('true');
    expect(second.querySelector('.badge')).toBeNull();
    expect(first.getAttribute('aria-label')).toContain('Satisfaction 0');
    expect(second.getAttribute('aria-label')?.endsWith(',')).toBe(false);
  });

  it('emits the stored index, also for identical timestamps', async () => {
    const same = new Date(Date.UTC(2026, 0, 1));
    await setup([
      makeEntry(1, GroupingStrategy.RANDOM, 1, same),
      makeEntry(0, GroupingStrategy.RANDOM, 2, same),
    ]);
    const spy = vi.fn();
    fixture.componentInstance.selectEntry.subscribe(spy);

    buttons()[1].click();
    buttons()[0].click();

    expect(spy).toHaveBeenNthCalledWith(1, 0);
    expect(spy).toHaveBeenNthCalledWith(2, 1);
  });

  it('marks the newest entry current when selectedIndex is null', async () => {
    await setup([makeEntry(1, GroupingStrategy.RANDOM), makeEntry(0, GroupingStrategy.RANDOM)]);

    const current = fixture.nativeElement.querySelectorAll('[aria-current]');
    expect(current).toHaveLength(1);
    expect(buttons()[0].getAttribute('aria-current')).toBe('true');
  });

  it('marks exactly the selected entry current', async () => {
    await setup([makeEntry(1, GroupingStrategy.RANDOM), makeEntry(0, GroupingStrategy.RANDOM)], 0);

    const current = fixture.nativeElement.querySelectorAll('[aria-current]');
    expect(current).toHaveLength(1);
    expect(buttons()[1].getAttribute('aria-current')).toBe('true');
  });

  it('renders nothing for fewer than two entries', async () => {
    await setup([makeEntry(0, GroupingStrategy.RANDOM)]);
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
    expect(buttons()).toHaveLength(0);

    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('has no axe violations', async () => {
    await setup(
      [makeEntry(2, GroupingStrategy.WEIGHTED, 5), makeEntry(1, GroupingStrategy.RANDOM, 0), makeEntry(0, GroupingStrategy.RANDOM)],
      1,
    );
    expect(await getAxeViolations(fixture.nativeElement)).toEqual([]);
  });
});
