import { DOCUMENT } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { GroupingResult, GroupingStrategy } from '../../../../../models/group.model';
import { Person } from '../../../../../models/person.model';
import { getAxeViolations } from '../../../../../../testing/axe';
import { GroupsResultCard } from './groups-result-card';

class MockI18nService {
  getCurrentDateLocale(): string {
    return 'en-US';
  }

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

    if (key === 'sessionDetail.result.generatedAt') {
      return `Generated ${params?.['date']}`;
    }
    if (key === 'sessionDetail.result.settings.groupSize') {
      return `Group size: ${params?.['size']}`;
    }
    if (key === 'sessionDetail.result.settings.genderMode') {
      return `Gender mode: ${params?.['mode']}`;
    }
    if (key === 'sessionDetail.result.settings.weights') {
      return `Weights used: ${params?.['count']}`;
    }

    const labels: Record<string, string> = {
      'sessionDetail.strategy': 'Strategy',
      'sessionDetail.strategyRandom': 'Random',
      'sessionDetail.strategyWeighted': 'Weighted',
      'sessionDetail.removedPerson': 'Removed person',
      'sessionDetail.genderMode.mixed': 'Mixed-gender',
      'sessionDetail.result.settings.partialGroupsOn': 'Partial groups allowed',
      'sessionDetail.result.settings.partialGroupsOff': 'Partial groups not allowed',
      'sessionDetail.generatedGroups': 'Generated Groups',
      'sessionDetail.regenerateGroups': 'Generate new groups',
      'sessionDetail.print': 'Print',
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

  async function createCard(
    result: GroupingResult,
    people: Person[],
    historical?: boolean,
  ): Promise<ComponentFixture<GroupsResultCard>> {
    await TestBed.configureTestingModule({
      imports: [GroupsResultCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(GroupsResultCard);
    fixture.componentRef.setInput('people', people);
    fixture.componentRef.setInput('result', result);
    if (historical !== undefined) {
      fixture.componentRef.setInput('historical', historical);
    }
    fixture.detectChanges();
    return fixture;
  }

  const alice = { id: 'p1', name: 'Alice', gender: 'female', createdAt: new Date() } as Person;
  const weightedResult: GroupingResult = {
    groups: [{ id: 'g1', name: 'Group 1', memberIds: ['p1', 'gone'] }],
    strategy: GroupingStrategy.WEIGHTED,
    settings: {
      strategy: GroupingStrategy.WEIGHTED,
      groupSize: 3,
      allowPartialGroups: false,
      genderMode: 'mixed',
      weightIds: ['w1', 'w2'],
    },
    timestamp: new Date(2026, 0, 15, 9, 30),
  };

  it('hides the regenerate button when historical and shows it otherwise', async () => {
    const historical = await createCard(weightedResult, [alice], true);
    expect(historical.nativeElement.querySelector('.regenerate-button')).toBeNull();

    TestBed.resetTestingModule();
    const latest = await createCard(weightedResult, [alice], false);
    expect(latest.nativeElement.querySelector('.regenerate-button')).not.toBeNull();
  });

  it('shows timestamp, strategy and settings in the summary', async () => {
    const fixture = await createCard(weightedResult, [alice]);
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.result-summary-line')?.textContent?.trim()).toBe('Generated Jan 15, 2026, 9:30 AM');
    const settings = Array.from(root.querySelectorAll('.result-settings li')).map(li => li.textContent?.trim());
    expect(settings).toEqual([
      'Strategy: Weighted',
      'Group size: 3',
      'Partial groups not allowed',
      'Gender mode: Mixed-gender',
      'Weights used: 2',
    ]);
  });

  it('omits optional settings that were not recorded', async () => {
    const fixture = await createCard(
      {
        groups: [],
        strategy: GroupingStrategy.RANDOM,
        settings: { strategy: GroupingStrategy.RANDOM, groupSize: 2 },
        timestamp: new Date(2026, 0, 15, 9, 30),
      },
      [alice],
    );
    const settings = Array.from(fixture.nativeElement.querySelectorAll('.result-settings li')).map(
      (li) => (li as HTMLElement).textContent?.trim(),
    );
    expect(settings).toEqual(['Strategy: Random', 'Group size: 2']);
  });

  it('labels people no longer in the session as removed, without a gender badge', async () => {
    const fixture = await createCard(weightedResult, [alice], true);
    const root: HTMLElement = fixture.nativeElement;

    const members = Array.from(root.querySelectorAll<HTMLElement>('.group-members li'));
    expect(members.map(member => member.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Alice, Female',
      'Removed person',
    ]);
    expect(members[1].querySelector('.badge')).toBeNull();
  });

  it('gives the heading a stable id and makes it programmatically focusable', async () => {
    const fixture = await createCard(weightedResult, [alice]);
    const heading = fixture.nativeElement.querySelector('h2') as HTMLElement;

    expect(heading.id).toBe('results-heading');
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(await getAxeViolations(fixture.nativeElement)).toEqual([]);
  });

  describe('print', () => {
    const bob = { id: 'p2', name: 'Bob', gender: 'male', createdAt: new Date() } as Person;
    const blank = { id: 'p3', name: '', gender: 'male', createdAt: new Date() } as Person;
    const printResult: GroupingResult = {
      groups: [
        { id: 'g1', name: 'Group 1', memberIds: ['p1', 'p2'], satisfactionScore: 7 },
        { id: 'g2', name: 'Group 2', memberIds: ['gone', 'p3'] },
      ],
      strategy: GroupingStrategy.WEIGHTED,
      settings: {
        strategy: GroupingStrategy.WEIGHTED,
        groupSize: 2,
        allowPartialGroups: true,
        genderMode: 'mixed',
        weightIds: ['w1'],
      },
      timestamp: new Date(2026, 0, 15, 9, 30),
      overallSatisfaction: 5,
    };

    function sheetOf(fixture: ComponentFixture<GroupsResultCard>): HTMLElement {
      return fixture.nativeElement.querySelector('.print-sheet') as HTMLElement;
    }

    function text(el: Element | null | undefined): string {
      return el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }

    it('shows Print after Regenerate for the current grouping and alone for historical ones', async () => {
      const current = await createCard(printResult, [alice, bob, blank], false);
      const currentRoot: HTMLElement = current.nativeElement;
      const buttons = Array.from(currentRoot.querySelectorAll<HTMLElement>('.header-actions > button'));
      expect(buttons.map(b => text(b))).toEqual(['Generate new groups', 'Print']);
      expect(buttons[0].classList).toContain('regenerate-button');
      expect(buttons[1].classList).toContain('print-button');

      TestBed.resetTestingModule();
      const historical = await createCard(printResult, [alice, bob, blank], true);
      expect(historical.nativeElement.querySelector('.regenerate-button')).toBeNull();
      expect(text(historical.nativeElement.querySelector('.print-button'))).toBe('Print');
    });

    it('calls window.print exactly once when Print is clicked', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      const view = TestBed.inject(DOCUMENT).defaultView as Window;
      const original = view.print;
      if (typeof original !== 'function') {
        (view as { print: () => void }).print = () => {};
      }
      const spy = vi.spyOn(view, 'print').mockImplementation(() => {});

      fixture.nativeElement.querySelector('.print-button').click();

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('does not throw when the document has no window', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      vi.spyOn(TestBed.inject(DOCUMENT), 'defaultView', 'get').mockReturnValue(null);

      expect(() => fixture.componentInstance.print()).not.toThrow();
    });

    it('renders only the print essentials in the print sheet', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      fixture.componentRef.setInput('sessionName', 'Class 7B');
      fixture.detectChanges();
      const sheet = sheetOf(fixture);
      const content = text(sheet);

      expect(text(sheet.querySelector('.print-title'))).toBe('Class 7B');
      expect(content).toContain('Generated Jan 15, 2026, 9:30 AM');
      expect(content).toContain('Strategy: Weighted');
      expect(content).toContain('Group size: 2');
      for (const hidden of ['Female', 'Male', 'Unspecified', 'Satisfaction', 'Partial groups', 'Gender mode', 'Weights used']) {
        expect(content).not.toContain(hidden);
      }
      expect(content).not.toMatch(/sessionDetail\./);
    });

    it('prints a checkbox and a name per member with labels for removed and unnamed people', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      const groups = Array.from(sheetOf(fixture).querySelectorAll<HTMLElement>('.print-group'));

      expect(groups.map(g => text(g.querySelector('h3')))).toEqual(['Group 1', 'Group 2']);
      expect(Array.from(groups[0].querySelectorAll('.print-members li')).map(li => text(li))).toEqual(['☐Alice', '☐Bob']);
      expect(Array.from(groups[1].querySelectorAll('.print-members li')).map(li => text(li))).toEqual([
        '☐Removed person',
        '☐Unnamed person',
      ]);
    });

    it('renders one line per member when every member is removed or unnamed', async () => {
      const fixture = await createCard(
        { ...printResult, groups: [{ id: 'g1', name: 'Group 1', memberIds: ['gone1', 'gone2', 'p3'] }] },
        [blank],
      );
      expect(sheetOf(fixture).querySelectorAll('.print-members li').length).toBe(3);
    });

    it('shows the score line only when the group has a score', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      const groups = Array.from(sheetOf(fixture).querySelectorAll<HTMLElement>('.print-group'));

      expect(text(groups[0].querySelector('.print-score'))).toBe('Score 7');
      expect(groups[1].querySelector('.print-score')).toBeNull();
    });

    it('renders exactly one notes area per group', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      const groups = Array.from(sheetOf(fixture).querySelectorAll<HTMLElement>('.print-group'));

      expect(groups.map(g => g.querySelectorAll('.print-notes').length)).toEqual([1, 1]);
    });

    it('omits the title for empty or whitespace-only session names', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      expect(sheetOf(fixture).querySelector('.print-title')).toBeNull();

      fixture.componentRef.setInput('sessionName', '   ');
      fixture.detectChanges();
      expect(sheetOf(fixture).querySelector('.print-title')).toBeNull();

      fixture.componentRef.setInput('sessionName', ' Team ');
      fixture.detectChanges();
      expect(text(sheetOf(fixture).querySelector('.print-title'))).toBe('Team');
    });

    it('follows result changes under OnPush', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank], true);
      expect(sheetOf(fixture).querySelectorAll('.print-group').length).toBe(2);

