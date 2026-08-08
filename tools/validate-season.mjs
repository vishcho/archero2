// 賽季 JSON 的結構驗證：欄位型別、值域、必填。
// 與 validate-tournament-results.mjs 分工：那支驗「淘汰賽邏輯自洽」，這支驗「結構正確」。
//
// 明星盃（schema=season）與超級明星盃（schema=roster）結構不同，
// 依 data/cups.json 登記的 schema 分派到不同檢查函式。
//
// 用法：
//   node tools/validate-season.mjs data/star-cup/2026-07-31.json
//   node tools/validate-season.mjs --all
//
// 刻意不引入 JSON Schema 套件——本 repo 無相依套件、無建置流程，
// 手寫檢查換來零安裝成本與更好的中文錯誤訊息。

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = 'data';
const TIERS = ['紅', '金', '金1', '金2', '金3', '未知'];
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

// 超級明星盃：選手配置表，無賽制欄位
function validateRoster(file, season) {
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
  if (season.notes !== undefined && !Array.isArray(season.notes)) err(at(), 'notes 應為字串陣列');

  if (!Array.isArray(season.roster)) return err(at(), 'roster 應為陣列');

  season.roster.forEach((p, i) => {
    const where = at(`roster[${i}]`);
    if (!isStr(p.name)) err(where, 'name 必填且須為非空字串');
    if (p.player_id !== undefined && !/^\d+$/.test(p.player_id)) {
      err(where, `player_id 應為數字字串，得到 ${JSON.stringify(p.player_id)}`);
    }
    // 品階留空 = 未取得資料；「未知」= 查過但介面未顯示。兩者語意不同，都合法。
    for (const key of ['spirit_awe', 'spirit_assist']) {
      const v = p[key];
      if (v !== undefined && !TIERS.includes(v)) {
        err(where, `${key} 不在允許值域（${TIERS.join(' / ')}），得到 ${JSON.stringify(v)}`);
      }
    }
    // enchants 的**索引即附魔槽位**，未取得的槽填 null 佔位，不可壓縮，
    // 否則後段詞條會位移到前面的槽，語意就變了。
    if (p.enchants !== undefined) {
      if (!Array.isArray(p.enchants)) {
        err(where, 'enchants 應為陣列');
      } else {
        p.enchants.forEach((e, j) => {
          if (e !== null && !isStr(e)) err(where, `enchants[${j}] 應為非空字串或 null`);
        });
        if (p.enchants.length && p.enchants.at(-1) === null) {
          err(where, 'enchants 尾端不應為 null（尾端空槽請直接省略）');
        }
      }
    }
  });

  const ids = season.roster.map((p) => p.player_id).filter(Boolean);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dupes.length) err(at('roster'), `player_id 重複：${[...new Set(dupes)].join('、')}`);
}

const VALIDATORS = { season: validateSeason, roster: validateRoster };

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('用法：node tools/validate-season.mjs <data/{cup}/{season}.json> | --all');
  process.exit(1);
}

const cups = JSON.parse(await readFile(path.join(DATA_DIR, 'cups.json'), 'utf8'));

// 檔案路徑 data/{cup}/{id}.json → 用中間那段查 cups.json 決定套哪組檢查
function cupOf(file) {
  const slug = path.basename(path.dirname(file));
  return cups.find((c) => c.slug === slug);
}

let files = [];
if (args[0] === '--all') {
  for (const cup of cups) {
    const dir = path.join(DATA_DIR, cup.slug);
    const entries = await readdir(dir);
    const cupFiles = entries
      .filter((f) => f.endsWith('.json') && f !== 'seasons.json')
      .map((f) => path.join(dir, f));
    files.push(...cupFiles);

    // 每個賽事各自的 seasons.json 與該目錄下的檔案必須互相對應
    const listedPath = path.join(dir, 'seasons.json');
    const listed = JSON.parse(await readFile(listedPath, 'utf8'));
    const onDisk = cupFiles.map((f) => path.basename(f, '.json'));
    for (const id of listed) {
      if (!onDisk.includes(id)) err(listedPath, `列出的 ${id} 沒有對應的 ${dir}/${id}.json`);
    }
    for (const id of onDisk) {
      if (!listed.includes(id)) err(listedPath, `${id}.json 存在但未列入 seasons.json`);
    }
    const sorted = [...listed].sort();
    if (listed.join() !== sorted.join()) err(listedPath, 'id 未依時間舊→新排序');
  }
} else {
  files = args;
}

for (const file of files) {
  const cup = cupOf(file);
  if (!cup) {
    err(file, `無法從路徑判斷所屬賽事——檔案應放在 data/{cup}/ 之下，且 cup 已登記於 data/cups.json`);
    continue;
  }
  const validate = VALIDATORS[cup.schema];
  if (!validate) {
    err(file, `cups.json 的 schema "${cup.schema}" 沒有對應的驗證函式`);
    continue;
  }

  let season;
  try {
    season = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    err(file, `JSON 解析失敗：${e.message}`);
    continue;
  }
  validate(file, season);
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
