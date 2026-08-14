// 依修正清單修改賽季檔的戰力欄位（截圖複核後的定點修正）。
//
//   node tools/apply-power-corrections.mjs <corrections.json> <data/star-cup/{season}.json> [--dry-run]
//
// 只改清單點名的欄位，其餘一字不動。每筆都必須先命中 `from` 舊值與 `player` 名稱，
// 任一不符即中止且不寫入——防止清單過期、組別看錯或改到別人的欄位。
import path from 'node:path';
import { assertSchema } from './lib/schema-validation.mjs';
import { validateTournamentResults } from './lib/domain.mjs';
import { atomicWriteJson, readJson } from './lib/json.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [correctionsArg, dataPathArg] = args.filter((a) => a !== '--dry-run');

if (!correctionsArg || !dataPathArg) {
  console.error('用法：node tools/apply-power-corrections.mjs <corrections.json> <data/star-cup/{season}.json> [--dry-run]');
  process.exit(1);
}

const correctionsPath = path.resolve(correctionsArg);
const dataPath = path.resolve(dataPathArg);
const plan = await readJson(correctionsPath);
const season = await readJson(dataPath);

const errors = [];
const applied = [];

const groupOf = (id) => season.groups.find((g) => String(g.id) === String(id));
const matchOf = (group, round, slot) =>
  (group.matches ?? []).find((m) => m.round === round && m.slot === slot);

// ---- 戰力欄位 ----
for (const [i, c] of (plan.corrections ?? []).entries()) {
  const at = `corrections[${i}] G${c.group} ${c.kind}`;
  const group = groupOf(c.group);
  if (!group) { errors.push(`${at}：找不到組別 ${c.group}`); continue; }

  if (c.kind === 'match') {
    const match = matchOf(group, c.round, c.slot);
    if (!match) { errors.push(`${at}：找不到場次 ${c.round}/${c.slot}`); continue; }
    const side = match[c.side];
    if (!side) { errors.push(`${at}：場次無 ${c.side} 欄位`); continue; }
    if (side.name !== c.player) {
      errors.push(`${at} ${c.round}/${c.slot} ${c.side}：選手不符，清單=${c.player} 實際=${side.name}`);
      continue;
    }
    if (side.power !== c.from) {
      errors.push(`${at} ${c.round}/${c.slot} ${c.side} ${c.player}：舊值不符，清單=${c.from} 實際=${side.power}`);
      continue;
    }
    side.power = c.to;
    applied.push(`G${c.group} ${c.round}/${c.slot} ${c.side} ${c.player}: ${c.from} → ${c.to}`);
    continue;
  }

  if (c.kind === 'champion_power' || c.kind === 'champion_current_power') {
    // 冠軍名稱也要對得上，避免組別看錯時改到別組冠軍。
    if (group.champion !== c.player) {
      errors.push(`${at}：冠軍不符，清單=${c.player} 實際=${group.champion}`);
      continue;
    }
    if (group[c.kind] !== c.from) {
      errors.push(`${at} ${c.player}：舊值不符，清單=${c.from} 實際=${group[c.kind]}`);
      continue;
    }
    group[c.kind] = c.to;
    applied.push(`G${c.group} ${c.kind} ${c.player}: ${c.from} → ${c.to}`);
    continue;
  }

  errors.push(`${at}：未知的 kind「${c.kind}」`);
}

// ---- notes 內含舊數字的同步修正 ----
for (const [i, n] of (plan.note_corrections ?? []).entries()) {
  const at = `note_corrections[${i}] G${n.group} ${n.round}/${n.slot}`;
  const group = groupOf(n.group);
  if (!group) { errors.push(`${at}：找不到組別 ${n.group}`); continue; }
  const match = matchOf(group, n.round, n.slot);
  if (!match) { errors.push(`${at}：找不到場次`); continue; }
  const idx = (match.notes ?? []).indexOf(n.from);
  if (idx === -1) {
    errors.push(`${at}：找不到原註記文字\n    清單=${n.from}\n    實際=${JSON.stringify(match.notes ?? [])}`);
    continue;
  }
  match.notes[idx] = n.to;
  applied.push(`G${n.group} ${n.round}/${n.slot} notes[${idx}] 已同步數字`);
}

if (errors.length) {
  console.error(`修正清單與 ${path.basename(dataPath)} 不一致，已中止，未寫入：\n`);
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  console.error(`\n${errors.length} 筆不符。請確認清單是否過期，或修正是否已套用過。`);
  process.exit(1);
}

const expected = (plan.corrections ?? []).length + (plan.note_corrections ?? []).length;
if (applied.length !== expected) {
  console.error(`內部不一致：預期 ${expected} 筆、實際套用 ${applied.length} 筆，已中止。`);
  process.exit(1);
}

console.log(`修正清單：${correctionsPath}`);
console.log(`目標檔案：${dataPath}\n`);
console.log(`逐欄變更（${applied.length} 筆）：`);
applied.forEach((a) => console.log(`  • ${a}`));

// 寫入前驗證完整候選資料。
assertSchema('season', season, dataPath);
const domainErrors = validateTournamentResults(season, dataPath);
if (domainErrors.length) {
  console.error('\n領域驗證失敗，未寫入：');
  domainErrors.forEach((e) => console.error(`  ✗ ${e.file}${e.location}: ${e.message}`));
  process.exit(1);
}
console.log('\nschema 與淘汰賽邏輯驗證通過。');

if (dryRun) {
  console.log('--dry-run：未寫入正式檔案。');
} else {
  await atomicWriteJson(dataPath, season);
  console.log(`已原子寫入 ${dataPath}`);
}
