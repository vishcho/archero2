import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , dataPathArg, outputPathArg] = process.argv;

if (!dataPathArg || !outputPathArg) {
  console.error('Usage: node tools/render-tournament-results.mjs <data/star-cup/{season}.json> <docs/round*-tournament-results.md>');
  process.exit(1);
}

const dataPath = path.resolve(process.cwd(), dataPathArg);
const outputPath = path.resolve(process.cwd(), outputPathArg);
const season = JSON.parse(await readFile(dataPath, 'utf8'));

function formatPlayer(player, includePower = true) {
  const power = includePower && player.power ? ` (${player.power})` : '';
  const progress = (player.progress ?? '?').toString().padStart(2, ' ');
  const time = (player.time ?? '未知').padEnd(8, ' ');
  return `${progress}  ${time}  ${player.name}${power}`;
}

// 同名對戰（兩個不同帳號同名）時名稱無法判定勝負，改以 winner_power 指定的戰力區分。
function p1IsWinner(match) {
  if (match.p1.name !== match.p2.name) return match.winner === match.p1.name;
  if (match.winner_power) return match.p1.power === match.winner_power;
  return false;
}

function formatMatch(match) {
  const p1Won = p1IsWinner(match);
  const leftMark = p1Won ? '✓' : '✗';
  const rightMark = p1Won ? '✗' : '✓';
  const left = formatPlayer(match.p1, match.round === 'R1').padEnd(34, ' ');
  const rightName = `${match.p2.name}${match.round === 'R1' && match.p2.power ? ` (${match.p2.power})` : ''}`.padEnd(24, ' ');
  const right = `${rightName} ${(match.p2.progress ?? '?').toString().padStart(2, ' ')}  ${match.p2.time ?? '未知'}`;
  const note = match.notes?.length ? `  ← ${match.notes.join('；')}` : '';
  return `  ${left} ${leftMark} vs ${rightMark}  ${right}${note}`;
}

// 屆次序號改由 season.round 提供（見 docs/star-cup/star-cup.md「屆次定義」），
// 不再維護 id → 序號的硬編碼表。
// resultDate 是「戰報撰寫日」而非賽事日期，無法從賽事資料推導，因此保留對照表；
// 未列出的屆次退回該屆淘汰賽首日。
const RESULT_DATE = {
  '2026-06-19': '2026/6/19',
  '2026-07-03': '2026/7/4',
  '2026-07-17': '2026/7/23',
  '2026-07-31': '2026/8/6',
};
const roundLabel = season.round ? `第 ${season.round} 屆` : '淘汰賽';
const resultDate = RESULT_DATE[season.id] ?? season.date;
const hasCurrentPower = season.groups?.some((group) => group.champion_current_power);

// theme（屆主題）與 season（季主題）皆可為 null；兩者都沒有時整行省略。
const themeParts = [season.season, season.theme].filter(Boolean);

const lines = [
  `# ${roundLabel}淘汰賽成績（${resultDate}）`,
  '',
  ...(themeParts.length ? [`主題：${themeParts.join('｜')}`, ''] : []),
  '格式：`進度/10　時間　玩家（戰力）`',
];

if (hasCurrentPower) {
  lines.push('戰力採**對戰彈窗的賽時數值**；樹狀圖顯示的「目前戰力」另列於晉級一覽表。');
}

lines.push('', '---', '', '## 各組晉級一覽', '');

if (hasCurrentPower) {
  lines.push('| 組別 | 晉級者 | 賽時戰力 | 目前戰力 |', '|------|--------|----------|----------|');
  for (const group of season.groups) {
    lines.push(`| 第${group.id}組 | ${group.champion} | ${group.champion_power ?? '—'} | ${group.champion_current_power ?? '—'} |`);
  }
} else {
  lines.push('| 組別 | 晉級者 | 戰力 |', '|------|--------|------|');
  for (const group of season.groups) {
    lines.push(`| 第${group.id}組 | ${group.champion} | ${group.champion_power ?? '—'} |`);
  }
}

lines.push('', '---', '', '## 各組對戰詳情', '');

for (const group of season.groups) {
  lines.push(`### 第${group.id}組 → 🏆 ${group.champion}`, '', '```');
  for (const round of ['R1', 'R2', '決賽']) {
    lines.push(round);
    for (const match of group.matches?.filter((candidate) => candidate.round === round) ?? []) {
      lines.push(formatMatch(match));
    }
    lines.push('');
  }
  lines[lines.length - 1] = '```';
  lines.push('');
}

lines.push(
  '---',
  '',
  `> 資料來源：詳見 [sources.md](../sources.md)｜本檔可由 \`data/${season.id}.json\` 重新產生`
);

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
