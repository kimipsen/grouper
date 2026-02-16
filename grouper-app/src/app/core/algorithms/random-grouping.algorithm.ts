import { Person } from '../../models/person.model';
import { Group } from '../../models/group.model';
import { v4 as uuidv4 } from 'uuid';

/**
 * Random grouping algorithm using Fisher-Yates shuffle
 */
export class RandomGroupingAlgorithm {

  /**
   * Create random groups from a list of people
   * @param people Array of people to group
   * @param groupSize Desired size of each group
   * @param allowPartialGroups Whether to allow groups smaller than groupSize
   * @returns Array of groups
   */
  static createGroups(people: Person[], groupSize: number, allowPartialGroups: boolean = true): Group[] {
    if (people.length === 0) {
      return [];
    }

    if (groupSize < 1) {
      throw new Error('Group size must be at least 1');
    }

    // Shuffle the people array
    const shuffled = this.shuffleArray([...people]);

    // Create groups
    const groups: Group[] = [];
    const remainder = shuffled.length % groupSize;
    const numberOfFullGroups = Math.floor(shuffled.length / groupSize);

    if (allowPartialGroups || remainder === 0) {
      // Simple chunking: create groups of groupSize and one partial group if needed
      for (let i = 0; i < shuffled.length; i += groupSize) {
        const chunk = shuffled.slice(i, i + groupSize);
        groups.push({
          id: uuidv4(),
          name: `Group ${groups.length + 1}`,
          memberIds: chunk.map(p => p.id)
        });
      }
    } else {
      // Distribute remainder evenly across groups to avoid partial groups
      // Strategy: Add one extra person to the first 'remainder' groups
      let personIndex = 0;

      for (let i = 0; i < numberOfFullGroups; i++) {
        const currentGroupSize = i < remainder ? groupSize + 1 : groupSize;
        const chunk = shuffled.slice(personIndex, personIndex + currentGroupSize);
        groups.push({
          id: uuidv4(),
          name: `Group ${groups.length + 1}`,
          memberIds: chunk.map(p => p.id)
        });
        personIndex += currentGroupSize;
      }
    }

    return groups;
  }

  /**
   * Fisher-Yates shuffle algorithm
   * @param array Array to shuffle
   * @returns Shuffled array (new array)
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
