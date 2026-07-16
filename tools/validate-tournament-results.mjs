import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [, , dataPathArg] = process.argv;

if (!dataPathArg) {
  console.error('Usage: node tools/validate-tournament-results.mjs <data/{season}.json>');
  process.exit(1);
}

const dataPath = path.resolve(process.cwd(), dataPathArg);
const season = JSON.parse(await readFile(dataPath, 'utf8'));
const errors = [];

function addError(groupId, message) {
  errors.push(`Group ${groupId}: ${message}`);
}

for (const group of season.groups ?? []) {
  if (!group.matches) continue;

  const matches = group.matches;
  const byRound = {
    R1: matches.filter((match) => match.round === 'R1'),
    R2: matches.filter((match) => match.round === 'R2'),
    '決賽': matches.filter((match) => match.round === '決賽'),
  };

  if (byRound.R1.length !== 4) addError(group.id, `expected 4 R1 matches, got ${byRound.R1.length}`);
  if (byRound.R2.length !== 2) addError(group.id, `expected 2 R2 matches, got ${byRound.R2.length}`);
  if (byRound['決賽'].length !== 1) addError(group.id, `expected 1 final match, got ${byRound['決賽'].length}`);

  for (const match of matches) {
    const names = [match.p1?.name, match.p2?.name];
    if (!names.includes(match.winner)) addError(group.id, `${match.round}/${match.slot} winner ${match.winner} is not a player`);
    if (!names.includes(match.loser)) addError(group.id, `${match.round}/${match.slot} loser ${match.loser} is not a player`);
  }

  const r1Winners = byRound.R1.map((match) => match.winner);
  const r2Players = byRound.R2.flatMap((match) => [match.p1.name, match.p2.name]);
  for (const winner of r1Winners) {
    if (!r2Players.includes(winner)) addError(group.id, `R1 winner ${winner} does not appear in R2`);
  }

  const r2Winners = byRound.R2.map((match) => match.winner);
  const final = byRound['決賽'][0];
  if (final) {
    for (const winner of r2Winners) {
      if (![final.p1.name, final.p2.name].includes(winner)) addError(group.id, `R2 winner ${winner} does not appear in final`);
    }
    if (group.champion !== final.winner) addError(group.id, `champion ${group.champion} does not match final winner ${final.winner}`);
    if (group.runner_up !== final.loser) addError(group.id, `runner_up ${group.runner_up} does not match final loser ${final.loser}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`${dataPathArg}: tournament results OK`);
