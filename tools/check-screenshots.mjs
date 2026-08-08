#!/usr/bin/env node
// 盤點 screenshots/ 各輪賽事的四類批次是否齊全。
//
//   node tools/check-screenshots.mjs                 # 表格總覽
//   node tools/check-screenshots.mjs --json          # 機器可讀
//   node tools/check-screenshots.mjs --round 2026-08-14-round5
//
// 四類批次（每輪賽事應有）：
//   matchup 對陣圖 / rank 排行榜 / top64 玩家資訊 / results 賽事結果
//
// 截圖本身是 gitignored 的，所以本工具只在本機有意義；
// 沒有截圖的 clone 請看 docs/sources.md。

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'screenshots');

/** 四類批次的規格。order 決定顯示與排序順序（照賽事時序）。 */
export const BATCH_TYPES = [
  { type: 'matchup', order: 1, label: '對陣圖', expect: 8,  tolerance: 0, desc: '8 組賽前對陣，每組 1 張' },
  { type: 'rank',    order: 2, label: '排行榜', expect: 10, tolerance: 4, desc: '資格賽排行榜連拍，需覆蓋前 64 名＋本期主題' },
  { type: 'top64',   order: 3, label: '玩家資訊', expect: 64, tolerance: 0, desc: '64 位晉級選手的個人資訊名片，每人 1 張' },
  { type: 'results', order: 4, label: '賽事結果', expect: 64, tolerance: 8, desc: '8 組 × (1 張樹狀圖 + 7 場對戰)；補件會超出 64' },
];

const TYPE_BY_NAME = new Map(BATCH_TYPES.map((t) => [t.type, t]));

/** 目錄名格式：YYYY-MM-DD-roundN-<type> */
const DIR_RE = /^(\d{4}-\d{2}-\d{2})-(round\d+)-([a-z0-9]+)$/;

function isImage(name) {
  return /\.(png|jpe?g|webp)$/i.test(name);
}

/** 掃描一個主題目錄（如 star-cup），回傳依 round 分組的批次盤點。 */
export function scanTopic(topicDir) {
  const batches = [];
  const malformed = [];

  for (const name of readdirSync(topicDir)) {
    const full = join(topicDir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith('.')) continue;

    const m = DIR_RE.exec(name);
    if (!m) {
      malformed.push({ dir: name, reason: '目錄名不符 YYYY-MM-DD-roundN-<type>' });
      continue;
    }

    const [, date, round, type] = m;
    const spec = TYPE_BY_NAME.get(type);
    if (!spec) {
      malformed.push({ dir: name, reason: `未知批次類型 "${type}"，應為 ${BATCH_TYPES.map((t) => t.type).join(' / ')}` });
      continue;
    }

    const files = readdirSync(full).filter(isImage);
    batches.push({ dir: name, date, round, type, spec, count: files.length });
  }

  // 依 round 聚合。同一 round 可能跨多個日期（賽前 / 賽後分開拍）。
  const rounds = new Map();
  for (const b of batches) {
    if (!rounds.has(b.round)) rounds.set(b.round, { round: b.round, batches: new Map() });
    rounds.get(b.round).batches.set(b.type, b);
  }

  const sorted = [...rounds.values()].sort((a, b) => {
    const na = Number(a.round.slice(5));
    const nb = Number(b.round.slice(5));
    return na - nb;
  });

  for (const r of sorted) {
    r.dates = [...r.batches.values()].map((b) => b.date).sort();
    r.slots = BATCH_TYPES.map((spec) => {
      const b = r.batches.get(spec.type);
      if (!b) return { ...spec, present: false, status: 'missing', count: 0 };
      // 目錄已建但還沒圖 = 尚未拍攝，不是張數異常。開新一輪時四批會先建空目錄。
      if (b.count === 0) {
        return { ...spec, present: true, status: 'pending', count: 0, dir: b.dir, date: b.date };
      }
      const delta = b.count - spec.expect;
      const ok = Math.abs(delta) <= spec.tolerance;
      return {
        ...spec,
        present: true,
        status: ok ? 'ok' : 'count',
        count: b.count,
        dir: b.dir,
        date: b.date,
        delta,
      };
    });
    r.complete = r.slots.every((s) => s.status === 'ok');
    r.pending = r.slots.every((s) => s.status === 'pending');
  }

  return { rounds: sorted, malformed };
}

