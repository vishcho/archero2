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
const ENCHANT_COLORS = ['紅', '黃'];

// 附魔詞條 → 顏色，用於檢查同一詞條在各選手間顏色一致
const enchantColorSeen = new Map();
const STATUS_VALUES = ['upcoming', 'in_progress', 'finished'];
const ROUNDS = ['R1', 'R2', '決賽'];
const SLOTS = ['A', 'B', 'C', 'D', 'upper', 'lower', 'final'];
const PREV_BEST = ['1強', '2強', '4強', '8強', '16強', '32強', '64強', '未入選'];
const FLAGS = ['⚠', '≈'];
const TIME_RE = /^\d{2}:\d{2}\.\d{1,2}$/;
const ID_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLLECTION_STATUS = ['pending', 'complete', 'missing'];

const errors = [];
const warnings = [];

// data/players.json 是選填的（尚未建立時所有賽季檔仍應可驗證），
// 有建立時才用來檢查賽季檔引用的 player_id 是否真的存在。
let knownPlayerIds = null;

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
  // player_id 由 top64 名片批次回填（見 notes/workflows/top64-profile-workflow.md），
  // 有值時必須是 data/players.json 裡登記過的 id——否則等於憑空多出一個帳號。
  if (p.player_id !== undefined) {
    if (!/^\d+$/.test(p.player_id)) {
      err(where, `player_id 應為數字字串，得到 ${JSON.stringify(p.player_id)}`);
    } else if (knownPlayerIds && !knownPlayerIds.has(p.player_id)) {
      err(where, `player_id ${p.player_id} 不存在於 data/players.json`);
    }
  }
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

  // theme（該屆流派主題）與 season（跨屆季主題，如「精靈季」）是兩個不同概念，
  // 都允許為 null——該屆沒有主題、或主題尚未公布。必填的是「欄位存在」而非「有值」，
  // 這樣「未公布」與「漏填」才能區分：漏掉欄位會報錯，明確寫 null 則合法。
  for (const key of ['theme', 'season']) {
    if (!(key in season)) err(at(), `${key} 欄位必須存在（無值請明確寫 null）`);
    else if (season[key] !== null && !isStr(season[key])) {
      err(at(), `${key} 應為非空字串或 null，得到 ${JSON.stringify(season[key])}`);
    }
  }

  if (!Number.isInteger(season.round) || season.round < 1) {
    err(at(), `round 應為正整數（屆次序號），得到 ${JSON.stringify(season.round)}`);
  }

  // 一屆 = 預選賽 4 天 + 其後淘汰賽 8 天，共 12 天跨兩個週期。
  // id 取淘汰賽首日作為識別碼，因此 id 必須等於 knockout_period[0]——
  // 這條檢查是「屆次定義」的守門員，避免 id 與期間再次漂移。
  for (const key of ['qualifier_period', 'knockout_period']) {
    const v = season[key];
    if (!Array.isArray(v) || v.length !== 2) {
      err(at(), `${key} 應為 [起日, 迄日] 兩元素陣列，得到 ${JSON.stringify(v)}`);
      continue;
    }
    if (!v.every((d) => ID_RE.test(d))) {
      err(at(), `${key} 的日期應為 YYYY-MM-DD，得到 ${JSON.stringify(v)}`);
      continue;
    }
    if (v[0] > v[1]) err(at(), `${key} 的起日晚於迄日：${v[0]} > ${v[1]}`);
  }

  if (Array.isArray(season.knockout_period) && season.knockout_period[0] !== season.id) {
    err(at(), `id (${season.id}) 應等於 knockout_period[0] (${season.knockout_period[0]})——id 取淘汰賽首日`);
  }

  // 預選賽必須早於淘汰賽，且兩段相鄰（預選賽迄日 < 淘汰賽起日）。
  if (Array.isArray(season.qualifier_period) && Array.isArray(season.knockout_period)
      && season.qualifier_period[1] >= season.knockout_period[0]) {
    err(at(), `qualifier_period 應早於 knockout_period：${season.qualifier_period[1]} >= ${season.knockout_period[0]}`);
  }

  if (!STATUS_VALUES.includes(season.status)) {
    err(at(), `status 只能是 ${STATUS_VALUES.join(' | ')}，得到 ${JSON.stringify(season.status)}`);
  }

  if (season.champion !== null && !isStr(season.champion)) {
    err(at(), 'champion 應為字串或 null');
  }

  if (season.collection !== undefined) {
    const expected = ['qualifier', 'knockout_matchup', 'knockout_results', 'grand_finals'];
    for (const key of expected) {
      if (!COLLECTION_STATUS.includes(season.collection?.[key])) {
        err(at(`collection.${key}`), `應為 ${COLLECTION_STATUS.join(' / ')}`);
      }
    }
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
    // upcoming（尚未開賽）時 groups 還沒產生，空陣列合法；一旦有資料就必須是完整 8 組。
    if (season.status === 'upcoming') {
      if (season.groups.length) err(at('groups'), `status 為 upcoming 但已有 ${season.groups.length} 組分組資料`);
    } else if (season.groups.length !== 8) {
      err(at('groups'), `應為 8 組，得到 ${season.groups.length}`);
    }

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

  // 總決賽：8 名分組冠軍、7 場單淘汰。晉級自洽由 domain validator 共用檢查。
  if (season.grand_finals !== null && season.grand_finals !== undefined) {
    const gf = season.grand_finals;
    if (!Array.isArray(gf.results)) {
      err(at('grand_finals'), 'results 應為陣列');
    } else {
      if (gf.results.length !== 8) err(at('grand_finals.results'), `應為 8 人，得到 ${gf.results.length}`);
      gf.results.forEach((result, i) => {
        if (!Number.isInteger(result.rank) || ![1, 2, 3, 5].includes(result.rank)) err(at(`grand_finals.results[${i}]`), 'rank 應為 1 / 2 / 3 / 5（同輪淘汰者並列）');
        if (!isStr(result.name)) err(at(`grand_finals.results[${i}]`), 'name 必填');
      });
    }
    if (!Array.isArray(gf.bracket)) {
      err(at('grand_finals'), 'bracket 應為陣列');
    } else {
      gf.bracket.forEach((match, i) => {
        const where = at(`grand_finals.bracket[${i}]`);
        if (!ROUNDS.includes(match.round)) err(where, `round 只能是 ${ROUNDS.join(' / ')}`);
        if (!SLOTS.includes(match.slot)) err(where, 'slot 不在允許值域');
        checkMatchSide(where, match.p1, 'p1');
        checkMatchSide(where, match.p2, 'p2');
        if (!isStr(match.winner)) err(where, 'winner 必填');
        if (!isStr(match.loser)) err(where, 'loser 必填');
      });
    }
  }

  // 跨欄位一致性
  const allGroupsDone = Array.isArray(season.groups) && season.groups.length > 0
    && season.groups.every((g) => isStr(g.champion));
  if (season.status === 'in_progress' && allGroupsDone) {
    warn(at(), '所有分組皆已產生冠軍，status 仍為 in_progress');
  }
  if (season.status === 'upcoming' && season.qualifier?.length) {
    warn(at(), `status 為 upcoming 但已有 ${season.qualifier.length} 筆資格賽資料，是否該改為 in_progress`);
  }
  if (season.status === 'finished' && !season.champion) warn(at(), 'status 為 finished 但 champion 為空（總決賽資料未收錄）');
  if (season.grand_finals && season.status !== 'finished') err(at(), '已有 grand_finals 時 status 必須為 finished');
  if (season.grand_finals && season.collection?.grand_finals !== undefined && season.collection.grand_finals !== 'complete') err(at('collection.grand_finals'), '已有 grand_finals 時必須為 complete');
}

