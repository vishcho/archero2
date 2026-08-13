// 選手檔案庫的結構驗證。
//
// data/players.json 是**跨賽事**的選手登記簿，以遊戲內用戶ID（player_id）為主鍵。
// 名稱會改、戰力每屆變，只有 player_id 永久不變——這是把同一個人在不同屆、
// 不同賽事間綁起來的唯一可靠依據。
//
// 用法：
//   node tools/validate-players.mjs                       # 預設驗 data/players.json
//   node tools/validate-players.mjs data/players.json
//
// 本檔負責 JSON Schema 表達不了的規則：物件 key 必須等於該筆的 player_id、
// seasons[] 的每個屆次都要有對應的 data/{cup}/{id}.json、累積型欄位跨屆不得倒退、
// ocr_variants 不得與 names 重疊、顯示名稱重複偵測（warning）。
//
// 欄位型別由 schemas/players.schema.json（ajv）驗，入口是 validate-contracts.mjs。
// 與 validate-season.mjs 同樣有部分手寫檢查與 schema 重疊，屬未整併的歷史遺留。

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = 'data';
const ID_RE = /^\d+$/;
const SEASON_ID_RE = /^\d{4}-\d{2}-\d{2}$/;
const POWER_RE = /^\d+(\.\d+)?[MK]$/;

// 只增不減的累積型欄位：關卡進度、通天塔層數、魅力值、徽記都不會倒退。
// 倒退幾乎一定是 OCR 讀錯，所以跨屆比較時報錯而非放行。
const CUMULATIVE = ['normal', 'hard', 'tower', 'charm', 'emblem'];

const errors = [];
const warnings = [];

const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const isStr = (v) => typeof v === 'string' && v.length > 0;

async function knownSeasonIds() {
  const cups = JSON.parse(await readFile(path.join(DATA_DIR, 'cups.json'), 'utf8'));
  const ids = new Map(); // season id → [cup slug]
  for (const cup of cups) {
    const dir = path.join(DATA_DIR, cup.slug);
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.json') || f === 'seasons.json') continue;
      const id = path.basename(f, '.json');
      if (!ids.has(id)) ids.set(id, []);
      ids.get(id).push(cup.slug);
    }
  }
  return ids;
}

function checkSeasonEntry(where, entry) {
  if (entry.power !== undefined && entry.power !== null && !POWER_RE.test(entry.power)) {
    err(where, `power 格式應為 12.34M，得到 ${JSON.stringify(entry.power)}`);
  }
  if (entry.title !== undefined && entry.title !== null && !isStr(entry.title)) {
    err(where, 'title 應為非空字串或 null');
  }
  if (entry.qualifier_rank !== undefined && entry.qualifier_rank !== null
      && !Number.isInteger(entry.qualifier_rank)) {
    err(where, `qualifier_rank 應為整數或 null，得到 ${JSON.stringify(entry.qualifier_rank)}`);
  }
  for (const key of CUMULATIVE) {
    const v = entry[key];
    if (v === undefined || v === null) continue;
    if (!Number.isInteger(v) || v < 0) err(where, `${key} 應為非負整數，得到 ${JSON.stringify(v)}`);
  }
  if (entry.captured !== undefined && !SEASON_ID_RE.test(entry.captured)) {
    err(where, `captured 應為 YYYY-MM-DD，得到 ${JSON.stringify(entry.captured)}`);
  }
  if (entry.source !== undefined && !isStr(entry.source)) {
    err(where, 'source 應為非空字串（截圖檔名）');
  }
}

