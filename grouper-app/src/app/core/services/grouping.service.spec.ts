import { Group, GroupingSettings, GroupingStrategy } from '../../models/group.model';
import { Session } from '../../models/session.model';
import { GroupingService } from './grouping.service';

describe('GroupingService member ordering', () => {
  let service: GroupingService;

  beforeEach(() => {
    service = new GroupingService();
  });

  it('sorts memberIds by name for random strategy', () => {
    const session = buildSession([
      { id: 'p1', name: 'Charlie' },
      { id: 'p2', name: 'alice' },
      { id: 'p3', name: 'Bob' },
    ]);

    const result = service.createGroupsWithSession(
      session,
      {
        strategy: GroupingStrategy.RANDOM,
        groupSize: 10,
        allowPartialGroups: true,
        genderMode: 'ignore',
      },
      'en-US'
    );

    expect(result.groups[0].memberIds).toEqual(['p2', 'p3', 'p1']);
  });

  it('uses locale-aware ordering for Danish names', () => {
    const session = buildSession([
      { id: 'p1', name: 'Zulu' },
      { id: 'p2', name: 'Åse' },
      { id: 'p3', name: 'Anders' },
    ]);

    const result = service.createGroupsWithSession(
      session,
      {
        strategy: GroupingStrategy.RANDOM,
        groupSize: 10,
        allowPartialGroups: true,
        genderMode: 'ignore',
      },
      'da-DK'
    );

    expect(result.groups[0].memberIds).toEqual(['p3', 'p1', 'p2']);
  });

  it('sorts memberIds for weighted and preference strategies', () => {
    const session = buildSession([
      { id: 'p1', name: 'Mona' },
      { id: 'p2', name: 'adam' },
      { id: 'p3', name: 'Lars' },
    ]);

    const weightedResult = service.createGroupsWithSession(
      session,
      {
        strategy: GroupingStrategy.WEIGHTED,
        groupSize: 10,
        allowPartialGroups: true,
        genderMode: 'ignore',
        weightIds: ['__gender__'],
      },
      'en-US'
    );
    expect(weightedResult.groups[0].memberIds).toEqual(['p2', 'p3', 'p1']);

    const preferenceResult = service.createGroupsWithSession(
      session,
      {
        strategy: GroupingStrategy.PREFERENCE_BASED,
        groupSize: 10,
        allowPartialGroups: true,
        genderMode: 'ignore',
      },
      'en-US'
    );
    expect(preferenceResult.groups[0].memberIds).toEqual(['p2', 'p3', 'p1']);
  });
});

describe('GroupingService mixed gender distribution', () => {
  let service: GroupingService;

  beforeEach(() => {
    service = new GroupingService();
  });

  it('avoids single-gender groups for random mixed mode when distribution allows mixing', () => {
    const people = [
      ...Array.from({ length: 15 }, (_, i) => ({ id: `m-${i + 1}`, name: `Male ${i + 1}`, gender: 'male' as const })),
      ...Array.from({ length: 15 }, (_, i) => ({ id: `f-${i + 1}`, name: `Female ${i + 1}`, gender: 'female' as const })),
    ];
    const session = buildSession(people);

    const result = service.createGroupsWithSession(
      session,
      {
        strategy: GroupingStrategy.RANDOM,
        groupSize: 3,
        allowPartialGroups: true,
        genderMode: 'mixed',
      },
      'en-US'
    );

    const personById = new Map(session.people.map((person) => [person.id, person]));
    const singleGenderGroups = result.groups.filter((group) => {
      const genders = new Set(
        group.memberIds.map((memberId) => personById.get(memberId)?.gender ?? 'unspecified')
      );
      return genders.size <= 1;
    });

    expect(result.groups.length).toBe(10);
    expect(singleGenderGroups.length).toBe(0);
  });
});

describe('GroupingService preference scores', () => {
  let service: GroupingService;

  beforeEach(() => {
    service = new GroupingService();
  });

  it('sets per-group satisfactionScore for single-gender preference strategy', () => {
    const session = buildSession([
      { id: 'm-1', name: 'M1', gender: 'male' },
      { id: 'm-2', name: 'M2', gender: 'male' },
      { id: 'f-1', name: 'F1', gender: 'female' },
      { id: 'f-2', name: 'F2', gender: 'female' },
    ]);
    session.preferences = {
      'm-1': { wantWith: ['m-2'], avoid: [] },
      'm-2': { wantWith: ['m-1'], avoid: [] },
      'f-1': { wantWith: ['f-2'], avoid: [] },
      'f-2': { wantWith: ['f-1'], avoid: [] },
    };

    const result = service.createGroupsWithSession(
      session,
      {
        strategy: GroupingStrategy.PREFERENCE_BASED,
        groupSize: 2,
        allowPartialGroups: true,
        genderMode: 'single',
      },
      'en-US'
    );

    expect(result.groups.length).toBe(2);
    for (const group of result.groups) {
      expect(typeof group.satisfactionScore).toBe('number');
    }
  });
});

