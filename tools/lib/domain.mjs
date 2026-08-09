export function validateTournamentResults(season, file = '<season>') {
  const errors = [];
  const add = (location, message) => errors.push({ severity: 'error', file, location, message });
  for (const group of season.groups ?? []) {
    if (!group.matches) continue;
    const loc = `/groups/${group.id}`; const matches = group.matches;
    const rounds = Object.fromEntries(['R1', 'R2', '決賽'].map((r) => [r, matches.filter((m) => m.round === r)]));
    for (const [round, count] of [['R1', 4], ['R2', 2], ['決賽', 1]]) if (rounds[round].length !== count) add(loc, `${round} 應有 ${count} 場，得到 ${rounds[round].length}`);
    for (const [i, match] of matches.entries()) {
      const names = [match.p1?.name, match.p2?.name];
      if (!names.includes(match.winner)) add(`${loc}/matches/${i}/winner`, 'winner 必須是該場選手');
      if (!names.includes(match.loser)) add(`${loc}/matches/${i}/loser`, 'loser 必須是該場選手');
    }
    const r2Names = rounds.R2.flatMap((m) => [m.p1?.name, m.p2?.name]);
    for (const winner of rounds.R1.map((m) => m.winner)) if (!r2Names.includes(winner)) add(loc, `R1 勝者 ${winner} 未晉級 R2`);
    const final = rounds['決賽'][0];
    if (final) {
      for (const winner of rounds.R2.map((m) => m.winner)) if (![final.p1?.name, final.p2?.name].includes(winner)) add(loc, `R2 勝者 ${winner} 未晉級決賽`);
      if (group.champion !== final.winner) add(`${loc}/champion`, '分組冠軍與決賽勝者不符');
      if (group.runner_up !== final.loser) add(`${loc}/runner_up`, '分組亞軍與決賽敗者不符');
    }
  }
  return errors;
}

export function derivePreviousSummary(previousSeason, playerId) {
  if (!playerId) return null;
  for (const group of previousSeason.groups ?? []) {
    const player = group.players?.find((p) => p.player_id === playerId);
    if (!player) continue;
    const matches = group.matches ?? [];
    const final = matches.find((m) => m.round === '決賽');
    const r2 = matches.find((m) => m.round === 'R2' && [m.p1?.name, m.p2?.name].includes(player.name));
    const r1 = matches.find((m) => m.round === 'R1' && [m.p1?.name, m.p2?.name].includes(player.name));
    const best = final?.winner === player.name ? '1強' : final?.loser === player.name ? '2強' : r2 ? '4強' : r1 ? '8強' : null;
    return best ? { prev_best: best, prev_time: player.qualifier_time ?? null } : null;
  }
  return null;
}

export function validateSeasonRelations(season, file = '<season>') {
  const errors = [];
  if (season.knockout_period?.[0] !== season.id) errors.push({ severity: 'error', file, location: '/knockout_period/0', message: 'Star Cup id 必須等於淘汰賽首日' });
  if (season.qualifier_period?.[0] > season.qualifier_period?.[1]) errors.push({ severity: 'error', file, location: '/qualifier_period', message: '預選期間起日晚於迄日' });
  if (season.qualifier_period?.[1] >= season.knockout_period?.[0]) errors.push({ severity: 'error', file, location: '/qualifier_period/1', message: '預選期間必須早於淘汰賽' });
  return errors;
}

export function validatePlayerReferences(records, knownIds, file = '<season>', base = '/players') {
  const errors = [];
  records.forEach((player, index) => {
    if (player.player_id && !knownIds.has(player.player_id)) errors.push({ severity: 'error', file, location: `${base}/${index}/player_id`, message: `未知 player_id ${player.player_id}` });
  });
  return errors;
}

export function validateEnchantColors(roster, file = '<roster>') {
  const errors = []; const seen = new Map();
  roster.forEach((player, pi) => (player.enchants ?? []).forEach((enchant, ei) => {
    if (!enchant?.color) return;
    const previous = seen.get(enchant.text);
    if (previous && previous.color !== enchant.color) errors.push({ severity: 'error', file, location: `/roster/${pi}/enchants/${ei}/color`, message: `同詞條顏色與 ${previous.location} 不一致` });
    else seen.set(enchant.text, { color: enchant.color, location: `/roster/${pi}/enchants/${ei}` });
  }));
  return errors;
}
