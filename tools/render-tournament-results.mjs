import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , dataPathArg, outputPathArg] = process.argv;

if (!dataPathArg || !outputPathArg) {
  console.error('Usage: node tools/render-tournament-results.mjs <data/{season}.json> <docs/round*-tournament-results.md>');
  process.exit(1);
}

const dataPath = path.resolve(process.cwd(), dataPathArg);
const outputPath = path.resolve(process.cwd(), outputPathArg);
const season = JSON.parse(await readFile(dataPath, 'utf8'));

function formatPlayer(player, includePower = true) {
  const power = includePower && player.power ? ` (${player.power})` : '';
  return `${player.progress.toString().padStart(2, ' ')}  ${player.time.padEnd(8, ' ')}  ${player.name}${power}`;
}

function formatMatch(match) {
  const leftMark = match.winner === match.p1.name ? '✓' : '✗';
  const rightMark = match.winner === match.p2.name ? '✓' : '✗';
  const left = formatPlayer(match.p1, match.round === 'R1').padEnd(34, ' ');
  const rightName = `${match.p2.name}${match.round === 'R1' && match.p2.power ? ` (${match.p2.power})` : ''}`.padEnd(24, ' ');
  const right = `${rightName} ${match.p2.progress.toString().padStart(2, ' ')}  ${match.p2.time}`;
  const note = match.notes?.length ? `  ← ${match.notes.join('；')}` : '';
  return `  ${left} ${leftMark} vs ${rightMark}  ${right}${note}`;
}

const roundLabel = season.id === '2026-06-19' ? '第一輪' : '第二輪';
const resultDate = season.id === '2026-06-19' ? '2026/6/19' : '2026/7/4';
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
  `> 資料來源：詳見 [sources.md](./sources.md)｜本檔可由 \`data/${season.id}.json\` 重新產生`
);

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
