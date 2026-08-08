// 賽季 JSON 的結構驗證：欄位型別、值域、必填。
// 與 validate-tournament-results.mjs 分工：那支驗「淘汰賽邏輯自洽」，這支驗「結構正確」。
//
// 用法：
//   node tools/validate-season.mjs data/2026-07-31.json
//   node tools/validate-season.mjs --all
//
// 刻意不引入 JSON Schema 套件——本 repo 無相依套件、無建置流程，
// 手寫檢查換來零安裝成本與更好的中文錯誤訊息。

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = 'data';
const STATUS_VALUES = ['in_progress', 'finished'];
const ROUNDS = ['R1', 'R2', '決賽'];
const SLOTS = ['A', 'B', 'C', 'D', 'upper', 'lower', 'final'];
const PREV_BEST = ['1強', '2強', '4強', '8強', '16強', '32強', '64強', '未入選'];
const FLAGS = ['⚠', '≈'];
const TIME_RE = /^\d{2}:\d{2}\.\d{1,2}$/;
const ID_RE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const warnings = [];

function err(where, message) {
  errors.push(`${where}: ${message}`);
}

function warn(where, message) {
  warnings.push(`${where}: ${message}`);
}

function isStr(v) {
  return typeof v === 'string' && v.length > 0;
}

function checkPlayer(where, p) {
  if (!isStr(p?.name)) return err(where, 'name 必填且須為非空字串');
  if (p.flag !== undefined && !FLAGS.includes(p.flag)) {
    err(where, `flag 只能是 ${FLAGS.join(' / ')}，得到 ${JSON.stringify(p.flag)}`);
  }
  if (p.prev_best !== undefined && !PREV_BEST.includes(p.prev_best)) {
    err(where, `prev_best 不在允許值域，得到 ${JSON.stringify(p.prev_best)}`);
  }
  for (const key of ['qualifier_time', 'prev_time']) {
    const v = p[key];
    if (v !== undefined && v !== '未通關' && !TIME_RE.test(v)) {
      err(where, `${key} 格式應為 MM:SS.mm 或「未通關」，得到 ${JSON.stringify(v)}`);
    }
  }
  if (p.qualifier_rank !== undefined && !Number.isInteger(p.qualifier_rank)) {
    err(where, `qualifier_rank 應為整數，得到 ${JSON.stringify(p.qualifier_rank)}`);
  }
}

function checkMatchSide(where, side, label) {
  if (!isStr(side?.name)) return err(where, `${label}.name 必填`);
  if (side.progress !== undefined && !Number.isInteger(side.progress)) {
    err(where, `${label}.progress 應為整數，得到 ${JSON.stringify(side.progress)}`);
  }
  if (side.time !== undefined && !TIME_RE.test(side.time)) {
    err(where, `${label}.time 格式應為 MM:SS.mm，得到 ${JSON.stringify(side.time)}`);
  }
}

