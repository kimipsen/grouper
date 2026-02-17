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

function buildSession(peopleInput: Array<{ id: string; name: string }>): Session {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return {
    id: 'session-1',
    name: 'Session',
    people: peopleInput.map((person) => ({
      ...person,
      gender: 'unspecified',
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
