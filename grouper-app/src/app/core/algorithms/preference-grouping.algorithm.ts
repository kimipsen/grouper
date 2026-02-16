import { Person } from '../../models/person.model';
import { Group } from '../../models/group.model';
import { PreferenceMap } from '../../models/preference.model';
import { v4 as uuidv4 } from 'uuid';
import { RandomGroupingAlgorithm } from './random-grouping.algorithm';

/**
 * Preference-based grouping algorithm using simulated annealing
 * Balanced scoring: +2 for WANT_WITH satisfied, -2 for AVOID violated
 */
export class PreferenceGroupingAlgorithm {

  // Scoring constants
  private static readonly WANT_WITH_SCORE = 2;
  private static readonly AVOID_PENALTY = -2;

  // Annealing parameters
  private static readonly INITIAL_TEMPERATURE = 100;
  private static readonly COOLING_RATE = 0.95;
  private static readonly MIN_TEMPERATURE = 0.01;
  private static readonly MAX_ITERATIONS = 1000;

  /**
   * Create preference-based groups using simulated annealing
   * @param people Array of people to group
   * @param preferences Preference map
   * @param groupSize Desired size of each group
   * @param allowPartialGroups Whether to allow groups smaller than groupSize
   * @returns Array of groups with satisfaction scores
   */
  static createGroups(
    people: Person[],
    preferences: PreferenceMap,
    groupSize: number,
    allowPartialGroups: boolean = true
  ): { groups: Group[], overallSatisfaction: number } {

    if (people.length === 0) {
      return { groups: [], overallSatisfaction: 0 };
    }

    if (groupSize < 1) {
      throw new Error('Group size must be at least 1');
    }

    // Start with random grouping as initial solution
    let currentGroups = RandomGroupingAlgorithm.createGroups(people, groupSize, allowPartialGroups);
    let currentScore = this.calculateTotalSatisfaction(currentGroups, preferences);

    let bestGroups = this.deepCopyGroups(currentGroups);
    let bestScore = currentScore;

    let temperature = this.INITIAL_TEMPERATURE;
    let iterations = 0;

    // Simulated annealing optimization
    while (temperature > this.MIN_TEMPERATURE && iterations < this.MAX_ITERATIONS) {
      // Generate neighbor solution by swapping two people between groups
      const neighborGroups = this.generateNeighbor(currentGroups);
      const neighborScore = this.calculateTotalSatisfaction(neighborGroups, preferences);

      // Calculate delta
      const delta = neighborScore - currentScore;

      // Accept if better, or with probability based on temperature
      if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
        currentGroups = neighborGroups;
        currentScore = neighborScore;

        // Update best if this is the best we've seen
        if (currentScore > bestScore) {
          bestGroups = this.deepCopyGroups(currentGroups);
          bestScore = currentScore;
        }
      }

      // Cool down
      temperature *= this.COOLING_RATE;
      iterations++;
    }

    // Calculate individual group scores for the best solution
    const finalGroups = bestGroups.map(group => ({
      ...group,
      satisfactionScore: this.calculateGroupSatisfaction(group, preferences)
    }));

    return {
      groups: finalGroups,
      overallSatisfaction: bestScore
    };
  }

  /**
   * Calculate total satisfaction score for all groups
   * @param groups Array of groups
   * @param preferences Preference map
   * @returns Total satisfaction score
   */
  static calculateTotalSatisfaction(groups: Group[], preferences: PreferenceMap): number {
    return groups.reduce((total, group) =>
      total + this.calculateGroupSatisfaction(group, preferences), 0
    );
  }

  /**
   * Calculate satisfaction score for a single group
   * @param group Group to score
   * @param preferences Preference map
   * @returns Satisfaction score for the group
   */
  static calculateGroupSatisfaction(group: Group, preferences: PreferenceMap): number {
    let score = 0;
    const members = group.memberIds;

    // Check all pairs in the group
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const personA = members[i];
        const personB = members[j];

        // Check personA's preferences about personB
        if (preferences[personA]) {
          if (preferences[personA].wantWith.includes(personB)) {
            score += this.WANT_WITH_SCORE;
          }
          if (preferences[personA].avoid.includes(personB)) {
            score += this.AVOID_PENALTY;
          }
        }

        // Check personB's preferences about personA
        if (preferences[personB]) {
          if (preferences[personB].wantWith.includes(personA)) {
            score += this.WANT_WITH_SCORE;
          }
          if (preferences[personB].avoid.includes(personA)) {
            score += this.AVOID_PENALTY;
          }
        }
      }
    }

    return score;
  }

  /**
   * Generate a neighbor solution by swapping two random people between groups
   * @param groups Current groups
   * @returns New groups with one swap
   */
  private static generateNeighbor(groups: Group[]): Group[] {
    const newGroups = this.deepCopyGroups(groups);

    if (newGroups.length < 2) {
      return newGroups;
    }

    // Pick two random groups
    const groupIndex1 = Math.floor(Math.random() * newGroups.length);
    let groupIndex2 = Math.floor(Math.random() * newGroups.length);

    // Ensure different groups
    while (groupIndex2 === groupIndex1 && newGroups.length > 1) {
      groupIndex2 = Math.floor(Math.random() * newGroups.length);
    }

    const group1 = newGroups[groupIndex1];
    const group2 = newGroups[groupIndex2];

    if (group1.memberIds.length === 0 || group2.memberIds.length === 0) {
      return newGroups;
    }

    // Pick random members from each group
    const member1Index = Math.floor(Math.random() * group1.memberIds.length);
    const member2Index = Math.floor(Math.random() * group2.memberIds.length);

    // Swap members
    const temp = group1.memberIds[member1Index];
    group1.memberIds[member1Index] = group2.memberIds[member2Index];
    group2.memberIds[member2Index] = temp;

    return newGroups;
  }

  /**
   * Deep copy groups array
   * @param groups Groups to copy
   * @returns Deep copy of groups
   */
  private static deepCopyGroups(groups: Group[]): Group[] {
    return groups.map(group => ({
      ...group,
      memberIds: [...group.memberIds]
    }));
  }

  /**
   * Calculate the maximum possible satisfaction score
   * Useful for showing relative satisfaction percentage
   * @param peopleCount Number of people
   * @param groupSize Group size
   * @returns Maximum possible score
   */
  static calculateMaxPossibleScore(peopleCount: number, groupSize: number): number {
    const numberOfGroups = Math.ceil(peopleCount / groupSize);
    const pairsPerGroup = (groupSize * (groupSize - 1)) / 2;
    return numberOfGroups * pairsPerGroup * this.WANT_WITH_SCORE * 2; // *2 because both can prefer each other
  }
}
