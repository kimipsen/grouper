import en from '../../assets/i18n/en.json';
import da from '../../assets/i18n/da.json';

interface Dictionary {
  [key: string]: string | Dictionary;
}

function flatten(dictionary: Dictionary, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      entries.set(path, value);
    } else {
      flatten(value, path).forEach((nested, nestedPath) => entries.set(nestedPath, nested));
    }
  }
  return entries;
}

function placeholders(text: string): string[] {
  return (text.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map(match => match.replace(/\s+/g, '')).sort();
}

describe('locale parity (en/da)', () => {
  const enEntries = flatten(en as Dictionary);
  const daEntries = flatten(da as Dictionary);

  it('has identical keys in en.json and da.json', () => {
    expect([...daEntries.keys()].sort()).toEqual([...enEntries.keys()].sort());
  });

  it('uses identical interpolation placeholders for every key', () => {
    const mismatches = [...enEntries.entries()]
      .filter(([key]) => daEntries.has(key))
      .filter(([key, text]) => placeholders(text).join() !== placeholders(daEntries.get(key) ?? '').join())
      .map(([key]) => key);
    expect(mismatches).toEqual([]);
  });

  it('keeps the history keys using {{count}}, {{date}} and {{size}}', () => {
    expect(placeholders(enEntries.get('sessionDetail.history.count') ?? '')).toEqual(['{{count}}']);
    expect(placeholders(enEntries.get('sessionDetail.history.viewingFrom') ?? '')).toEqual(['{{date}}']);
    expect(placeholders(enEntries.get('sessionDetail.result.generatedAt') ?? '')).toEqual(['{{date}}']);
    expect(placeholders(enEntries.get('sessionDetail.result.settings.groupSize') ?? '')).toEqual(['{{size}}']);
    expect(placeholders(enEntries.get('sessionDetail.result.settings.weights') ?? '')).toEqual(['{{count}}']);
  });
});
