#!/usr/bin/env node
// 盤點明星盃三個 checkpoint 的四種正式證據。Manifest 優先，舊式平面目錄仍相容。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'screenshots');
const EVIDENCE = new Set(['original', 'placeholder', 'missing']);

export const BATCH_TYPES = [
  { type: 'qualifier-rank', aliases: ['rank'], checkpoint: 'A', order: 1, label: '資格賽排名', expect: 1, tolerance: 0, overage: true, desc: '排行榜連拍；張數僅驗非空，仍須確認實際覆蓋前 64 名' },
  { type: 'knockout-matchup', aliases: ['matchup'], checkpoint: 'A', order: 2, label: '淘汰賽對陣', expect: 8, tolerance: 0, desc: '8 組賽前對陣，每組 1 張' },
  { type: 'knockout-results', aliases: ['results'], checkpoint: 'B', order: 3, label: '淘汰賽結果', expect: 64, tolerance: 8, desc: '8 組 ×（1 張結果樹＋7 場）' },
  { type: 'grand-finals-results', aliases: [], checkpoint: 'C', order: 4, label: '總決賽結果', expect: 8, tolerance: 0, desc: '1 張結果樹＋7 場' },
  // 個人名片不是賽事 checkpoint，但保留歷史盤點能力。
  { type: 'top64-profile', aliases: ['top64'], checkpoint: 'profile', order: 5, label: '玩家名片', expect: 64, tolerance: 0, overage: true, optional: true, desc: '64 位玩家個人資訊名片' },
];

const TYPE_BY_NAME = new Map(BATCH_TYPES.flatMap((spec) => [spec.type, ...spec.aliases].map((name) => [name, spec])));
const LEGACY_RE = /^(\d{4}-\d{2}-\d{2})-(round\d+)-([a-z0-9-]+)$/;
const SEASON_RE = /^(\d{4}-\d{2}-\d{2})-(round\d+)$/;

function imageCount(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((name) => /\.(png|jpe?g|webp)$/i.test(name)).length;
}

function classify(spec, count, evidenceStatus, dir) {
  if (evidenceStatus === 'placeholder') return { ...spec, dir, count, evidenceStatus, status: 'placeholder' };
  if (evidenceStatus === 'missing') return { ...spec, dir, count: 0, evidenceStatus, status: 'missing' };
  if (!count) return { ...spec, dir, count: 0, evidenceStatus, status: 'pending' };
  const delta = count - spec.expect;
  const ok = spec.overage ? delta >= -spec.tolerance : Math.abs(delta) <= spec.tolerance;
  return { ...spec, dir, count, delta, evidenceStatus, status: ok ? 'ok' : 'count' };
}

function validateManifest(value, file) {
  const errors = [];
  if (value.version !== 1) errors.push(`${file}: version 必須為 1`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.season_id ?? '')) errors.push(`${file}: season_id 應為淘汰賽首日 YYYY-MM-DD`);
  if (!Number.isInteger(value.round) || value.round < 1) errors.push(`${file}: round 應為正整數`);
  for (const type of BATCH_TYPES.filter((spec) => !spec.optional).map((spec) => spec.type)) {
    if (!(type in (value.batches ?? {}))) errors.push(`${file}: batches 缺少 ${type}`);
  }
  for (const [type, batch] of Object.entries(value.batches ?? {})) {
    if (!TYPE_BY_NAME.has(type)) errors.push(`${file}: 未知批次 ${type}`);
    if (!EVIDENCE.has(batch?.evidence_status)) errors.push(`${file}: ${type}.evidence_status 應為 original / placeholder / missing`);
    if (batch?.evidence_status === 'placeholder' && !batch.purpose) errors.push(`${file}: placeholder 批次 ${type} 必須說明 purpose`);
  }
  return errors;
}

