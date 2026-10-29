import axe from 'axe-core';

// jsdom has no layout or rendering, so rules that depend on them cannot run reliably.
const DISABLED_RULES = ['color-contrast', 'region'];

export async function getAxeViolations(element: Element): Promise<string[]> {
  const results = await axe.run(element, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    rules: Object.fromEntries(DISABLED_RULES.map((rule) => [rule, { enabled: false }])),
  });

  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
