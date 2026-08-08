// 用 data/players.json 的 player_id 回填賽季檔的同名懸案（工作流 §4）。
//
//   node tools/backfill-from-players.mjs data/star-cup/2026-07-31.json --dry-run
//   node tools/backfill-from-players.mjs data/star-cup/2026-07-31.json
//
// 只處理**能被 ID 證明**的事：
//   1. 對陣表中 flag:"⚠"（同名多筆）的選手，若名片能唯一決定其資格賽名次 → 補 qualifier_rank /
//      qualifier_time、移除 flag、寫入 note 說明依據。
//   2. 名片與對陣表名稱不同但同 ID（改名）→ 記入 note，名稱本身不動（對陣表以賽時截圖為準）。
//
// 戰力配對只用 groups[].matches，不用 groups[].players：
//   - matches[].power 與名片同為平時戰力（2026-07-31 實測 80 筆中 67 筆完全相同，
//     其餘 13 筆為兩批截圖相隔數日間的正常成長）。
//   - players[].power 是賽前對陣表的賽時戰力，含賽事增益，系統性高於名片
//     （同批實測 47 位中 44 位名片較低），拿來配對會錯。
// 因此同名者的身分由「該格選手在 matches 中的戰力」決定，再由戰力對到名片的 ID。

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('用法：node tools/backfill-from-players.mjs <data/{cup}/{season}.json> [--dry-run]');
  process.exit(1);
}

const seasonId = path.basename(file, '.json');
const season = JSON.parse(await readFile(file, 'utf8'));
const players = JSON.parse(await readFile(path.join('data', 'players.json'), 'utf8'));

// 該屆有名片紀錄的選手：名稱 → [{id, entry}]
const cardsByName = new Map();
for (const p of Object.values(players)) {
  const entry = p.seasons?.[seasonId];
  if (!entry) continue;
  for (const n of p.names) {
    if (!cardsByName.has(n)) cardsByName.set(n, []);
    cardsByName.get(n).push({ id: p.player_id, entry, names: p.names });
  }
}

const qualifier = season.qualifier ?? [];
const changes = [];
const skipped = [];

