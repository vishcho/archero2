#!/usr/bin/env node
// 把總決賽抽取中繼 JSON（tmp/*.json）寫入正式賽季檔的 grand_finals。
// 名次規則由 tools/lib/domain.mjs 決定：多重集必須為 1,2,3,3,5,5,5,5
// ——兩位準決賽敗者並列 3、四位八強敗者並列 5，不猜測同輪淘汰者內部順序。
import path from 'node:path';
import { atomicWriteJson, readJson } from './lib/json.mjs';
import { assertSchema } from './lib/schema-validation.mjs';
import { validateTournamentResults } from './lib/domain.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [extractPathArg, dataPathArg] = args.filter((arg) => !arg.startsWith('--'));

if (!extractPathArg || !dataPathArg) {
  console.error('Usage: node tools/import-grand-finals.mjs <tmp/{extract}.json> <data/star-cup/{season}.json> [--dry-run]');
  process.exit(1);
}

const root = process.cwd();
const extractPath = path.resolve(root, extractPathArg);
const dataPath = path.resolve(root, dataPathArg);

const extract = await readJson(extractPath);
const season = await readJson(dataPath);

const fail = (message) => { console.error(`✗ ${message}`); process.exit(1); };

const matches = extract.matches ?? [];
const tree = extract.bracket_tree ?? {};
if (matches.length !== 7) fail(`bracket 應為 7 場，得到 ${matches.length}`);

// 場次歸位：以 round/slot 為準，不依截圖拍攝順序
const bracket = ['A', 'B', 'C', 'D'].map((slot) => findMatch('R1', slot))
  .concat(['upper', 'lower'].map((slot) => findMatch('R2', slot)))
  .concat([findMatch('決賽', 'final')]);

function findMatch(round, slot) {
  const found = matches.find((m) => m.round === round && m.slot === slot);
  if (!found) fail(`缺 ${round}-${slot}`);
  for (const side of ['p1', 'p2']) {
    for (const field of ['name', 'progress', 'time', 'power']) {
      if (found[side]?.[field] === undefined || found[side][field] === '') {
        fail(`${round}-${slot} ${side}.${field} 缺值——讀不出來就留空，不得入庫`);
      }
    }
  }
  const names = [found.p1.name, found.p2.name];
  if (!names.includes(found.winner)) fail(`${round}-${slot} winner 不在雙方`);
  if (!names.includes(found.loser)) fail(`${round}-${slot} loser 不在雙方`);
  return {
    round: found.round,
    slot: found.slot,
    p1: { name: found.p1.name, progress: found.p1.progress, time: found.p1.time, power: found.p1.power },
    p2: { name: found.p2.name, progress: found.p2.progress, time: found.p2.time, power: found.p2.power },
    winner: found.winner,
    loser: found.loser,
    ...(found.notes?.length ? { notes: found.notes } : {}),
  };
}

// 名次由賽果推導，不由抽取者填寫
const final = bracket.find((m) => m.round === '決賽');
const semis = bracket.filter((m) => m.round === 'R2');
const quarters = bracket.filter((m) => m.round === 'R1');
const powerOf = (name) => bracket.flatMap((m) => [m.p1, m.p2]).find((s) => s.name === name)?.power;

const results = [
  { rank: 1, name: final.winner },
  { rank: 2, name: final.loser },
  ...semis.map((m) => ({ rank: 3, name: m.loser })),
  ...quarters.map((m) => ({ rank: 5, name: m.loser })),
].map((entry) => {
  const power = powerOf(entry.name);
  return power ? { ...entry, name: entry.name, power } : entry;
});

// 與結果樹交叉比對（樹是獨立來源，不一致即中止）
if (tree.champion && tree.champion !== final.winner) fail(`結果樹冠軍 ${tree.champion} ≠ 決賽勝者 ${final.winner}`);
if (tree.runner_up && tree.runner_up !== final.loser) fail(`結果樹亞軍 ${tree.runner_up} ≠ 決賽敗者 ${final.loser}`);

// 賽時戰力是快照：同一人跨場必須相同
const snapshot = new Map();
for (const match of bracket) {
  for (const side of [match.p1, match.p2]) {
    if (snapshot.has(side.name) && snapshot.get(side.name) !== side.power) {
      fail(`${side.name} 賽時戰力跨場不一致：${snapshot.get(side.name)} vs ${side.power}——快照不該變，有一邊讀錯`);
    }
    snapshot.set(side.name, side.power);
  }
}

const candidate = {
  ...season,
  status: 'finished',
  champion: final.winner,
  collection: { ...(season.collection ?? {}), grand_finals: 'complete' },
  grand_finals: { results, bracket },
};

// 寫入前先驗證完整候選：schema + domain 都過才寫
assertSchema('season', candidate, dataPathArg);
const domainErrors = validateTournamentResults(candidate, dataPathArg);
if (domainErrors.length) {
  console.error('✗ domain 驗證失敗：');
  for (const error of domainErrors) console.error(`  ${error.location}: ${error.message}`);
  process.exit(1);
}

console.log(`${dataPathArg} 總決賽候選資料`);
console.log(`  冠軍 ${final.winner}　亞軍 ${final.loser}`);
console.log(`  並列 3：${semis.map((m) => m.loser).join('、')}`);
console.log(`  並列 5：${quarters.map((m) => m.loser).join('、')}`);
console.log(`  bracket ${bracket.length} 場（R1×4、R2×2、決賽×1）`);
console.log(`  collection.grand_finals → complete`);

if (dryRun) {
  console.log('\n--dry-run：未寫入檔案');
  process.exit(0);
}

await atomicWriteJson(dataPath, candidate, {
  validate: (value, file) => { assertSchema('season', value, file); },
});
console.log(`\n✓ 已寫入 ${dataPathArg}`);