describe('GroupingService weighted modes', () => {
  let service: GroupingService;

  beforeEach(() => {
    service = new GroupingService();
  });

  it('matches similar custom weights in the same group when custom weight mode is match-similar', () => {
    const session = buildSession([
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
      { id: 'p3', name: 'P3' },
      { id: 'p4', name: 'P4' },
    ]);
    session.customWeights = [{ id: 'skill', name: 'Skill', mode: 'match-similar' }];
    session.people = session.people.map((person) => {
      const scoreById: Record<string, number> = {
        p1: 1,
        p2: 2,
        p3: 9,
        p4: 10,
      };
      return {
        ...person,
        weights: { skill: scoreById[person.id] },
      };
    });

    const result = service.createGroupsWithSession(
      session,
      {
        strategy: GroupingStrategy.WEIGHTED,
        groupSize: 2,
        allowPartialGroups: true,
        genderMode: 'ignore',
        weightIds: ['skill'],
      },
      'en-US'
    );

    const groups = result.groups.map((group) => new Set(group.memberIds));
    expect(groups).toEqual(
      expect.arrayContaining([
        new Set(['p1', 'p2']),
        new Set(['p3', 'p4']),
      ])
    );
  });

  it('balances custom weight totals across groups when custom weight mode is balance', () => {
    const session = buildSession([
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
      { id: 'p3', name: 'P3' },
      { id: 'p4', name: 'P4' },
    ]);
    session.customWeights = [{ id: 'skill', name: 'Skill', mode: 'balance' }];
    session.people = session.people.map((person) => {
      const scoreById: Record<string, number> = {
        p1: 1,
        p2: 2,
        p3: 9,
        p4: 10,
      };
      return {
        ...person,
        weights: { skill: scoreById[person.id] },
      };
    });

    const result = service.createGroupsWithSession(
      session,
      {
        strategy: GroupingStrategy.WEIGHTED,
        groupSize: 2,
        allowPartialGroups: true,
        genderMode: 'ignore',
        weightIds: ['skill'],
      },
      'en-US'
    );

    const sortedGroups = result.groups.map((group) => [...group.memberIds].sort((a, b) => a.localeCompare(b)));
    expect(sortedGroups).not.toContainEqual(['p1', 'p2']);
    expect(sortedGroups).not.toContainEqual(['p3', 'p4']);

    const sums = result.groups.map((group) =>
      group.memberIds.reduce((sum, memberId) => sum + (session.people.find((person) => person.id === memberId)?.weights?.['skill'] ?? 0), 0)
    );
    expect(sums[0]).toBe(sums[1]);
  });
});

type TestGender = 'female' | 'male' | 'nonbinary' | 'unspecified';

function buildPeople(counts: Partial<Record<TestGender, number>>): { id: string; name: string; gender: TestGender }[] {
  const people: { id: string; name: string; gender: TestGender }[] = [];
  for (const [gender, count] of Object.entries(counts) as [TestGender, number][]) {
    for (let i = 1; i <= count; i++) {
      people.push({ id: `${gender}-${i}`, name: `${gender} ${i}`, gender });
    }
  }
  return people;
}

function singleSettings(groupSize: number, allowPartialGroups: boolean | undefined, strategy = GroupingStrategy.RANDOM): GroupingSettings {
  return { strategy, groupSize, allowPartialGroups, genderMode: 'single' };
}

function sizesByGender(groups: Group[], session: Session): Record<string, number[]> {
  const genderById = new Map(session.people.map((person) => [person.id, person.gender ?? 'unspecified']));
  const result: Record<string, number[]> = {};
  for (const group of groups) {
    const genders = new Set(group.memberIds.map((id) => genderById.get(id)));
    expect(genders.size).toBe(1);
    const gender = [...genders][0] as string;
    result[gender] = [...(result[gender] ?? []), group.memberIds.length];
  }
  for (const sizes of Object.values(result)) {
    sizes.sort((a, b) => b - a);
  }
  return result;
}

function expectEveryonePlacedOnce(groups: Group[], session: Session): void {
  const placed = groups.flatMap((group) => group.memberIds).sort();
  expect(placed).toEqual(session.people.map((person) => person.id).sort());
}