// 超級明星盃：選手配置表，無賽制欄位
function validateRoster(file, season) {
  const at = (suffix) => `${file}${suffix ? ' ' + suffix : ''}`;

  if (!ID_RE.test(season.id ?? '')) err(at(), `id 應為 YYYY-MM-DD，得到 ${JSON.stringify(season.id)}`);
  if (season.id && path.basename(file, '.json') !== season.id) {
    err(at(), `id (${season.id}) 與檔名不符`);
  }
  if (!isStr(season.date)) err(at(), 'date 必填');
  // 超級明星盃的 theme 就是季主題（如「精靈季 1」），沿用 theme 欄位不另設 season——
  // 它一輪只有一個主題，沒有明星盃那種「屆主題 vs 跨屆季主題」的兩層結構。
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
    // 每格為 { text, color }，color 為附魔品階（紅 > 黃）。
    if (p.enchants !== undefined) {
      if (!Array.isArray(p.enchants)) {
        err(where, 'enchants 應為陣列');
      } else {
        p.enchants.forEach((e, j) => {
          if (e === null) return;
          if (typeof e !== 'object') {
            return err(where, `enchants[${j}] 應為 { text, color } 物件或 null`);
          }
          if (!isStr(e.text)) err(where, `enchants[${j}].text 必填且須為非空字串`);
          if (e.color !== null && !ENCHANT_COLORS.includes(e.color)) {
            err(where, `enchants[${j}].color 只能是 ${ENCHANT_COLORS.join(' / ')} 或 null，得到 ${JSON.stringify(e.color)}`);
          }
          // 同一詞條在各選手間顏色必須一致——顏色是詞條本身的屬性，不因人而異。
          if (isStr(e.text) && e.color) {
            const seen = enchantColorSeen.get(e.text);
            if (seen && seen.color !== e.color) {
              err(where, `附魔「${e.text}」顏色為 ${e.color}，但 ${seen.where} 記為 ${seen.color}`);
            } else if (!seen) {
              enchantColorSeen.set(e.text, { color: e.color, where });
            }
          }
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

try {
  const players = JSON.parse(await readFile(path.join(DATA_DIR, 'players.json'), 'utf8'));
  knownPlayerIds = new Set(Object.keys(players));
} catch {
  knownPlayerIds = null; // 尚未建立，跳過 player_id 存在性檢查
}

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