function validateSeason(file, season) {
  const at = (suffix) => `${file}${suffix ? ' ' + suffix : ''}`;

  if (!ID_RE.test(season.id ?? '')) err(at(), `id 應為 YYYY-MM-DD，得到 ${JSON.stringify(season.id)}`);
  if (season.id && path.basename(file, '.json') !== season.id) {
    err(at(), `id (${season.id}) 與檔名不符`);
  }
  if (!isStr(season.date)) err(at(), 'date 必填');
  if (!isStr(season.theme)) err(at(), 'theme 必填');

  if (!STATUS_VALUES.includes(season.status)) {
    err(at(), `status 只能是 ${STATUS_VALUES.join(' | ')}，得到 ${JSON.stringify(season.status)}`);
  }

  if (season.champion !== null && !isStr(season.champion)) {
    err(at(), 'champion 應為字串或 null');
  }

  // 資格賽
  if (!Array.isArray(season.qualifier)) {
    err(at(), 'qualifier 應為陣列');
  } else {
    season.qualifier.forEach((q, i) => {
      const where = at(`qualifier[${i}]`);
      if (!Number.isInteger(q.rank)) err(where, 'rank 應為整數');
      if (!isStr(q.name)) err(where, 'name 必填');
      if (q.time !== undefined && !/^\d{2}:\d{2}\.\d{1,2}$/.test(q.time)) {
        err(where, `time 格式應為 MM:SS.m，得到 ${JSON.stringify(q.time)}`);
      }
    });
    const ranks = season.qualifier.map((q) => q.rank);
    const sorted = [...ranks].sort((a, b) => a - b);
    if (ranks.join() !== sorted.join()) err(at('qualifier'), 'rank 未依序遞增');
  }

  // 淘汰賽分組
  if (!Array.isArray(season.groups)) {
    err(at(), 'groups 應為陣列');
  } else {
    if (season.groups.length !== 8) err(at('groups'), `應為 8 組，得到 ${season.groups.length}`);

    for (const group of season.groups) {
      const where = at(`group ${group.id}`);

      if (!Array.isArray(group.players)) {
        err(where, 'players 應為陣列');
      } else {
        if (group.players.length !== 8) err(where, `players 應為 8 人，得到 ${group.players.length}`);
        group.players.forEach((p, i) => checkPlayer(at(`group ${group.id} players[${i}]`), p));

        const names = group.players.map((p) => p.name);
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        if (dupes.length) warn(where, `players 有重複名稱（可能為同名玩家）：${[...new Set(dupes)].join('、')}`);
      }

      if (!Array.isArray(group.matches)) continue;
      group.matches.forEach((m, i) => {
        const mw = at(`group ${group.id} matches[${i}]`);
        if (!ROUNDS.includes(m.round)) err(mw, `round 只能是 ${ROUNDS.join(' / ')}，得到 ${JSON.stringify(m.round)}`);
        if (!SLOTS.includes(m.slot)) err(mw, `slot 不在允許值域，得到 ${JSON.stringify(m.slot)}`);
        checkMatchSide(mw, m.p1, 'p1');
        checkMatchSide(mw, m.p2, 'p2');
        if (!isStr(m.winner)) err(mw, 'winner 必填');
        if (!isStr(m.loser)) err(mw, 'loser 必填');
        if (m.notes !== undefined && !Array.isArray(m.notes)) err(mw, 'notes 應為字串陣列');
      });
    }
  }

  // 總決賽：目前資料管線尚未涵蓋，只驗型別，不要求填值
  if (season.grand_finals !== null && season.grand_finals !== undefined) {
    const gf = season.grand_finals;
    if (!Array.isArray(gf.results)) err(at('grand_finals'), 'results 應為陣列');
    if (!Array.isArray(gf.bracket)) err(at('grand_finals'), 'bracket 應為陣列');
  }

  // 跨欄位一致性
  const allGroupsDone = Array.isArray(season.groups) && season.groups.length > 0
    && season.groups.every((g) => isStr(g.champion));
  if (season.status === 'in_progress' && allGroupsDone) {
    warn(at(), '所有分組皆已產生冠軍，status 仍為 in_progress');
  }
  if (season.status === 'finished' && !season.champion) {
    warn(at(), 'status 為 finished 但 champion 為空（總決賽尚未納入資料管線）');
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('用法：node tools/validate-season.mjs <data/{season}.json> | --all');
  process.exit(1);
}

let files;
if (args[0] === '--all') {
  const entries = await readdir(DATA_DIR);
  files = entries
    .filter((f) => f.endsWith('.json') && f !== 'seasons.json')
    .map((f) => path.join(DATA_DIR, f));
} else {
  files = args;
}

// seasons.json 與各屆檔案必須互相對應
if (args[0] === '--all') {
  const listed = JSON.parse(await readFile(path.join(DATA_DIR, 'seasons.json'), 'utf8'));
  const onDisk = files.map((f) => path.basename(f, '.json'));
  for (const id of listed) {
    if (!onDisk.includes(id)) err('seasons.json', `列出的 ${id} 沒有對應的 ${DATA_DIR}/${id}.json`);
  }
  for (const id of onDisk) {
    if (!listed.includes(id)) err('seasons.json', `${id}.json 存在但未列入 seasons.json`);
  }
  const sorted = [...listed].sort();
  if (listed.join() !== sorted.join()) err('seasons.json', 'id 未依時間舊→新排序');
}

for (const file of files) {
  let season;
  try {
    season = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    err(file, `JSON 解析失敗：${e.message}`);
    continue;
  }
  validateSeason(file, season);
}

if (warnings.length) {
  console.warn('警告：');
  console.warn(warnings.map((w) => `  ${w}`).join('\n'));
}

if (errors.length) {
  console.error('錯誤：');
  console.error(errors.map((e) => `  ${e}`).join('\n'));
  process.exit(1);
}

console.log(`${files.length} 個賽季檔案結構驗證通過`);