for (const group of season.groups ?? []) {
  for (const pl of group.players) {
    if (pl.flag !== '⚠') continue;

    const cards = cardsByName.get(pl.name) ?? [];
    const sameName = (season.groups ?? []).flatMap((g) =>
      g.players.filter((x) => x.name === pl.name).map((x) => ({ group: g.id, player: x })));

    // 對陣表有 N 位同名，名片也要有 N 位同名，才可能一一對應。
    // 少於 N 位表示有人沒被拍到，無法判斷手上這張是哪一位——不猜。
    if (cards.length < sameName.length) {
      skipped.push(`第${group.id}組 ${pl.name}：對陣表 ${sameName.length} 位同名，但名片只有 ${cards.length} 位（缺人未拍），無法唯一對應`);
      continue;
    }

    // 用稱號在資格賽榜上唯一定位每張名片
    const qHits = qualifier.filter((q) => q.name === pl.name);
    const resolved = cards.map((c) => ({
      card: c,
      q: qHits.filter((q) => q.title && q.title === c.entry.title),
    }));
    if (resolved.some((r) => r.q.length !== 1)) {
      skipped.push(`第${group.id}組 ${pl.name}：無法用稱號在資格賽榜上唯一定位每張名片`);
      continue;
    }

    // 這一格是哪一位？
    //
    // 注意：不能用 players[] 的索引推 R1 場次。索引順序來自賽前對陣截圖，
    // 實際籤表可能與之不同（2026-07-31 第1組實測：對陣表 A 格為牛大力×牛大刃，
    // 實際 R1-A 卻是牛大力×LD丨도하）。
    //
    // 改為：收集本組 R1 中所有同名者的戰力，逐一對到名片。
    // 每個戰力值只能對到一張名片、每張名片只能被一個戰力值認領，
    // 兩邊數量相同且一一對應時，這一組同名才算完全解開；
    // 但「哪一格是哪一位」仍需 players[] 端有可辨識依據——
    // 此處以「同組同名者在 players[] 中的出現序」對上「R1 中的出現序」，
    // 僅在雙方數量相同且戰力能一一對應時採用，否則不猜。
    const r1Sides = (group.matches ?? [])
      .filter((m) => m.round === 'R1')
      .flatMap((m) => [m.p1, m.p2])
      .filter((s) => s.name === pl.name && s.power);
    const inGroup = group.players.filter((x) => x.name === pl.name);

    if (r1Sides.length !== inGroup.length) {
      skipped.push(`第${group.id}組 ${pl.name}：players[] 有 ${inGroup.length} 位、R1 賽果有 ${r1Sides.length} 位，數量不符`);
      continue;
    }
    const cardFor = r1Sides.map((s) => resolved.find((r) => r.card.entry.power === s.power));
    if (cardFor.some((c) => !c) || new Set(cardFor.map((c) => c.card.id)).size !== cardFor.length) {
      skipped.push(`第${group.id}組 ${pl.name}：R1 戰力 ${r1Sides.map((s) => s.power).join('/')} 無法與名片 ${resolved.map((r) => r.card.entry.power).join('/')} 一一對應`);
      continue;
    }
    // 依賽時戰力排序把 players[] 的格子對到 R1 的選手：兩邊都是同一批人，
    // 賽時戰力與平時戰力雖不等值，但同一組內的**大小順序**一致（實測成立）。
    const orderP = [...inGroup].sort((a, b) => parseFloat(b.power) - parseFloat(a.power));
    const orderR = [...r1Sides].sort((a, b) => parseFloat(b.power) - parseFloat(a.power));
    const myRank = orderP.indexOf(pl);
    const side = orderR[myRank];
    const hit = resolved.find((r) => r.card.entry.power === side.power);
    if (!hit) {
      skipped.push(`第${group.id}組 ${pl.name}：戰力 ${side.power} 對不到名片`);
      continue;
    }

    changes.push({
      desc: `第${group.id}組 ${pl.name}（賽時 ${pl.power}）→ id ${hit.card.id}、資格賽第 ${hit.q[0].rank} 名 ${hit.q[0].time}`
        + `（依賽果戰力 ${side.power} 對到名片、稱號「${hit.card.entry.title}」）`,
      apply() {
        pl.player_id = hit.card.id;
        pl.qualifier_rank = hit.q[0].rank;
        pl.qualifier_time = hit.q[0].time;
        delete pl.flag;
        pl.note = `經 2026-08-09 top64 名片（用戶ID ${hit.card.id}）確認：本格為資格賽第 ${hit.q[0].rank} 名、稱號「${hit.card.entry.title}」者，依 R1 賽果戰力 ${side.power} 區分同名。`;
      },

    });
  }
}

// 改名偵測：名片有多個歷史名，其中之一出現在對陣表
const renames = [];
for (const p of Object.values(players)) {
  if (!p.seasons?.[seasonId] || p.names.length < 2) continue;
  const inBracket = (season.groups ?? []).flatMap((g) =>
    g.players.filter((x) => p.names.includes(x.name)).map((x) => ({ group: g.id, name: x.name })));
  if (inBracket.length) {
    renames.push(`${p.player_id}：${p.names.join(' → ')}（對陣表第${inBracket[0].group}組作「${inBracket[0].name}」）`);
  }
}

console.log(`# 以 player_id 回填 ${file}\n`);
if (changes.length) {
  console.log(`## 可回填 ${changes.length} 筆`);
  for (const c of changes) console.log(`  - ${c.desc}`);
} else {
  console.log(`## 可回填 0 筆`);
}
if (renames.length) {
  console.log(`\n## 偵測到改名 ${renames.length} 筆`);
  for (const r of renames) console.log(`  - ${r}`);
}
if (skipped.length) {
  console.log(`\n## 未回填 ${skipped.length} 筆（依工作流「不得推測填值」）`);
  for (const s of skipped) console.log(`  - ${s}`);
}

if (dryRun) {
  console.log(`\n--dry-run：未寫入。`);
  process.exit(0);
}
if (!changes.length) {
  console.log(`\n沒有可自動回填的項目，未寫入 ${file}。`);
  process.exit(0);
}
for (const c of changes) c.apply();
await writeFile(file, JSON.stringify(season, null, 2) + '\n');
console.log(`\n已寫入 ${file}（${changes.length} 筆）。請重跑 validate-season.mjs 與 validate-tournament-results.mjs。`);
