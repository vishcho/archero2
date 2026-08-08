// 把 top64 名片截圖的抽取結果併入 data/players.json（跨賽事選手登記簿）。
//
// 用法：
//   node tools/import-top64-profiles.mjs tmp/top64-extract.json --check      # 只跑 §2b 檢查點
//   node tools/import-top64-profiles.mjs tmp/top64-extract.json --cup star-cup
//
// 對應 notes/workflows/top64-profile-workflow.md 的 §2b（檢查點）與 §3（併入）。
// --check 只做檢查不寫檔，供「先確認抽取品質再入庫」使用。

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = 'data';
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const CUMULATIVE = ['normal', 'hard', 'tower', 'charm', 'emblem'];
const CARD_FIELDS = ['player_id', 'name', 'guild', 'power', 'title', ...CUMULATIVE];

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
// 這批確定拍不齊（有人被重複點開、缺的人已無法回頭補拍）時的明示放行。
// 不是「關掉檢查」——重複的張數仍會列出、缺誰仍會列出，只是允許以不足 64 位入庫，
// 並在 players.json 之外由 docs/sources.md 記錄這批的涵蓋範圍。
const allowPartial = args.includes('--allow-partial');
const cupSlug = args.includes('--cup') ? args[args.indexOf('--cup') + 1] : 'star-cup';
const input = args.find((a) => !a.startsWith('--') && a !== cupSlug);

if (!input) {
  console.error('用法：node tools/import-top64-profiles.mjs <tmp/top64-extract.json> [--cup star-cup] [--check] [--allow-partial]');
  process.exit(1);
}

const extract = JSON.parse(await readFile(input, 'utf8'));
const { season: seasonId, players: cards } = extract;
if (!seasonId || !Array.isArray(cards)) {
  console.error(`${input}: 應包含 season 與 players[]`);
  process.exit(1);
}

const seasonFile = path.join(DATA_DIR, cupSlug, `${seasonId}.json`);
const season = JSON.parse(await readFile(seasonFile, 'utf8'));

// ── §2b 抽取完整性檢查點 ────────────────────────────────────────────
const missing = [];   // 致命：沒有 ID 就無法入庫
const dupes = [];     // 重複拍攝：可用 --allow-partial 放行（代價是涵蓋不到 64 位）
const unsure = [];    // 讀不確定：需人工確認

if (cards.length !== 64) {
  missing.push(`張數 ${cards.length}，應為 64`);
}

const byId = new Map();
for (const c of cards) {
  const at = c.source ?? '(無 source)';
  if (!c.player_id || !/^\d+$/.test(c.player_id)) {
    missing.push(`${at}: player_id 缺失或非數字字串——沒有 ID 這批就失去意義，必須重拍`);
    continue;
  }
  if (byId.has(c.player_id)) {
    dupes.push(`${at}: player_id ${c.player_id}（${c.name}）與 ${byId.get(c.player_id).source} 重複——同一人被拍兩次，等量的人被漏拍`);
  } else {
    byId.set(c.player_id, c);
  }
  for (const f of CARD_FIELDS) {
    if (c[f] === undefined || c[f] === null) unsure.push(`${at}: ${f} 未讀出`);
  }
  if (c.note) unsure.push(`${at}: ${c.note}`);
}

// 與資格賽榜交叉比對：名片名稱應能對到 qualifier[]
//
// rank 批次是捲動截圖的 OCR，對韓文與特殊字形（ᴬᴷ 上標、丨 vs |、ꕥ）失真率高；
// 名片是單張放大畫面，可信度遠高於排行榜。因此比對時允許抽取檔提供
// aliases：{ 榜上名稱: 名片名稱 }，把已人工確認的字形差異對起來。
// 這只是「同一個人的兩種寫法」，不是猜測——每筆都要能在截圖上看出來。
const aliases = extract.aliases ?? {};
const qualifier = (season.qualifier ?? []).map((q) => ({
  ...q,
  matchName: aliases[q.name] ?? q.name,
  aliased: q.name in aliases,
}));
const qByName = new Map();
for (const q of qualifier) {
  if (!qByName.has(q.matchName)) qByName.set(q.matchName, []);
  qByName.get(q.matchName).push(q);
}

const unmatched = [];
const ambiguous = [];
for (const c of byId.values()) {
  const hits = qByName.get(c.name) ?? [];
  if (hits.length === 0) unmatched.push(c);
  else if (hits.length > 1) ambiguous.push({ card: c, hits });
}

console.log(`# top64 抽取檢查點（${input}）\n`);
console.log(missing.length === 0 && dupes.length === 0 && unsure.length === 0
  ? `[OK]      ${cards.length}/64 張、player_id 全數唯一、欄位齊全`
  : `[  ]      ${cards.length}/64 張，${byId.size} 個唯一 player_id`);
if (missing.length) console.log(`[MISSING] ${missing.length} 項：\n${missing.map((m) => `  - ${m}`).join('\n')}`);
if (dupes.length) console.log(`[DUPE]    ${dupes.length} 項：\n${dupes.map((m) => `  - ${m}`).join('\n')}`);
if (unsure.length) console.log(`[UNSURE]  ${unsure.length} 項：\n${unsure.map((m) => `  - ${m}`).join('\n')}`);

