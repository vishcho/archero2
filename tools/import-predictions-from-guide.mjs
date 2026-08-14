import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson, readJson } from './lib/json.mjs';
import { dataPath, repoRoot } from './lib/repo.mjs';
import { assertSchema } from './lib/schema-validation.mjs';
import { validatePrediction } from './lib/domain.mjs';

const [seasonId, guideArg] = process.argv.slice(2);
if (!seasonId || !guideArg) {
  console.error('用法：node tools/import-predictions-from-guide.mjs <season-id> <guide.md> [--dry-run]');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const guidePath = path.resolve(guideArg);
const guide = await readFile(guidePath, 'utf8');
const season = await readJson(dataPath('star-cup', `${seasonId}.json`));
const sections = guide.split(/^### 第 \d+ 組.*$/m).slice(1);
const matchupPath = guidePath.replace(/-betting-guide\.md$/, '-matchup.md');
const matchup = await readFile(matchupPath, 'utf8');
const matchupSections = matchup.split(/^## 第 \d+ 組.*$/m).slice(1, 9);
if (sections.length !== 8) throw new Error(`Guide 應有 8 組，得到 ${sections.length}`);
if (matchupSections.length !== 8) throw new Error(`Matchup 應有 8 組，得到 ${matchupSections.length}`);

const slotInfo = [
  ['R1', 'A', []], ['R1', 'B', []], ['R1', 'C', []], ['R1', 'D', []],
  ['R2', 'upper', ['A', 'C']], ['R2', 'lower', ['B', 'D']], ['決賽', 'final', ['upper', 'lower']],
];
const cleanPick = (value) => value.trim().replace(/\((?:\d+(?:\.\d+)?M|\d+(?:\.\d+)?K)\)$/, '').trim();
const cleanName = (value) => value.trim().replace(/\s*[⚠≈].*$/, '').trim();
const player = (side) => ({ name: side.name, player_id: side.player_id ?? null });
const distance = (a, b) => {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return rows[a.length][b.length];
};
const choose = (label, p1, p2) => {
  const target = cleanPick(label);
  if (target === p1.name || label.startsWith(`${p1.name}(`)) return 'p1';
  if (target === p2.name || label.startsWith(`${p2.name}(`)) return 'p2';
  const d1 = distance(target, p1.name);
  const d2 = distance(target, p2.name);
  if (Math.min(d1, d2) <= 2 && d1 !== d2) return d1 < d2 ? 'p1' : 'p2';
  throw new Error(`無法把押注「${label}」對應到 ${p1.name} / ${p2.name}`);
};

const groups = sections.map((section, index) => {
  const rows = [...section.matchAll(/^\| (R1-[A-D]|R2 [^|]+|決賽) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)];
  if (rows.length !== 7) throw new Error(`第 ${index + 1} 組應有 7 筆，得到 ${rows.length}`);
  const entrants = [...matchupSections[index].matchAll(/^\| \*\*([A-D])\*\* \| ([^|]+) \|/gm)];
  const firstRound = new Map();
  for (const slot of ['A', 'B', 'C', 'D']) {
    const names = entrants.filter((entry) => entry[1] === slot).map((entry) => cleanName(entry[2]));
    if (names.length !== 2) throw new Error(`第 ${index + 1} 組 ${slot} 應有兩位選手，得到 ${names.length}`);
    firstRound.set(slot, { p1: { name: names[0] }, p2: { name: names[1] } });
  }
  const selected = new Map();
  const picks = rows.map((row, rowIndex) => {
    const [round, slot, dependencies] = slotInfo[rowIndex];
    let p1;
    let p2;
    if (round === 'R1') {
      const match = firstRound.get(slot);
      if (!match) throw new Error(`第 ${index + 1} 組缺少 R1/${slot}`);
      p1 = player(match.p1);
      p2 = player(match.p2);
    } else {
      p1 = selected.get(dependencies[0]);
      p2 = selected.get(dependencies[1]);
    }
    const selectedSide = choose(row[2].trim(), p1, p2);
    const picked = selectedSide === 'p1' ? p1 : p2;
    selected.set(slot, picked);
    const confidence = row[3].includes('✅') ? 'high' : row[3].includes('⚖') ? 'medium' : 'low';
    return {
      round,
      slot,
      p1,
      p2,
      selected_side: selectedSide,
      confidence,
      basis: 'legacy_guide',
      reason: row[4].trim(),
      missing: [],
      forced: false,
      depends_on: dependencies,
    };
  });
  return { id: index + 1, picks };
});

const entrants = season.groups.flatMap((group) => group.players ?? []);
const prediction = {
  season_id: seasonId,
  status: 'published',
  source: 'document_reconstruction',
  published_at: `${seasonId}T23:59:00+08:00`,
  ruleset: 'legacy-guide-v1',
  source_document: path.relative(repoRoot, guidePath),
  coverage: {
    power: { available: entrants.filter((entry) => entry.power).length, total: 64 },
    qualifier: { available: entrants.filter((entry) => entry.qualifier_rank != null && entry.qualifier_time).length, total: 64 },
    history: { available: entrants.filter((entry) => entry.prev_best || entry.prev_progress).length, total: 64 },
  },
  groups,
};

const output = dataPath('predictions', 'star-cup', `${seasonId}.json`);
assertSchema('prediction', prediction, output);
const seasonIds = new Set(await readJson(dataPath('star-cup', 'seasons.json')));
const domainErrors = validatePrediction(prediction, seasonIds, output);
if (domainErrors.length) throw new Error(domainErrors.map((error) => `${error.location}: ${error.message}`).join('\n'));
if (dryRun) console.log(JSON.stringify(prediction, null, 2));
else {
  await mkdir(path.dirname(output), { recursive: true });
  await atomicWriteJson(output, prediction, { validate: async (candidate) => assertSchema('prediction', candidate, output) });
  console.log(`已寫入 ${path.relative(repoRoot, output)}`);
}
