import { GroupingStrategy } from '../../../models/group.model';

const STRATEGY_LABEL_KEYS: Record<GroupingStrategy, string> = {
  [GroupingStrategy.RANDOM]: 'sessionDetail.strategyRandom',
  [GroupingStrategy.PREFERENCE_BASED]: 'sessionDetail.strategyPreferenceBased',
  [GroupingStrategy.WEIGHTED]: 'sessionDetail.strategyWeighted',
};

export function strategyLabelKey(strategy: GroupingStrategy): string {
  return STRATEGY_LABEL_KEYS[strategy];
}
