import { GroupingStrategy } from '../../models/group.model';
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

function buildSession(
  peopleInput: Array<{ id: string; name: string; gender?: 'female' | 'male' | 'nonbinary' | 'unspecified' }>
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
