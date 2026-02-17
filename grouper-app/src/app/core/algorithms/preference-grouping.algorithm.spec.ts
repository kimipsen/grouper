import { PreferenceGroupingAlgorithm } from './preference-grouping.algorithm';
import { PreferenceMap } from '../../models/preference.model';
import { Group } from '../../models/group.model';

describe('PreferenceGroupingAlgorithm scoring', () => {
  it('uses configured wantWith and avoid values when calculating satisfaction', () => {
    const group: Group = {
      id: 'g1',
      name: 'Group 1',
      memberIds: ['a', 'b'],
    };

    const preferences: PreferenceMap = {
      a: { wantWith: ['b'], avoid: [] },
      b: { wantWith: [], avoid: ['a'] },
    };

    const score = PreferenceGroupingAlgorithm.calculateGroupSatisfaction(group, preferences, {
      wantWith: 5,
      avoid: -9,
    });

    expect(score).toBe(-4);
  });
});