console.log(`\n## 與資格賽榜交叉比對（${qualifier.length} 筆）`);
console.log(`  對到單一筆：${byId.size - unmatched.length - ambiguous.length}`);
if (ambiguous.length) {
  console.log(`  同名多筆（正是本批要解決的）：${ambiguous.length}`);
  for (const { card, hits } of ambiguous) {
    console.log(`    - ${card.name}（id ${card.player_id}，稱號「${card.title}」）↔ 榜上第 ${hits.map((h) => h.rank).join('、')} 名`);
    for (const h of hits) {
      const same = h.title && card.title && h.title === card.title;
      console.log(`        第 ${h.rank} 名 稱號「${h.title ?? '—'}」 ${same ? '← 稱號相符' : ''}`);
    }
  }
}
if (unmatched.length) {
  console.log(`  名片對不到資格賽榜：${unmatched.length}`);
  for (const c of unmatched) console.log(`    - ${c.name}（id ${c.player_id}，稱號「${c.title}」）`);
}

// 反向：榜上前 64 名有誰沒被拍到——這是補拍清單，比「名片對不到榜」更可操作
const shotNames = new Set([...byId.values()].map((c) => c.name));
const notShot = qualifier.filter((q) => q.rank <= 64 && !shotNames.has(q.matchName));
if (notShot.length) {
  console.log(`\n## 榜上前 64 名未拍到（補拍清單）：${notShot.length} 位`);
  for (const q of notShot) {
    console.log(`    - 第 ${String(q.rank).padStart(2)} 名 ${q.name}　稱號「${q.title ?? '—'}」　${q.time ?? ''}`);
  }
}

const blocked = [];
if (missing.length) blocked.push('[MISSING]');
if (dupes.length && !allowPartial) blocked.push('[DUPE]');
if (unsure.length && !allowPartial) blocked.push('[UNSURE]');

if (checkOnly) {
  console.log(`\n--check 模式：未寫入任何檔案。`);
  process.exit(blocked.length ? 1 : 0);
}
if (blocked.length) {
  console.error(`\n${blocked.join(' ')} 非空，依工作流 §2b 中止，不寫入 data/。`);
  if (missing.length) console.error(`（[MISSING] 無法以 --allow-partial 放行：沒有 player_id 就無法入庫。）`);
  else console.error(`（這批確定補拍不到時，可用 --allow-partial 明示以 ${byId.size} 位入庫。）`);
  process.exit(1);
}
if (allowPartial && byId.size < 64) {
  console.log(`\n⚠ --allow-partial：以 ${byId.size}/64 位入庫，未涵蓋者見上方補拍清單。`);
}

// ── §3 併入選手檔案庫 ──────────────────────────────────────────────
const players = existsSync(PLAYERS_FILE)
  ? JSON.parse(await readFile(PLAYERS_FILE, 'utf8'))
  : {};

// 同名唯一者可安全帶入資格賽名次；同名多筆留給人工用稱號裁決（見上方輸出）。
function rankFor(card) {
  const hits = qByName.get(card.name) ?? [];
  if (hits.length === 1) return hits[0].rank;
  const byTitle = hits.filter((h) => h.title && card.title && h.title === card.title);
  return byTitle.length === 1 ? byTitle[0].rank : null;
}

const renamed = [];
const created = [];
for (const c of byId.values()) {
  const existing = players[c.player_id];
  const entry = {
    power: c.power,
    title: c.title,
    qualifier_rank: rankFor(c),
    normal: c.normal, hard: c.hard, tower: c.tower, charm: c.charm, emblem: c.emblem,
    captured: extract.captured,
    source: c.source,
  };

  if (!existing) {
    players[c.player_id] = {
      player_id: c.player_id,
      names: [c.name],
      guild: c.guild ?? null,
      seasons: { [seasonId]: entry },
    };
    created.push(c);
    continue;
  }
  if (!existing.names.includes(c.name)) {
    existing.names.push(c.name); // 改名：保留歷史名，不刪舊名
    renamed.push({ id: c.player_id, from: existing.names[0], to: c.name });
  }
  existing.guild = c.guild ?? null; // 公會取最新
  existing.seasons[seasonId] = entry;
}

// 依 player_id 排序輸出，讓 diff 穩定
const sorted = Object.fromEntries(Object.keys(players).sort().map((k) => [k, players[k]]));
await writeFile(PLAYERS_FILE, JSON.stringify(sorted, null, 2) + '\n');

console.log(`\n## 併入 ${PLAYERS_FILE}`);
console.log(`  新建 ${created.length} 位、更新 ${byId.size - created.length} 位，共 ${Object.keys(sorted).length} 位在案`);
if (renamed.length) {
  console.log(`  偵測到改名 ${renamed.length} 筆：`);
  for (const r of renamed) console.log(`    - ${r.id}: ${r.from} → ${r.to}`);
}
const noRank = [...byId.values()].filter((c) => rankFor(c) === null);
if (noRank.length) {
  console.log(`  ${noRank.length} 位未帶入 qualifier_rank（同名無法自動裁決）：${noRank.map((c) => c.name).join('、')}`);
}
