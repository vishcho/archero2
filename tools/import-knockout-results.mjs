#!/usr/bin/env node
// 把淘汰賽結果抽取中繼 JSON（tmp/*.json）寫入正式賽季檔的 groups[].matches 與各組冠亞軍。
// 場次一律以 round/slot 歸位（R1 A–D、R2 upper/lower、決賽 final），不依截圖拍攝順序。
// 賽時戰力是快照：同一位選手在同組跨場必須相同；不同就是有一邊讀錯，中止而非取平均。
import path from 'node:path';
import { atomicWriteJson, readJson } from './lib/json.mjs';
import { assertSchema } from './lib/schema-validation.mjs';
import { validateTournamentResults } from './lib/domain.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [extractPathArg, dataPathArg] = args.filter((arg) => !arg.startsWith('--'));

if (!extractPathArg || !dataPathArg) {
  console.error('Usage: node tools/import-knockout-results.mjs <tmp/{extract}.json> <data/star-cup/{season}.json> [--dry-run]');
  process.exit(1);
}

const root = process.cwd();
const extract = await readJson(path.resolve(root, extractPathArg));
const dataPath = path.resolve(root, dataPathArg);
const season = await readJson(dataPath);

const fail = (message) => { console.error(`✗ ${message}`); process.exit(1); };

if (extract.season_id && extract.season_id !== season.id) {
  fail(`抽取檔 season_id ${extract.season_id} ≠ 賽季 id ${season.id}`);
}

const SLOTS = [['R1', 'A'], ['R1', 'B'], ['R1', 'C'], ['R1', 'D'], ['R2', 'upper'], ['R2', 'lower'], ['決賽', 'final']];
const byId = new Map((extract.groups ?? []).map((group) => [group.id, group]));
if (byId.size !== 8 || ![1, 2, 3, 4, 5, 6, 7, 8].every((id) => byId.has(id))) {
  fail(`抽取檔必須含第 1–8 組且不重複，實得 ${[...byId.keys()].join('、')}`);
}

const summary = [];
const groups = season.groups.map((group) => {
  const source = byId.get(group.id);
  const seen = new Map();
  const matches = SLOTS.map(([round, slot]) => {
    const found = (source.matches ?? []).find((m) => m.round === round && m.slot === slot);
    if (!found) fail(`第 ${group.id} 組缺 ${round}-${slot}`);
    for (const side of ['p1', 'p2']) {
      for (const field of ['name', 'progress', 'time', 'power']) {
        if (found[side]?.[field] === undefined || found[side][field] === '' || found[side][field] === null) {
          fail(`第 ${group.id} 組 ${round}-${slot} ${side}.${field} 缺值——讀不出來就留空，不得入庫`);
        }
      }
    }
    const names = [found.p1.name, found.p2.name];
    if (!names.includes(found.winner)) fail(`第 ${group.id} 組 ${round}-${slot} winner 不在雙方`);
    if (!names.includes(found.loser)) fail(`第 ${group.id} 組 ${round}-${slot} loser 不在雙方`);
    if (found.winner === found.loser) fail(`第 ${group.id} 組 ${round}-${slot} winner 與 loser 相同`);
    for (const side of [found.p1, found.p2]) {
      if (seen.has(side.name) && seen.get(side.name) !== side.power) {
        fail(`第 ${group.id} 組 ${side.name} 賽時戰力跨場不一致：${seen.get(side.name)} vs ${side.power}——快照不該變，有一邊讀錯`);
      }
      seen.set(side.name, side.power);
    }
    return {
      round, slot,
      p1: { name: found.p1.name, progress: found.p1.progress, time: found.p1.time, power: found.p1.power },
      p2: { name: found.p2.name, progress: found.p2.progress, time: found.p2.time, power: found.p2.power },
      winner: found.winner,
      loser: found.loser,
      ...(found.notes?.length ? { notes: found.notes } : {}),
    };
  });

  const r1 = matches.filter((m) => m.round === 'R1');
  const r1Players = r1.flatMap((m) => [m.p1.name, m.p2.name]);
  if (new Set(r1Players).size !== 8) fail(`第 ${group.id} 組 R1 八位選手有重複：${r1Players.join('、')}`);
  const final = matches.at(-1);
  if (source.champion !== final.winner) fail(`第 ${group.id} 組 champion ${source.champion} ≠ 決賽勝者 ${final.winner}`);
  if (source.runner_up !== final.loser) fail(`第 ${group.id} 組 runner_up ${source.runner_up} ≠ 決賽敗者 ${final.loser}`);
  const championPower = seen.get(final.winner);
  if (source.champion_power && source.champion_power !== championPower) {
    fail(`第 ${group.id} 組 champion_power ${source.champion_power} ≠ 冠軍賽時戰力 ${championPower}`);
  }

  summary.push({
    id: group.id, champion: source.champion, runner_up: source.runner_up,
    power: championPower, current: source.champion_current_power,
    notes: matches.filter((m) => m.notes).length,
  });

  return {
    ...group,
    matches,
    champion: source.champion,
    runner_up: source.runner_up,
    champion_power: championPower,
    ...(source.champion_current_power ? { champion_current_power: source.champion_current_power } : {}),
  };
});

const candidate = {
  ...season,
  collection: { ...(season.collection ?? {}), knockout_results: 'complete' },
  groups,
};

assertSchema('season', candidate, dataPathArg);
const domainErrors = validateTournamentResults(candidate, dataPathArg);
if (domainErrors.length) {
  console.error('✗ domain 驗證失敗：');
  for (const error of domainErrors) console.error(`  ${error.location}: ${error.message}`);
  process.exit(1);
}

console.log(`${dataPathArg} 淘汰賽結果候選資料（${groups.length} 組 × 7 場 = ${groups.length * 7} 場）`);
for (const s of summary) {
  console.log(`  第${s.id}組  冠軍 ${s.champion}（賽時 ${s.power}／目前 ${s.current ?? '—'}）　亞軍 ${s.runner_up}${s.notes ? `　notes ${s.notes} 場` : ''}`);
}
console.log(`  collection.knockout_results → complete`);
console.log(`  status 維持 ${candidate.status}（總決賽未入庫前不改 finished）`);

if (dryRun) {
  console.log('\n--dry-run：未寫入檔案');
  process.exit(0);
}

await atomicWriteJson(dataPath, candidate, {
  validate: (value, file) => { assertSchema('season', value, file); },
});
console.log(`\n✓ 已寫入 ${dataPathArg}`);
