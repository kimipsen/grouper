import { TestBed } from '@angular/core/testing';
import { GroupingStrategy } from '../../models/group.model';
import { DEFAULT_PREFERENCE_SCORING, Session } from '../../models/session.model';
import { SessionStorageService } from './session-storage.service';
import { StorageService } from './storage.service';

describe('SessionStorageService', () => {
  let service: SessionStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SessionStorageService, StorageService],
    });
    service = TestBed.inject(SessionStorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('exports only the latest 5 grouping history entries', () => {
    const session = buildSessionWithHistory(7);

    const exported = JSON.parse(service.exportSession(session));

    expect(exported.groupingHistory).toHaveLength(5);
    expect(exported.groupingHistory.map((entry: { overallSatisfaction: number }) => entry.overallSatisfaction))
      .toEqual([2, 3, 4, 5, 6]);
  });

  it('exports all grouping history entries when there are 5 or fewer', () => {
    const session = buildSessionWithHistory(3);

    const exported = JSON.parse(service.exportSession(session));

    expect(exported.groupingHistory).toHaveLength(3);
    expect(exported.groupingHistory.map((entry: { overallSatisfaction: number }) => entry.overallSatisfaction))
      .toEqual([0, 1, 2]);
  });

  it('persists preference scoring when exporting a session', () => {
    const session = buildSessionWithHistory(0);
    session.preferenceScoring = { wantWith: 4, avoid: -7 };

    const exported = JSON.parse(service.exportSession(session));

    expect(exported.preferenceScoring).toEqual({ wantWith: 4, avoid: -7 });
  });

  it('defaults preference scoring when importing legacy sessions without preferenceScoring', () => {
    const jsonWithoutScoring = JSON.stringify({
      id: 'legacy-session',
      name: 'Legacy',
      people: [],
      preferences: {},
      groupingHistory: [],
      customWeights: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    const imported = service.importSession(jsonWithoutScoring);

    expect(imported.preferenceScoring).toEqual(DEFAULT_PREFERENCE_SCORING);
  });
});

function buildSessionWithHistory(historyCount: number): Session {
  return {
    id: 'session-1',
    name: 'Session 1',
    description: 'Test session',
    people: [],
    preferences: {},
    preferenceScoring: { ...DEFAULT_PREFERENCE_SCORING },
    groupingHistory: Array.from({ length: historyCount }, (_value, index) => ({
      groups: [
        {
          id: `group-${index}`,
          name: `Group ${index}`,
          memberIds: [],
        },
      ],
      strategy: GroupingStrategy.RANDOM,
      settings: {
        strategy: GroupingStrategy.RANDOM,
        groupSize: 2,
      },
      timestamp: new Date(Date.UTC(2024, 0, index + 1)),
      overallSatisfaction: index,
    })),
    customWeights: [],
    genderMode: 'mixed',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };
}