describe('GroupingService single gender distribution', () => {
  let service: GroupingService;
  const class7A = { female: 13, male: 12, nonbinary: 1 };

  beforeEach(() => {
    service = new GroupingService();
  });

  function generate(counts: Partial<Record<TestGender, number>>, settings: GroupingSettings) {
    const session = buildSession(buildPeople(counts));
    const result = service.createGroupsWithSession(session, settings, 'en-US');
    return { session, groups: result.groups };
  }

  it('balances class 7A at size 5 with partial groups (repeated to catch order-dependent bugs)', () => {
    for (let run = 0; run < 50; run++) {
      const { session, groups } = generate(class7A, singleSettings(5, true));
      expect(sizesByGender(groups, session)).toEqual({ female: [5, 4, 4], male: [4, 4, 4], nonbinary: [1] });
      expect(groups.length).toBe(7);
      expectEveryonePlacedOnce(groups, session);
      expect(groups.map((group) => group.name)).toEqual(Array.from({ length: 7 }, (_, i) => `Group ${i + 1}`));
    }
  });

  it('balances class 7A at size 4 with partial groups', () => {
    const { session, groups } = generate(class7A, singleSettings(4, true));
    expect(sizesByGender(groups, session)).toEqual({ female: [4, 3, 3, 3], male: [4, 4, 4], nonbinary: [1] });
    expectEveryonePlacedOnce(groups, session);
  });

  it('treats undefined allowPartialGroups as partial allowed', () => {
    const { session, groups } = generate(class7A, singleSettings(5, undefined));
    expect(sizesByGender(groups, session)).toEqual({ female: [5, 4, 4], male: [4, 4, 4], nonbinary: [1] });
  });

  it('places a gender smaller than groupSize in one undersized group instead of dropping them when partial groups are disallowed', () => {
    const { session, groups } = generate(class7A, singleSettings(5, false));
    expect(sizesByGender(groups, session)).toEqual({ female: [7, 6], male: [6, 6], nonbinary: [1] });
    expectEveryonePlacedOnce(groups, session);
  });

  it('spreads remainders evenly at size 4 when partial groups are disallowed', () => {
    const { session, groups } = generate(class7A, singleSettings(4, false));
    expect(sizesByGender(groups, session)).toEqual({ female: [5, 4, 4], male: [4, 4, 4], nonbinary: [1] });
    expectEveryonePlacedOnce(groups, session);
  });

  it('keeps exact multiples unchanged in both modes', () => {
    for (const partial of [true, false]) {
      const { session, groups } = generate({ female: 10, male: 5 }, singleSettings(5, partial));
      expect(sizesByGender(groups, session)).toEqual({ female: [5, 5], male: [5] });
    }
  });

  const sizeOf = (count: number, groupSize: number, partial: boolean): number[] =>
    (service as unknown as {
      calculateSingleGenderGroupSizes(c: number, s: number, p: boolean): number[];
    }).calculateSingleGenderGroupSizes(count, groupSize, partial);

  it('computes balanced sizes at the helper boundaries', () => {
    const s = 5;
    const expectations: [number, boolean, number[]][] = [
      [5, true, [5]], [5, false, [5]],
      [6, true, [3, 3]], [6, false, [6]],
      [11, true, [4, 4, 3]], [11, false, [6, 5]],
      [13, true, [5, 4, 4]], [13, false, [7, 6]],
      [3, true, [3]], [3, false, [3]],
      [1, true, [1]], [1, false, [1]],
      [0, true, []], [0, false, []],
    ];
    for (const [count, partial, expected] of expectations) {
      const sizes = sizeOf(count, s, partial);
      expect(sizes).toEqual(expected);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(count);
      if (sizes.length > 0) {
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      }
      if (partial) {
        expect(sizes.every((size) => size <= s)).toBe(true);
      }
    }
  });

  it('always keeps sizes within one of each other and places everyone', () => {
    for (let groupSize = 1; groupSize <= 8; groupSize++) {
      for (let count = 1; count <= 40; count++) {
        for (const partial of [true, false]) {
          const sizes = sizeOf(count, groupSize, partial);
          expect(sizes.reduce((a, b) => a + b, 0)).toBe(count);
          expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
          expect(sizes.every((size) => size >= 1)).toBe(true);
        }
      }
    }
  });

  it('throws when groupSize is below 1', () => {
    const session = buildSession(buildPeople({ female: 3 }));
    expect(() => service.createGroupsWithSession(session, singleSettings(0, true), 'en-US'))
      .toThrowError('Group size must be at least 1');
  });

  it('returns no groups for an empty people list', () => {
    const session = buildSession([]);
    const result = service.createGroupsWithSession(session, singleSettings(4, true), 'en-US');
    expect(result.groups).toEqual([]);
  });

  it('treats unspecified as an ordinary gender bucket, including people without a gender', () => {
    const session = buildSession(buildPeople({ female: 4 }));
    session.people.push(
      { id: 'u-1', name: 'U1', weights: {}, createdAt: new Date() },
      { id: 'u-2', name: 'U2', gender: 'unspecified', weights: {}, createdAt: new Date() },
      { id: 'u-3', name: 'U3', gender: 'unspecified', weights: {}, createdAt: new Date() },
    );
    const result = service.createGroupsWithSession(session, singleSettings(4, true), 'en-US');
    expect(sizesByGender(result.groups, session)).toEqual({ female: [4], unspecified: [3] });
    expect(service.countByGender(session.people)).toEqual({ female: 4, unspecified: 3 });
  });

  it('keeps groups gender-pure for PREFERENCE_BASED and RANDOM strategies', () => {
    for (const strategy of [GroupingStrategy.PREFERENCE_BASED, GroupingStrategy.RANDOM]) {
      const session = buildSession(buildPeople(class7A));
      session.preferences = { 'female-1': { wantWith: ['female-2'], avoid: [] } };
      const result = service.createGroupsWithSession(session, singleSettings(5, true, strategy), 'en-US');
      expect(sizesByGender(result.groups, session)).toEqual({ female: [5, 4, 4], male: [4, 4, 4], nonbinary: [1] });
      expectEveryonePlacedOnce(result.groups, session);
      if (strategy === GroupingStrategy.PREFERENCE_BASED) {
        for (const group of result.groups) {
          expect(typeof group.satisfactionScore).toBe('number');
        }
        expect(result.overallSatisfaction).toBe(
          service.calculateSatisfaction(result.groups, session.preferences, session.preferenceScoring)
        );
      }
    }
  });

  it('keeps groups gender-pure on the weighted path', () => {
    const session = buildSession(buildPeople(class7A));
    const result = service.createGroupsWithSession(
      session,
      { ...singleSettings(5, true, GroupingStrategy.WEIGHTED), weightIds: ['skill'] },
      'en-US'
    );
    expect(sizesByGender(result.groups, session)).toEqual({ female: [5, 4, 4], male: [4, 4, 4], nonbinary: [1] });
    expectEveryonePlacedOnce(result.groups, session);
  });

  it('numbers groups sequentially across genders so ids and names are unique (intended decision-3 change)', () => {
    const { groups } = generate(class7A, singleSettings(5, true));
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
    expect(new Set(groups.map((group) => group.name)).size).toBe(groups.length);
  });
});

