import { GroupingStrategy } from '../../../models/group.model';
import { strategyLabelKey } from './strategy-label';

describe('strategyLabelKey', () => {
  it('maps every strategy to its existing translation key', () => {
    expect(strategyLabelKey(GroupingStrategy.RANDOM)).toBe('sessionDetail.strategyRandom');
    expect(strategyLabelKey(GroupingStrategy.PREFERENCE_BASED)).toBe('sessionDetail.strategyPreferenceBased');
    expect(strategyLabelKey(GroupingStrategy.WEIGHTED)).toBe('sessionDetail.strategyWeighted');
  });
});
