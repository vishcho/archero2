export function validateBracket(
  matches,
  {
    file = "<season>",
    location = "/bracket",
    champion,
    runnerUp,
    players = [],
  } = {},
) {
  const diagnostics = [];
  const add = (severity, diagnosticLocation, message, kind) =>
    diagnostics.push({
      severity,
      file,
      location: diagnosticLocation,
      message,
      kind,
    });
  const rounds = Object.fromEntries(
    ["R1", "R2", "決賽"].map((r) => [r, matches.filter((m) => m.round === r)]),
  );
  const expectedSlots = {
    R1: ["A", "B", "C", "D"],
    R2: ["upper", "lower"],
    決賽: ["final"],
  };
  for (const [round, slots] of Object.entries(expectedSlots)) {
    const actual = rounds[round].map((match) => match.slot);
    for (const slot of slots) {
      const count = actual.filter((value) => value === slot).length;
      if (count === 0)
        add("error", location, `${round} 缺少 slot ${slot}`, "missing-slot");
      if (count > 1)
        add(
          "error",
          location,
          `${round} 的 slot ${slot} 重複`,
          "duplicate-slot",
        );
    }
    for (const slot of actual) {
      if (!slots.includes(slot)) {
        add("error", location, `${round} 不允許 slot ${slot}`, "invalid-slot");
      }
    }
  }
  for (const [i, match] of matches.entries()) {
    const names = [match.p1?.name, match.p2?.name];
    if (!names.includes(match.winner)) {
      add("error", `${location}/${i}/winner`, "winner 必須是該場選手");
    }
    if (!names.includes(match.loser)) {
      add("error", `${location}/${i}/loser`, "loser 必須是該場選手");
    }
    if (
      match.p1?.name === match.p2?.name &&
      (!match.p1.player_id || !match.p2.player_id)
    ) {
      add(
        "warning",
        `${location}/${i}`,
        `${match.round}/${match.slot} 雙方同名「${match.p1.name}」，缺 player_id 時無法驗證勝者身分`,
        "unverifiable-identity",
      );
    }
  }
  const r1Entries = matches.flatMap((match, matchIndex) =>
    match.round === "R1"
      ? [
          { side: match.p1, matchIndex, sideName: "p1" },
          { side: match.p2, matchIndex, sideName: "p2" },
        ]
      : [],
  );
  const r1Sides = r1Entries.map((entry) => entry.side);
  for (const { side, matchIndex, sideName } of players.length
    ? r1Entries
    : []) {
    const candidates = side?.player_id
      ? players.filter((player) => player.player_id === side.player_id)
      : players.filter((player) => player.name === side?.name);
    if (candidates.length !== 1) {
      add(
        "warning",
        `${location}/${matchIndex}/${sideName}`,
        candidates.length
          ? `R1 選手「${side?.name}」對應 ${candidates.length} 筆 player，身分無法驗證`
          : `R1 選手「${side?.name}」未對應 group player`,
        candidates.length ? "ambiguous-identity" : "unmatched-name",
      );
    }
  }
  for (const player of players) {
    const sameNamePlayers = players.filter(
      (candidate) => candidate.name === player.name,
    );
    const hasUnidentifiedSameNameSide = r1Sides.some(
      (side) => !side?.player_id && side?.name === player.name,
    );
    if (sameNamePlayers.length > 1 && hasUnidentifiedSameNameSide) continue;
    const identityCandidates = player.player_id
      ? players.filter((candidate) => candidate.player_id === player.player_id)
      : sameNamePlayers;
    if (identityCandidates.length > 1) continue;
    const appearances = r1Sides.filter((side) =>
      player.player_id && side?.player_id
        ? player.player_id === side.player_id
        : player.name === side?.name,
    ).length;
    if (appearances !== 1) {
      add(
        "warning",
        location,
        `group player「${player.name}」在 R1 出現 ${appearances} 次，應為 1 次`,
        "player-r1-count",
      );
    }
  }
  const r2Names = rounds.R2.flatMap((m) => [m.p1?.name, m.p2?.name]);
  for (const winner of rounds.R1.map((m) => m.winner)) {
    if (!r2Names.includes(winner)) {
      add(
        "error",
        location,
        `R1 勝者 ${winner} 未晉級 R2`,
        "invalid-advancement",
      );
    }
  }
  const final = rounds["決賽"][0];
  if (final) {
    for (const winner of rounds.R2.map((m) => m.winner)) {
      if (![final.p1?.name, final.p2?.name].includes(winner)) {
        add(
          "error",
          location,
          `R2 勝者 ${winner} 未晉級決賽`,
          "invalid-advancement",
        );
      }
    }
    if (champion !== undefined && champion !== final.winner) {
      add(
        "error",
        location,
        `冠軍 ${champion} 與決賽勝者 ${final.winner} 不符`,
      );
    }
    if (runnerUp !== undefined && runnerUp !== final.loser) {
      add("error", location, `亞軍 ${runnerUp} 與決賽敗者 ${final.loser} 不符`);
    }
  }
  return diagnostics;
}

