import { Injectable } from '@angular/core';
import { Person } from '../../models/person.model';
import { Group, GroupingResult, GroupingSettings, GroupingStrategy } from '../../models/group.model';
import { Session } from '../../models/session.model';
import { PreferenceMap } from '../../models/preference.model';
import { RandomGroupingAlgorithm } from '../algorithms/random-grouping.algorithm';
import { PreferenceGroupingAlgorithm } from '../algorithms/preference-grouping.algorithm';

@Injectable({
  providedIn: 'root'
})
export class GroupingService {

  /**
   * Create groups based on settings
   * @param people Array of people to group
   * @param settings Grouping settings
   * @param preferences Preference map (required for preference-based strategy)
   * @returns Grouping result
   */
  createGroups(people: Person[], settings: GroupingSettings, preferences?: PreferenceMap): GroupingResult {
    if (people.length === 0) {
      return {
        groups: [],
        strategy: settings.strategy,
        settings,
        timestamp: new Date(),
        overallSatisfaction: 0
      };
    }

    let groups: Group[];
    let overallSatisfaction: number | undefined;

    switch (settings.strategy) {
      case GroupingStrategy.RANDOM:
        groups = RandomGroupingAlgorithm.createGroups(
          people,
          settings.groupSize,
          settings.allowPartialGroups ?? true
        );
        break;

      case GroupingStrategy.PREFERENCE_BASED:
        if (!preferences) {
          throw { message: 'grouping.errors.preferencesRequired' };
        }
        {
          const result = PreferenceGroupingAlgorithm.createGroups(
            people,
            preferences,
            settings.groupSize,
            settings.allowPartialGroups ?? true
          );
          groups = result.groups;
          overallSatisfaction = result.overallSatisfaction;
        }
        break;

      case GroupingStrategy.WEIGHTED:
        throw { message: 'grouping.errors.weightedRequiresSession' };

      default:
        throw { message: 'grouping.errors.unknownStrategy', params: { strategy: settings.strategy } };
    }

    return {
      groups,
      strategy: settings.strategy,
      settings,
      timestamp: new Date(),
      overallSatisfaction
    };
  }

  createGroupsWithSession(session: Session, settings: GroupingSettings): GroupingResult {
    const genderMode = settings.genderMode ?? session.genderMode ?? 'mixed';

    if (settings.strategy === GroupingStrategy.WEIGHTED) {
      return this.createWeightedGroups(session, settings);
    }

    const result = this.createGroups(session.people, settings, session.preferences);

    if (genderMode === 'single') {
      result.groups = this.createSingleGenderGroups(session.people, settings);
      if (settings.strategy === GroupingStrategy.PREFERENCE_BASED && session.preferences) {
        result.overallSatisfaction = this.calculateSatisfaction(result.groups, session.preferences);
      }
      return result;
    }

    if (genderMode === 'mixed') {
      this.applyGenderMode(result.groups, session.people, genderMode);
    }

    return result;
  }

  /**
   * Validate grouping settings
   * @param peopleCount Number of people to group
   * @param settings Grouping settings
   * @returns Validation result with any warnings or errors
   */
  validateSettings(peopleCount: number, settings: GroupingSettings): ValidationResult {
    const errors: ValidationMessage[] = [];
    const warnings: ValidationMessage[] = [];

    if (peopleCount === 0) {
      errors.push({ key: 'grouping.errors.noPeople' });
    }

    if (settings.groupSize < 1) {
      errors.push({ key: 'grouping.errors.groupSizeMin' });
    }

    if (settings.groupSize > peopleCount) {
      warnings.push({
        key: 'grouping.warnings.groupSizeLargerThanPeople',
        params: { groupSize: settings.groupSize, peopleCount }
      });
    }

    const remainder = peopleCount % settings.groupSize;
    if (remainder !== 0 && !settings.allowPartialGroups) {
      warnings.push({
        key: remainder === 1
          ? 'grouping.warnings.unevenDistributionOne'
          : 'grouping.warnings.unevenDistributionMany',
        params: {
          peopleCount,
          groupSize: settings.groupSize,
          remainder
        }
      });
    } else if (remainder !== 0) {
      warnings.push({
        key: remainder === 1
          ? 'grouping.warnings.partialGroupOne'
          : 'grouping.warnings.partialGroupMany',
        params: {
          remainder,
          groupSize: settings.groupSize
        }
      });
    }

    const isValid = errors.length === 0;

    return { isValid, errors, warnings };
  }