async function main() {
  const file = process.argv[2] ?? path.join(DATA_DIR, 'players.json');

  let players;
  try {
    players = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    console.error(`錯誤：\n  ${file}: 讀取或解析失敗——${e.message}`);
    process.exit(1);
  }

  if (typeof players !== 'object' || players === null || Array.isArray(players)) {
    console.error(`錯誤：\n  ${file}: 頂層應為以 player_id 為 key 的物件`);
    process.exit(1);
  }

  const seasonIds = await knownSeasonIds();
  const nameIndex = new Map(); // 顯示名稱 → [player_id]，用於偵測同名

  for (const [key, p] of Object.entries(players)) {
    const where = `${file} ${key}`;

    if (!ID_RE.test(key)) err(where, 'key 應為純數字的 player_id');
    if (p.player_id !== key) {
      err(where, `player_id (${JSON.stringify(p.player_id)}) 與 key 不符`);
    }

    // names[] 保留歷史名，索引 0 為最早見到的名稱，最後一個為最新。
    if (!Array.isArray(p.names) || p.names.length === 0) {
      err(where, 'names 應為非空陣列（保留歷史顯示名）');
    } else {
      p.names.forEach((n, i) => {
        if (!isStr(n)) err(where, `names[${i}] 應為非空字串`);
      });
      const dupes = p.names.filter((n, i) => p.names.indexOf(n) !== i);
      if (dupes.length) err(where, `names 有重複：${[...new Set(dupes)].join('、')}`);
      for (const n of p.names) {
        if (!nameIndex.has(n)) nameIndex.set(n, []);
        nameIndex.get(n).push(key);
      }
    }

    // ocr_variants[] 為選填，放 rank 批的 OCR 誤讀變體；真名一律留在 names[]。
    if (p.ocr_variants !== undefined) {
      if (!Array.isArray(p.ocr_variants) || p.ocr_variants.length === 0) {
        err(where, 'ocr_variants 若存在應為非空陣列（沒有誤讀就省略此欄）');
      } else {
        p.ocr_variants.forEach((n, i) => {
          if (!isStr(n)) err(where, `ocr_variants[${i}] 應為非空字串`);
        });
        const dupes = p.ocr_variants.filter((n, i) => p.ocr_variants.indexOf(n) !== i);
        if (dupes.length) err(where, `ocr_variants 有重複：${[...new Set(dupes)].join('、')}`);
        const overlap = p.ocr_variants.filter((n) => (p.names ?? []).includes(n));
        if (overlap.length) {
          err(where, `ocr_variants 與 names 重疊：${overlap.join('、')}——誤讀變體不得混入真名`);
        }
      }
    }

    if (p.names_note !== undefined && !isStr(p.names_note)) {
      err(where, 'names_note 應為非空字串（記錄改名的判定依據）');
    }

    if (p.guild !== undefined && p.guild !== null && !isStr(p.guild)) {
      err(where, 'guild 應為非空字串或 null');
    }

    if (typeof p.seasons !== 'object' || p.seasons === null || Array.isArray(p.seasons)) {
      err(where, 'seasons 應為以賽季 id 為 key 的物件');
      continue;
    }
    if (Object.keys(p.seasons).length === 0) {
      err(where, 'seasons 不應為空——沒有任何一屆的紀錄就不該建檔');
    }

    for (const [sid, entry] of Object.entries(p.seasons)) {
      const sw = `${where} seasons[${sid}]`;
      if (!SEASON_ID_RE.test(sid)) {
        err(sw, ' 賽季 id 應為 YYYY-MM-DD');
        continue;
      }
      if (!seasonIds.has(sid)) {
        err(sw, `找不到對應的賽季檔案（data/{cup}/${sid}.json）`);
      }
      checkSeasonEntry(sw, entry);
    }

    // 累積型欄位跨屆必須遞增
    const ordered = Object.keys(p.seasons).sort();
    for (let i = 1; i < ordered.length; i++) {
      const prev = p.seasons[ordered[i - 1]];
      const cur = p.seasons[ordered[i]];
      for (const key of CUMULATIVE) {
        if (!Number.isInteger(prev?.[key]) || !Number.isInteger(cur?.[key])) continue;
        if (cur[key] < prev[key]) {
          err(`${where} seasons[${ordered[i]}]`,
            `${key} 從 ${ordered[i - 1]} 的 ${prev[key]} 倒退為 ${cur[key]}——累積型欄位不應減少，請核對截圖`);
        }
      }
    }
  }

  // 同名不同人：合法但值得提醒，這正是 player_id 存在的理由
  for (const [name, ids] of nameIndex) {
    if (ids.length > 1) warn(file, `顯示名稱「${name}」對應 ${ids.length} 個 player_id：${ids.join('、')}`);
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

  const total = Object.keys(players).length;
  const entries = Object.values(players).reduce((n, p) => n + Object.keys(p.seasons ?? {}).length, 0);
  console.log(`${file} 驗證通過：${total} 位選手、${entries} 筆屆別紀錄`);
}

await main();
