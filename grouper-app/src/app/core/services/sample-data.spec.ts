import { TestBed } from '@angular/core/testing';
import { GroupingStrategy } from '../../models/group.model';
import { Session } from '../../models/session.model';
import { GroupingService } from './grouping.service';
import { SessionStorageService } from './session-storage.service';
import { StorageService } from './storage.service';
import class7a from '../../../../public/sample-data/class-7a.json';
import class7b from '../../../../public/sample-data/class-7b.json';

// Guards the sample data sets documented in docs/sample-data.md against drifting from the import format.
const SAMPLE_FILES = [
  { file: 'class-7a.json', data: class7a },
  { file: 'class-7b.json', data: class7b },
];

describe('Sample data sets', () => {
  let storage: SessionStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SessionStorageService, StorageService],
    });
    storage = TestBed.inject(SessionStorageService);
  });

  describe.each(SAMPLE_FILES)('$file', ({ data }) => {
    let session: Session;

    beforeEach(() => {
      session = storage.importSession(JSON.stringify(data));
    });

    it('imports without validation errors', () => {
      expect(session.name).toBeTruthy();
      expect(session.groupingHistory).toEqual([]);
    });

    it('has 25-30 people with unique ids', () => {
      expect(session.people.length).toBeGreaterThanOrEqual(25);
      expect(session.people.length).toBeLessThanOrEqual(30);
      expect(new Set(session.people.map(p => p.id)).size).toBe(session.people.length);
    });

    it('gives every person 1-3 wantWith and at least 1 avoid preference', () => {
      for (const person of session.people) {
        const prefs = session.preferences[person.id];
        expect(prefs, person.name).toBeDefined();
        expect(prefs.wantWith.length, person.name).toBeGreaterThanOrEqual(1);
        expect(prefs.wantWith.length, person.name).toBeLessThanOrEqual(3);
        expect(prefs.avoid.length, person.name).toBeGreaterThanOrEqual(1);
      }
    });

    it('only references people in the same class', () => {
      const ids = new Set(session.people.map(p => p.id));

      expect(Object.keys(session.preferences).every(id => ids.has(id))).toBe(true);
      for (const [personId, prefs] of Object.entries(session.preferences)) {
        const targets = [...prefs.wantWith, ...prefs.avoid];
        expect(targets.every(id => ids.has(id) && id !== personId)).toBe(true);
        expect(prefs.wantWith.some(id => prefs.avoid.includes(id))).toBe(false);
      }
    });

    it('sets a value for every custom weight on every person', () => {
      expect(session.customWeights.length).toBeGreaterThan(0);
      for (const person of session.people) {
        for (const weight of session.customWeights) {
          expect(person.weights?.[weight.id], person.name).toEqual(expect.any(Number));
        }
      }
    });

    it('can be grouped with the preference-based strategy', () => {
      const result = new GroupingService().createGroupsWithSession(session, {
        strategy: GroupingStrategy.PREFERENCE_BASED,
        groupSize: 4,
        allowPartialGroups: true,
        genderMode: 'ignore',
      });

      const grouped = result.groups.flatMap(g => g.memberIds).sort();
      expect(grouped).toEqual(session.people.map(p => p.id).sort());
    });
  });
});
