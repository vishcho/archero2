import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , docPathArg, dataPathArg] = process.argv;

if (!docPathArg || !dataPathArg) {
  console.error('Usage: node tools/import-tournament-results-from-doc.mjs <docs/round*-tournament-results.md> <data/{season}.json>');
  process.exit(1);
}

const root = process.cwd();
const docPath = path.resolve(root, docPathArg);
const dataPath = path.resolve(root, dataPathArg);

const text = await readFile(docPath, 'utf8');
const season = JSON.parse(await readFile(dataPath, 'utf8'));

function normalizeName(name) {
  return name
    .replace(/\s*★\s*$/, '')
    .replace(/\s*⚠\s*$/, '')
    .replace(/\s*≈\s*$/, '')
    .trim();
}

function parseSide(raw, side) {
  const pattern = side === 'left'
    ? /^\s*(\d+)\s+([0-9:.]+)\s+(.+?)\s*$/
    : /^\s*(.+?)\s+(\d+)\s+([0-9:.]+)\s*$/;
  const match = raw.match(pattern);

  if (!match) {
    throw new Error(`Cannot parse ${side} side: ${raw}`);
  }

  if (side === 'left') {
    const [, progress, time, nameAndPower] = match;
    return parseNamePower(progress, time, nameAndPower);
  }

  const [, nameAndPower, progress, time] = match;
  return parseNamePower(progress, time, nameAndPower);
}

function parseNamePower(progress, time, nameAndPower) {
  const powerMatch = nameAndPower.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return {
    name: normalizeName(powerMatch ? powerMatch[1] : nameAndPower),
    progress: Number(progress),
    time,
    ...(powerMatch ? { power: powerMatch[2].trim() } : {}),
  };
}

function parseMatchLine(line, round, slot) {
  const cleanLine = line.replace(/\s*←\s*(.+?)\s*$/, (_, note) => ` NOTE:${note.trim()}`);
  const [matchPart, inlineNote] = cleanLine.split(/\s+NOTE:/);
  const match = matchPart.match(/^(.*?)\s+([✓✗])\s+vs\s+([✓✗])\s+(.*?)\s*$/);

  if (!match) {
    throw new Error(`Cannot parse match line: ${line}`);
  }

  const [, leftRaw, leftMark, rightMark, rightRaw] = match;
  const p1 = parseSide(leftRaw, 'left');
  const p2 = parseSide(rightRaw, 'right');
  const winner = leftMark === '✓' ? p1.name : p2.name;
  const loser = leftMark === '✓' ? p2.name : p1.name;

  return {
    round,
    slot,
    p1,
    p2,
    winner,
    loser,
    ...(inlineNote ? { notes: [inlineNote.trim()] } : {}),
  };
}

function parseSummaryRows(markdown) {
  const rows = new Map();
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('| 第')) continue;

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 3) continue;

    const groupMatch = cells[0].match(/^第(\d+)組$/);
    if (!groupMatch) continue;

    rows.set(Number(groupMatch[1]), {
      champion: cells[1],
      champion_power: cells[2].replace(/\s*⚠\s*$/, ''),
      ...(cells[3] ? { champion_current_power: cells[3] } : {}),
    });
  }

  return rows;
}

function parseGroups(markdown) {
  const groups = [];
  const groupRegex = /^### 第(\d+)組 → 🏆 (.+?)\s*$(.*?)(?=^### 第\d+組 → 🏆 |\n---\n|\n## 註記|\n> 資料來源|(?![\s\S]))/gms;

  for (const groupMatch of markdown.matchAll(groupRegex)) {
    const groupId = Number(groupMatch[1]);
    const champion = groupMatch[2].trim();
    const body = groupMatch[3];
    const codeBlock = body.match(/```([\s\S]*?)```/);

    if (!codeBlock) {
      throw new Error(`Group ${groupId} has no result code block`);
    }

    const matches = [];
    let round = '';
    let r1Index = 0;
    let r2Index = 0;
    const lines = codeBlock[1].split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === 'R1' || trimmed === 'R2' || trimmed === '決賽') {
        round = trimmed;
        continue;
      }

      const slot = round === 'R1'
        ? 'ABCD'[r1Index++]
        : round === 'R2'
          ? ['upper', 'lower'][r2Index++]
          : 'final';

      matches.push(parseMatchLine(line, round, slot));
    }

    groups.push({ id: groupId, champion, matches });
  }

  return groups;
}

const summaryRows = parseSummaryRows(text);
const parsedGroups = parseGroups(text);

for (const parsedGroup of parsedGroups) {
  const group = season.groups.find((candidate) => candidate.id === parsedGroup.id);
  if (!group) {
    throw new Error(`No group ${parsedGroup.id} in ${dataPathArg}`);
  }

  const finalMatch = parsedGroup.matches.find((match) => match.round === '決賽');
  const summary = summaryRows.get(parsedGroup.id);

  group.champion = parsedGroup.champion;
  group.runner_up = finalMatch?.loser ?? group.runner_up;

  if (summary?.champion_power) {
    group.champion_power = summary.champion_power;
  }
  if (summary?.champion_current_power) {
    group.champion_current_power = summary.champion_current_power;
  }

  group.matches = parsedGroup.matches;
}

await writeFile(dataPath, `${JSON.stringify(season, null, 2)}\n`, 'utf8');