export function scanTopic(topicDir) {
  const rounds = new Map();
  const malformed = [];
  const ensure = (round) => {
    if (!rounds.has(round)) rounds.set(round, { round, dates: [], batches: new Map() });
    return rounds.get(round);
  };

  for (const name of readdirSync(topicDir)) {
    const full = join(topicDir, name);
    if (!statSync(full).isDirectory() || name.startsWith('.')) continue;
    const seasonMatch = SEASON_RE.exec(name);
    const manifestFile = join(full, 'manifest.json');
    if (seasonMatch && existsSync(manifestFile)) {
      let manifest;
      try { manifest = JSON.parse(readFileSync(manifestFile, 'utf8')); }
      catch (error) { malformed.push({ dir: name, reason: `manifest.json 無法解析：${error.message}` }); continue; }
      for (const reason of validateManifest(manifest, manifestFile)) malformed.push({ dir: name, reason });
      const round = `round${manifest.round}`;
      const record = ensure(round);
      record.dates.push(manifest.season_id);
      for (const [rawType, batch] of Object.entries(manifest.batches ?? {})) {
        const spec = TYPE_BY_NAME.get(rawType);
        if (!spec) continue;
        const batchDir = join(full, batch.path ?? spec.type);
        record.batches.set(spec.type, classify(spec, imageCount(batchDir), batch.evidence_status, batchDir));
      }
      continue;
    }

    const legacy = LEGACY_RE.exec(name);
    if (!legacy) { malformed.push({ dir: name, reason: '目錄名不符舊式 YYYY-MM-DD-roundN-<type>，也不是含 manifest 的屆次目錄' }); continue; }
    const [, date, round, rawType] = legacy;
    const spec = TYPE_BY_NAME.get(rawType);
    if (!spec) { malformed.push({ dir: name, reason: `未知批次類型 ${rawType}` }); continue; }
    const record = ensure(round);
    record.dates.push(date);
    record.batches.set(spec.type, classify(spec, imageCount(full), 'original', full));
  }

  const result = [...rounds.values()].sort((a, b) => Number(a.round.slice(5)) - Number(b.round.slice(5)));
  for (const record of result) {
    record.dates = [...new Set(record.dates)].sort();
    record.slots = BATCH_TYPES.map((spec) => record.batches.get(spec.type) ?? { ...spec, count: 0, evidenceStatus: 'missing', status: spec.optional ? 'optional' : 'missing' });
    record.complete = record.slots.filter((slot) => !slot.optional).every((slot) => slot.status === 'ok');
  }
  return { rounds: result, malformed };
}

function icon(status) {
  return ({ ok: '✅', count: '⚠️', pending: '⏳', placeholder: '🚫', optional: '—' })[status] ?? '❌';
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const filter = args.includes('--round') ? args[args.indexOf('--round') + 1] : null;
  if (!existsSync(SHOTS)) { console.error(`找不到 ${SHOTS}`); process.exit(1); }
  const report = {};
  for (const topic of readdirSync(SHOTS).filter((name) => !name.startsWith('.') && statSync(join(SHOTS, name)).isDirectory())) {
    const scanned = scanTopic(join(SHOTS, topic));
    const rounds = filter ? scanned.rounds.filter((record) => record.round === filter) : scanned.rounds;
    report[topic] = { rounds, malformed: scanned.malformed };
    if (asJson || (!rounds.length && !scanned.malformed.length)) continue;
    console.log(`\n## ${topic}\n`);
    console.log(`| 輪次 | 日期 | ${BATCH_TYPES.map((spec) => spec.label).join(' | ')} | 狀態 |`);
    console.log(`| --- | --- | ${BATCH_TYPES.map(() => '---').join(' | ')} | --- |`);
    for (const record of rounds) {
      const cells = record.slots.map((slot) => `${icon(slot.status)} ${slot.status === 'placeholder' ? '代圖' : slot.count || '—'}`);
      console.log(`| ${record.round} | ${record.dates.join('、') || '—'} | ${cells.join(' | ')} | ${record.complete ? '完整' : '未完整'} |`);
    }
    for (const bad of scanned.malformed) console.log(`⚠️ ${bad.dir} — ${bad.reason}`);
  }
  if (asJson) {
    const plain = Object.fromEntries(Object.entries(report).map(([topic, value]) => [topic, { ...value, rounds: value.rounds.map(({ batches, ...record }) => record) }]));
    console.log(JSON.stringify(plain, null, 2));
  } else console.log('\n圖例：✅ 正式證據齊全　⚠️ 張數異常　⏳ 待拍　🚫 代圖（不算證據）　❌ 缺件');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-screenshots.mjs')) main();