function icon(slot) {
  if (slot.status === 'ok') return '✅';
  if (slot.status === 'count') return '⚠️';
  if (slot.status === 'pending') return '⏳';
  return '❌';
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const roundFilter = args.includes('--round') ? args[args.indexOf('--round') + 1] : null;

  if (!existsSync(SHOTS)) {
    console.error(`找不到 ${SHOTS}（截圖是 gitignored 的，此 clone 可能沒有本機截圖）`);
    process.exit(1);
  }

  const topics = readdirSync(SHOTS).filter((n) => {
    if (n.startsWith('.')) return false;
    return statSync(join(SHOTS, n)).isDirectory();
  });

  const report = {};
  let incomplete = 0;

  for (const topic of topics) {
    const { rounds, malformed } = scanTopic(join(SHOTS, topic));
    const shown = roundFilter ? rounds.filter((r) => r.round === roundFilter || r.batches.has(roundFilter)) : rounds;
    report[topic] = { rounds: shown, malformed };

    if (asJson) continue;

    console.log(`\n## ${topic}\n`);
    const head = ['輪次', '日期', ...BATCH_TYPES.map((t) => `${t.label}`), '狀態'];
    console.log(`| ${head.join(' | ')} |`);
    console.log(`| ${head.map(() => '---').join(' | ')} |`);

    for (const r of shown) {
      const cells = r.slots.map((s) => {
        if (!s.present) return '❌ —';
        if (s.status === 'pending') return '⏳ —';
        return `${icon(s)} ${s.count}`;
      });
      const state = r.pending ? '未開始' : r.complete ? '完整' : '缺件';
      if (!r.complete && !r.pending) incomplete++;
      console.log(`| ${r.round} | ${r.dates[0] ?? '—'} | ${cells.join(' | ')} | ${state} |`);
    }

    for (const r of shown) {
      if (r.pending) continue; // 整輪都還沒拍，不需逐項列出
      const problems = r.slots.filter((s) => s.status !== 'ok');
      if (!problems.length) continue;
      console.log(`\n${r.round}:`);
      for (const p of problems) {
        if (!p.present) {
          console.log(`  ❌ 缺 ${p.type}（${p.label}）— 預期 ${p.expect} 張：${p.desc}`);
        } else if (p.status === 'pending') {
          console.log(`  ⏳ ${p.dir}：目錄已建，尚未拍攝（預期 ${p.expect} 張）`);
        } else {
          const sign = p.delta > 0 ? `多 ${p.delta}` : `少 ${-p.delta}`;
          console.log(`  ⚠️  ${p.dir}：${p.count} 張，預期 ${p.expect}±${p.tolerance}（${sign}）`);
        }
      }
    }

    if (malformed.length) {
      console.log(`\n命名不符規範：`);
      for (const m of malformed) console.log(`  ⚠️  ${m.dir} — ${m.reason}`);
    }
  }

  if (asJson) {
    // batches 是 Map，序列化會變成誤導性的 {}；slots 已涵蓋同樣資訊。
    const plain = Object.fromEntries(
      Object.entries(report).map(([topic, { rounds, malformed }]) => [
        topic,
        { rounds: rounds.map(({ batches, ...r }) => r), malformed },
      ]),
    );
    console.log(JSON.stringify(plain, null, 2));
    return;
  }

  console.log(`\n圖例：✅ 齊全　⚠️ 張數異常　⏳ 目錄已建未拍　❌ 缺整批`);
  if (incomplete) console.log(`${incomplete} 輪有缺件。缺件不一定是問題——舊輪次可能當時就沒拍，詳見 docs/sources.md。`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-screenshots.mjs')) {
  main();
}
