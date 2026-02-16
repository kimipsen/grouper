import { Injectable } from '@angular/core';
import { Person } from '../../models/person.model';
import { Group, GroupingResult, GroupingSettings, GroupingStrategy } from '../../models/group.model';
import { PreferenceMap } from '../../models/preference.model';
import { RandomGroupingAlgorithm } from '../algorithms/random-grouping.algorithm';
import { PreferenceGroupingAlgorithm } from '../algorithms/preference-grouping.algorithm';

@Injectable({
  providedIn: 'root'
})
export class GroupingService {

  constructor() { }

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
          throw new Error('Preferences are required for preference-based grouping');
        }
        const result = PreferenceGroupingAlgorithm.createGroups(
          people,
          preferences,
          settings.groupSize,
          settings.allowPartialGroups ?? true
        );
        groups = result.groups;
        overallSatisfaction = result.overallSatisfaction;
        break;

      default:
        throw new Error(`Unknown grouping strategy: ${settings.strategy}`);
    }

    return {
      groups,
      strategy: settings.strategy,
      settings,
      timestamp: new Date(),
      overallSatisfaction
    };
  }

  /**
   * Validate grouping settings
   * @param peopleCount Number of people to group
   * @param settings Grouping settings
   * @returns Validation result with any warnings or errors
   */
  validateSettings(peopleCount: number, settings: GroupingSettings): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (peopleCount === 0) {
      errors.push('No people to group');
    }

    if (settings.groupSize < 1) {
      errors.push('Group size must be at least 1');
    }

    if (settings.groupSize > peopleCount) {
      warnings.push(`Group size (${settings.groupSize}) is larger than number of people (${peopleCount})`);
    }

    const remainder = peopleCount % settings.groupSize;
    if (remainder !== 0 && !settings.allowPartialGroups) {
      warnings.push(
        `${peopleCount} people cannot be evenly divided into groups of ${settings.groupSize}. ` +
        `${remainder} ${remainder === 1 ? 'person' : 'people'} will be distributed across groups.`
      );
    } else if (remainder !== 0) {
      warnings.push(
        `One group will have ${remainder} ${remainder === 1 ? 'person' : 'people'} ` +
        `instead of ${settings.groupSize}`
      );
    }

    const isValid = errors.length === 0;

    return { isValid, errors, warnings };
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
  errors: string[];
  warnings: string[];
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
