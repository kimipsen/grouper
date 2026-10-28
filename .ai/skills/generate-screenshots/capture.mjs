// Captures screenshots of the running Grouper app with seeded demo data.
//
// Usage (see SKILL.md for installing Playwright outside the repo):
//   PLAYWRIGHT_HOME=/path/to/pw node capture.mjs [--base-url http://localhost:4204] [--out docs/screenshots]
//                    [--locales en,da] [--viewports desktop,mobile] [--no-seed]
//
// Output files are named <page>-<locale>-<viewport>.png.

import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// Playwright is not a repo dependency; resolve it from PLAYWRIGHT_HOME (a dir with node_modules/playwright).
const requireFrom = createRequire(path.join(process.env.PLAYWRIGHT_HOME ?? process.cwd(), 'index.js'));
const { chromium } = requireFrom('playwright');

const args = parseArgs(process.argv.slice(2));
const baseUrl = (args['base-url'] ?? 'http://localhost:4204').replace(/\/$/, '');
const outDir = path.resolve(args.out ?? 'docs/screenshots');
const locales = (args.locales ?? 'en,da').split(',');
const viewportNames = (args.viewports ?? 'desktop,mobile').split(',');
const seed = !args['no-seed'];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const DEMO_SESSION_ID = 'demo-session';

const PAGES = [
  { name: 'session-list', url: '/sessions' },
  { name: 'session-detail', url: `/session/${DEMO_SESSION_ID}` },
];

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i++;
    }
  }
  return parsed;
}

function buildDemoSessions() {
  const createdAt = '2026-01-15T09:00:00.000Z';
  const names = [
    ['Anna', 'female'], ['Bo', 'male'], ['Clara', 'female'], ['David', 'male'],
    ['Emma', 'female'], ['Frederik', 'male'], ['Ida', 'female'], ['Jonas', 'male'],
    ['Karla', 'female'], ['Lucas', 'male'], ['Maja', 'female'], ['Noah', 'nonbinary'],
  ];
  const people = names.map(([name, gender], index) => ({
    id: `p${index + 1}`,
    name,
    gender,
    weights: { skill: (index % 5) + 1 },
    createdAt,
  }));
  const groups = [0, 1, 2].map((groupIndex) => ({
    id: `g${groupIndex + 1}`,
    name: `Group ${groupIndex + 1}`,
    memberIds: people.filter((_, i) => i % 3 === groupIndex).map((p) => p.id),
    satisfactionScore: 0.8,
  }));

  return [
    {
      id: DEMO_SESSION_ID,
      name: 'Team workshop',
      description: 'Demo session used for screenshots',
      people,
      preferences: {
        p1: { wantWith: ['p3'], avoid: ['p2'] },
        p4: { wantWith: ['p6'], avoid: [] },
      },
      preferenceScoring: { wantWith: 2, avoid: -2 },
      customWeights: [{ id: 'skill', name: 'Skill', mode: 'balance' }],
      genderMode: 'mixed',
      groupingHistory: [
        {
          groups,
          strategy: 'PREFERENCE_BASED',
          settings: { strategy: 'PREFERENCE_BASED', groupSize: 4, genderMode: 'mixed' },
          timestamp: '2026-01-15T10:00:00.000Z',
          overallSatisfaction: 0.8,
        },
      ],
      createdAt,
      updatedAt: '2026-01-15T10:00:00.000Z',
    },
    {
      id: 'demo-session-2',
      name: 'Study groups',
      people: people.slice(0, 6),
      preferences: {},
      groupingHistory: [],
      customWeights: [],
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const written = [];

  try {
    for (const locale of locales) {
      for (const viewportName of viewportNames) {
        const viewport = VIEWPORTS[viewportName];
        if (!viewport) throw new Error(`Unknown viewport "${viewportName}"`);

        const context = await browser.newContext({ viewport, locale, reducedMotion: 'reduce' });
        await context.addInitScript(
          ({ sessions, locale, seed }) => {
            if (sessionStorage.getItem('__screenshot_seeded')) return;
            sessionStorage.setItem('__screenshot_seeded', '1');
            localStorage.setItem('grouper.locale', locale);
            if (seed) localStorage.setItem('grouper_sessions', JSON.stringify(sessions));
          },
          { sessions: buildDemoSessions(), locale, seed },
        );

        const page = await context.newPage();
        for (const target of PAGES) {
          await page.goto(`${baseUrl}${target.url}`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const file = path.join(outDir, `${target.name}-${locale}-${viewportName}.png`);
          await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
          written.push(file);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(written.map((file) => path.relative(process.cwd(), file)).join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