  private createWeightedGroups(session: Session, settings: GroupingSettings): GroupingResult {
    const weightIds = this.expandWeightIds(settings.weightIds ?? []);
    if (weightIds.length === 0) {
      throw { message: 'grouping.errors.noWeightsSelected' };
    }

    const genderMode = settings.genderMode ?? session.genderMode ?? 'mixed';
    const groups = genderMode === 'single'
      ? this.createSingleGenderGroups(session.people, settings)
      : RandomGroupingAlgorithm.createGroups(
          session.people,
          settings.groupSize,
          settings.allowPartialGroups ?? true
        );

    if (genderMode === 'mixed') {
      this.applyGenderMode(groups, session.people, genderMode);
    }
    this.balanceWeights(groups, session.people, weightIds);

    return {
      groups,
      strategy: settings.strategy,
      settings,
      timestamp: new Date(),
      overallSatisfaction: undefined
    };
  }

  private expandWeightIds(weightIds: string[]): string[] {
    if (!weightIds.includes('__gender__')) {
      return weightIds;
    }

    const expanded = weightIds.filter(id => id !== '__gender__');
    expanded.push('gender:female', 'gender:male', 'gender:nonbinary', 'gender:unspecified');
    return expanded;
  }

  private applyGenderMode(groups: Group[], people: Person[], mode: 'mixed' | 'single' | 'ignore'): void {
    if (mode === 'ignore') return;

    const genderOf = (personId: string): string => {
      const person = people.find(p => p.id === personId);
      return person?.gender ?? 'unspecified';
    };

    if (mode === 'single') {
      return;
    }

    // mixed mode: attempt to reduce same-gender clustering
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const groupA = groups[i];
        const groupB = groups[j];

        const gendersA = groupA.memberIds.map(genderOf);
        const gendersB = groupB.memberIds.map(genderOf);

        const dominantA = this.getDominantGender(gendersA);
        const dominantB = this.getDominantGender(gendersB);

        if (dominantA && dominantB && dominantA === dominantB) {
          const swapA = groupA.memberIds.find(id => genderOf(id) === dominantA);
          const swapB = groupB.memberIds.find(id => genderOf(id) !== dominantB);
          if (swapA && swapB) {
            const indexA = groupA.memberIds.indexOf(swapA);
            const indexB = groupB.memberIds.indexOf(swapB);
            groupA.memberIds[indexA] = swapB;
            groupB.memberIds[indexB] = swapA;
          }
        }
      }
    }
  }

  private createSingleGenderGroups(people: Person[], settings: GroupingSettings): Group[] {
    const genderBuckets = new Map<string, Person[]>();
    for (const person of people) {
      const gender = person.gender ?? 'unspecified';
      const bucket = genderBuckets.get(gender) ?? [];
      bucket.push(person);
      genderBuckets.set(gender, bucket);
    }

    const groups: Group[] = [];
    for (const bucket of genderBuckets.values()) {
      const bucketGroups = RandomGroupingAlgorithm.createGroups(
        bucket,
        settings.groupSize,
        settings.allowPartialGroups ?? true
      );
      groups.push(...bucketGroups);
    }

    return groups;
  }

  private getDominantGender(genders: string[]): string | null {
    const counts = new Map<string, number>();
    for (const gender of genders) {
      counts.set(gender, (counts.get(gender) ?? 0) + 1);
    }
    let dominant: string | null = null;
    let max = 0;
    counts.forEach((count, gender) => {
      if (count > max) {
        dominant = gender;
        max = count;
      }
    });
    return dominant;
  }

  private balanceWeights(groups: Group[], people: Person[], weightIds: string[]): void {
    const personById = new Map(people.map(person => [person.id, person]));

    for (let iteration = 0; iteration < 150; iteration++) {
      let improved = false;
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const groupA = groups[i];
          const groupB = groups[j];

          const diffBefore = this.groupWeightDiff(groupA, groupB, personById, weightIds);
          let bestSwap: { a: string; b: string; diff: number } | null = null;

          for (const memberA of groupA.memberIds) {
            for (const memberB of groupB.memberIds) {
              const diffAfter = this.groupWeightDiffWithSwap(groupA, groupB, personById, weightIds, memberA, memberB);
              if (diffAfter < diffBefore && (!bestSwap || diffAfter < bestSwap.diff)) {
                bestSwap = { a: memberA, b: memberB, diff: diffAfter };
              }
            }
          }

          if (bestSwap) {
            const indexA = groupA.memberIds.indexOf(bestSwap.a);
            const indexB = groupB.memberIds.indexOf(bestSwap.b);
            groupA.memberIds[indexA] = bestSwap.b;
            groupB.memberIds[indexB] = bestSwap.a;
            improved = true;
          }
        }
      }

      if (!improved) break;
    }
  }

  private groupWeightDiff(groupA: Group, groupB: Group, personById: Map<string, Person>, weightIds: string[]): number {
    const totalsA = this.sumGroupWeights(groupA, personById, weightIds);
    const totalsB = this.sumGroupWeights(groupB, personById, weightIds);
    return weightIds.reduce((sum, weightId) => sum + Math.abs(totalsA[weightId] - totalsB[weightId]), 0);
  }

  private groupWeightDiffWithSwap(
    groupA: Group,
    groupB: Group,
    personById: Map<string, Person>,
    weightIds: string[],
    memberA: string,
    memberB: string
  ): number {
    const totalsA = this.sumGroupWeights(groupA, personById, weightIds, memberA, memberB);
    const totalsB = this.sumGroupWeights(groupB, personById, weightIds, memberB, memberA);
    return weightIds.reduce((sum, weightId) => sum + Math.abs(totalsA[weightId] - totalsB[weightId]), 0);
  }

  private sumGroupWeights(
    group: Group,
    personById: Map<string, Person>,
    weightIds: string[],
    swapOut?: string,
    swapIn?: string
  ): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const weightId of weightIds) {
      totals[weightId] = 0;
    }

    for (const memberId of group.memberIds) {
      const resolvedId = memberId === swapOut ? swapIn : memberId;
      if (!resolvedId) continue;
      const person = personById.get(resolvedId);
      if (!person) continue;
      for (const weightId of weightIds) {
        if (weightId.startsWith('gender:')) {
          const genderKey = weightId.split(':')[1];
          const gender = person.gender ?? 'unspecified';
          totals[weightId] += gender === genderKey ? 1 : 0;
        } else {
          totals[weightId] += person.weights?.[weightId] ?? 0;
        }
      }
    }
    return totals;
  }

  /**
   * Calculate satisfaction score for existing groups
   * @param groups Array of groups
   * @param preferences Preference map
   * @returns Overall satisfaction score
   */
  calculateSatisfaction(groups: Group[], preferences: PreferenceMap): number {
    return PreferenceGroupingAlgorithm.calculateTotalSatisfaction(groups, preferences);
  }

  /**
   * Get group statistics
   * @param groups Array of groups
   * @returns Statistics about the groups
   */
  getGroupStatistics(groups: Group[]): GroupStatistics {
    if (groups.length === 0) {
      return {
        totalGroups: 0,
        totalPeople: 0,
        averageGroupSize: 0,
        minGroupSize: 0,
        maxGroupSize: 0
      };
    }

    const groupSizes = groups.map(g => g.memberIds.length);
    const totalPeople = groupSizes.reduce((sum, size) => sum + size, 0);

    return {
      totalGroups: groups.length,
      totalPeople,
      averageGroupSize: totalPeople / groups.length,
      minGroupSize: Math.min(...groupSizes),
      maxGroupSize: Math.max(...groupSizes)
    };
  }

  /**
   * Suggest optimal group size based on total people
   * @param peopleCount Number of people
   * @returns Suggested group sizes with reasoning
   */
  suggestGroupSizes(peopleCount: number): GroupSizeSuggestion[] {
    if (peopleCount === 0) {
      return [];
    }

    const suggestions: GroupSizeSuggestion[] = [];

    // Common group sizes to consider
    const sizesToTry = [2, 3, 4, 5, 6];

    for (const size of sizesToTry) {
      if (size > peopleCount) break;

      const numberOfGroups = Math.ceil(peopleCount / size);
      const remainder = peopleCount % size;
      const isEven = remainder === 0;

      let reason = `${numberOfGroups} ${numberOfGroups === 1 ? 'group' : 'groups'}`;
      if (!isEven) {
        reason += ` (one group with ${remainder} ${remainder === 1 ? 'person' : 'people'})`;
      }

      suggestions.push({
        groupSize: size,
        numberOfGroups,
        isEvenSplit: isEven,
        reason
      });
    }

    return suggestions;
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

export interface ValidationMessage {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Group statistics interface
 */
export interface GroupStatistics {
  totalGroups: number;
  totalPeople: number;
  averageGroupSize: number;
  minGroupSize: number;
  maxGroupSize: number;
}

/**
 * Group size suggestion interface
 */
export interface GroupSizeSuggestion {
  groupSize: number;
  numberOfGroups: number;
  isEvenSplit: boolean;
  reason: string;
}