export function validateTournamentResults(season, file = "<season>") {
  const errors = [];
  for (const [groupIndex, group] of (season.groups ?? []).entries()) {
    if (!group.matches) continue;
    errors.push(
      ...validateBracket(group.matches, {
        file,
        location: `/groups/${groupIndex}/matches`,
        champion: group.champion,
        runnerUp: group.runner_up,
        players: group.players,
      }),
    );
  }

  if (season.grand_finals) {
    const ranked = [...season.grand_finals.results].sort(
      (a, b) => a.rank - b.rank,
    );
    const ranks = ranked.map((result) => result.rank);
    if (ranks.join() !== "1,2,3,3,5,5,5,5")
      errors.push({
        severity: "error",
        file,
        location: "/grand_finals/results",
        message:
          "總決賽名次必須為 1、2、並列 3、並列 5，不得猜測同輪淘汰者的內部順序",
      });
    const names = season.grand_finals.results.map((result) => result.name);
    if (new Set(names).size !== names.length)
      errors.push({
        severity: "error",
        file,
        location: "/grand_finals/results",
        message: "總決賽 results 不可有重複選手",
      });
    const groupChampions = (season.groups ?? [])
      .map((group) => group.champion)
      .filter(Boolean);
    for (const name of names)
      if (!groupChampions.includes(name))
        errors.push({
          severity: "error",
          file,
          location: "/grand_finals/results",
          message: `總決賽選手 ${name} 不是任何分組冠軍`,
        });
    errors.push(
      ...validateBracket(season.grand_finals.bracket, {
        file,
        location: "/grand_finals/bracket",
        champion: season.champion,
        runnerUp: ranked.find((result) => result.rank === 2)?.name,
      }),
    );
  }
  return errors;
}

export function derivePreviousSummary(previousSeason, playerId) {
  if (!playerId) return null;
  for (const group of previousSeason.groups ?? []) {
    const player = group.players?.find((p) => p.player_id === playerId);
    if (!player) continue;
    const matches = group.matches ?? [];
    const final = matches.find((m) => m.round === "決賽");
    const r2 = matches.find(
      (m) => m.round === "R2" && [m.p1?.name, m.p2?.name].includes(player.name),
    );
    const r1 = matches.find(
      (m) => m.round === "R1" && [m.p1?.name, m.p2?.name].includes(player.name),
    );
    const best =
      final?.winner === player.name
        ? "1強"
        : final?.loser === player.name
          ? "2強"
          : r2
            ? "4強"
            : r1
              ? "8強"
              : null;
    return best
      ? { prev_best: best, prev_time: player.qualifier_time ?? null }
      : null;
  }
  return null;
}

export function validateSeasonRelations(season, file = "<season>") {
  const errors = [];
  if (season.knockout_period?.[0] !== season.id)
    errors.push({
      severity: "error",
      file,
      location: "/knockout_period/0",
      message: "Star Cup id 必須等於淘汰賽首日",
    });
  if (season.qualifier_period?.[0] > season.qualifier_period?.[1])
    errors.push({
      severity: "error",
      file,
      location: "/qualifier_period",
      message: "預選期間起日晚於迄日",
    });
  if (season.qualifier_period?.[1] >= season.knockout_period?.[0])
    errors.push({
      severity: "error",
      file,
      location: "/qualifier_period/1",
      message: "預選期間必須早於淘汰賽",
    });
  return errors;
}

export function validatePlayerReferences(
  records,
  knownIds,
  file = "<season>",
  base = "/players",
) {
  const errors = [];
  records.forEach((player, index) => {
    if (player.player_id && !knownIds.has(player.player_id))
      errors.push({
        severity: "error",
        file,
        location: `${base}/${index}/player_id`,
        message: `未知 player_id ${player.player_id}`,
      });
  });
  return errors;
}

export function validateEnchantColors(roster, file = "<roster>") {
  const errors = [];
  const seen = new Map();
  roster.forEach((player, pi) =>
    (player.enchants ?? []).forEach((enchant, ei) => {
      if (!enchant?.color) return;
      const previous = seen.get(enchant.text);
      if (previous && previous.color !== enchant.color)
        errors.push({
          severity: "error",
          file,
          location: `/roster/${pi}/enchants/${ei}/color`,
          message: `同詞條顏色與 ${previous.location} 不一致`,
        });
      else
        seen.set(enchant.text, {
          color: enchant.color,
          location: `/roster/${pi}/enchants/${ei}`,
        });
    }),
  );
  return errors;
}