      fixture.componentRef.setInput('result', {
        ...printResult,
        groups: [{ id: 'g9', name: 'Group 9', memberIds: ['p1'] }],
      });
      fixture.detectChanges();

      expect(sheetOf(fixture).querySelectorAll('.print-group').length).toBe(1);
      expect(text(sheetOf(fixture).querySelector('.print-members li'))).toBe('☐Alice');
    });

    it('keeps the print sheet accessible: decorative glyphs hidden, no controls, no duplicate ids', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      const root: HTMLElement = fixture.nativeElement;
      const sheet = sheetOf(fixture);

      const glyphs = Array.from(sheet.querySelectorAll('.print-checkbox'));
      expect(glyphs.length).toBe(4);
      expect(glyphs.every(g => g.getAttribute('aria-hidden') === 'true')).toBe(true);
      expect(Array.from(sheet.querySelectorAll('.print-notes')).every(n => n.getAttribute('aria-hidden') === 'true')).toBe(true);
      expect(sheet.querySelector('button, a, input, select, textarea, [tabindex]')).toBeNull();
      expect(sheet.querySelectorAll('h3[id]').length).toBe(0);

      const ids = Array.from(root.querySelectorAll('[id]')).map(el => el.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(await getAxeViolations(root)).toEqual([]);
    });

    it('marks the screen content and hides the print sheet on screen', async () => {
      const fixture = await createCard(printResult, [alice, bob, blank]);
      const root: HTMLElement = fixture.nativeElement;

      expect(root.querySelector('.card-content.screen-only')).not.toBeNull();
      expect(sheetOf(fixture).previousElementSibling?.classList).toContain('screen-only');
      expect(getComputedStyle(sheetOf(fixture)).display).toBe('none');
    });
  });
});
