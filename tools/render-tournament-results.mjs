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

const ROUND_INFO = {
  '2026-06-19': { roundLabel: '第一輪', resultDate: '2026/6/19' },
  '2026-07-03': { roundLabel: '第二輪', resultDate: '2026/7/4' },
  '2026-07-17': { roundLabel: '第三輪', resultDate: '2026/7/23' },
  '2026-07-31': { roundLabel: '第四輪', resultDate: '2026/8/6' },
};
const { roundLabel, resultDate } = ROUND_INFO[season.id] ?? { roundLabel: '淘汰賽', resultDate: season.date };
const hasCurrentPower = season.groups?.some((group) => group.champion_current_power);

const lines = [
  `# ${roundLabel}淘汰賽成績（${resultDate}）`,
  '',
  `主題：${season.theme}`,
  '',
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