describe('GroupingService single gender validation', () => {
  let service: GroupingService;
  const class7A = { female: 13, male: 12, nonbinary: 1 };

  beforeEach(() => {
    service = new GroupingService();
  });

  it('warns once about the too-small gender and gives no generic partial warning in partial mode', () => {
    const result = service.validateSettings(26, singleSettings(5, true), class7A);
    expect(result.warnings).toEqual([
      { key: 'grouping.warnings.singleGenderTooSmallOne', params: { count: 1, groupSize: 5 } },
    ]);
  });

  it('adds an aggregated uneven-distribution warning when partial groups are disallowed', () => {
    const result = service.validateSettings(26, singleSettings(5, false), class7A);
    expect(result.warnings).toEqual([
      { key: 'grouping.warnings.singleGenderTooSmallOne', params: { count: 1, groupSize: 5 } },
      // female 13 % 5 = 3, male 12 % 5 = 2
      { key: 'grouping.warnings.unevenDistributionMany', params: { peopleCount: 25, groupSize: 5, remainder: 5 } },
    ]);
  });

  it('uses the singular uneven-distribution key when the summed remainder is 1', () => {
    const result = service.validateSettings(11, singleSettings(5, false), { female: 11 });
    expect(result.warnings).toEqual([
      { key: 'grouping.warnings.unevenDistributionOne', params: { peopleCount: 11, groupSize: 5, remainder: 1 } },
    ]);
  });

  it('treats undefined allowPartialGroups as partial allowed', () => {
    const result = service.validateSettings(26, singleSettings(5, undefined), class7A);
    expect(result.warnings.map((warning) => warning.key)).toEqual(['grouping.warnings.singleGenderTooSmallOne']);
  });

  it('aggregates several too-small genders into one warning with the total affected people', () => {
    const result = service.validateSettings(7, singleSettings(5, true), { female: 3, male: 2, nonbinary: 2 });
    const tooSmall = result.warnings.filter((warning) => warning.key.includes('singleGenderTooSmall'));
    expect(tooSmall).toEqual([
      { key: 'grouping.warnings.singleGenderTooSmallMany', params: { count: 7, groupSize: 5 } },
    ]);
  });

  it('warns for a lone unspecified person (unspecified is an ordinary bucket)', () => {
    const result = service.validateSettings(9, singleSettings(4, true), { female: 8, unspecified: 1 });
    expect(result.warnings).toEqual([
      { key: 'grouping.warnings.singleGenderTooSmallOne', params: { count: 1, groupSize: 4 } },
    ]);
  });

  it('keeps the groupSizeLargerThanPeople warning', () => {
    const result = service.validateSettings(3, singleSettings(5, true), { female: 3 });
    expect(result.warnings.map((warning) => warning.key)).toEqual([
      'grouping.warnings.groupSizeLargerThanPeople',
      'grouping.warnings.singleGenderTooSmallMany',
    ]);
  });

  it('leaves mixed and ignore mode output unchanged even when genderCounts are passed', () => {
    for (const genderMode of ['mixed', 'ignore'] as const) {
      const settings: GroupingSettings = { strategy: GroupingStrategy.RANDOM, groupSize: 5, allowPartialGroups: true, genderMode };
      expect(service.validateSettings(26, settings, class7A)).toEqual(service.validateSettings(26, settings));
      expect(service.validateSettings(26, settings).warnings).toEqual([
        { key: 'grouping.warnings.partialGroupOne', params: { remainder: 1, groupSize: 5 } },
      ]);
    }
  });

  it('returns the legacy output for single mode without genderCounts', () => {
    expect(service.validateSettings(26, singleSettings(5, true)).warnings).toEqual([
      { key: 'grouping.warnings.partialGroupOne', params: { remainder: 1, groupSize: 5 } },
    ]);
    expect(service.validateSettings(26, singleSettings(5, false)).warnings).toEqual([
      { key: 'grouping.warnings.unevenDistributionOne', params: { peopleCount: 26, groupSize: 5, remainder: 1 } },
    ]);
  });

  it('still reports errors in single mode', () => {
    const result = service.validateSettings(0, singleSettings(0, true), {});
    expect(result.isValid).toBe(false);
    expect(result.errors.map((error) => error.key)).toEqual(['grouping.errors.noPeople', 'grouping.errors.groupSizeMin']);
  });

  it('matches generation: warnings appear exactly when a gender cannot fill or evenly fill groups', () => {
    const countSets: Partial<Record<TestGender, number>>[] = [
      { female: 10 }, { female: 13, male: 12, nonbinary: 1 }, { female: 5, male: 5 },
      { female: 3, male: 2 }, { female: 4, male: 9, unspecified: 1 }, { female: 12 }, { female: 1 },
    ];
    for (const counts of countSets) {
      for (const groupSize of [2, 3, 4, 5]) {
        for (const partial of [true, false]) {
          const values = Object.values(counts) as number[];
          const total = values.reduce((a, b) => a + b, 0);
          const settings = singleSettings(groupSize, partial);
          const keys = service.validateSettings(total, settings, counts as Record<string, number>).warnings.map((w) => w.key);

          const anyTooSmall = values.some((count) => count < groupSize);
          const anyUneven = !partial && values.some((count) => count >= groupSize && count % groupSize !== 0);
          expect(keys.some((key) => key.includes('singleGenderTooSmall'))).toBe(anyTooSmall);
          expect(keys.some((key) => key.includes('unevenDistribution'))).toBe(anyUneven);

          const session = buildSession(buildPeople(counts));
          const groups = new GroupingService().createGroupsWithSession(session, settings, 'en-US').groups;
          expectEveryonePlacedOnce(groups, session);
          if (!partial) {
            expect(groups.some((group) => group.memberIds.length < groupSize)).toBe(anyTooSmall);
          }
        }
      }
    }
  });
});

function buildSession(
  peopleInput: { id: string; name: string; gender?: 'female' | 'male' | 'nonbinary' | 'unspecified' }[]
): Session {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return {
    id: 'session-1',
    name: 'Session',
    people: peopleInput.map((person) => ({
      ...person,
      gender: person.gender ?? 'unspecified',
      weights: {},
      createdAt: now,
    })),
    preferences: {},
    preferenceScoring: { wantWith: 2, avoid: -2 },
    groupingHistory: [],
    customWeights: [],
    genderMode: 'mixed',
    createdAt: now,
    updatedAt: now,
  };
}
