const HISTORY_RANK = new Map([
  ["1強", 7],
  ["2強", 6],
  ["4強", 5],
  ["8強", 4],
  ["16強", 3],
  ["32強", 2],
  ["64強", 1],
  ["未入選", 0],
]);

const CONFIDENCE_ORDER = ["low", "medium", "high"];

function numberValue(value) {
  if (value == null) return null;
  const match = String(value).match(/^([\d.]+)([MK]?)$/i);
  if (!match) return null;
  return (
    Number(match[1]) *
    (match[2].toUpperCase() === "M"
      ? 1_000_000
      : match[2].toUpperCase() === "K"
        ? 1_000
        : 1)
  );
}

function timeValue(value) {
  if (!value || value === "未通關") return null;
  const parts = String(value).split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

function historyValue(player) {
  if (!player || player.flag === "⚠") return null;
  if (HISTORY_RANK.has(player.prev_best))
    return HISTORY_RANK.get(player.prev_best);
  const progress = String(player.prev_progress ?? "").match(/^(\d+)\/(\d+)$/);
  return progress ? Number(progress[1]) / Number(progress[2]) : null;
}

function compareMetric(a, b, read, lowerWins = false) {
  const av = read(a);
  const bv = read(b);
  if (av == null && bv == null) return { side: null, av, bv };
  if (av == null) return { side: "p2", av, bv };
  if (bv == null) return { side: "p1", av, bv };
  if (av === bv) return { side: null, av, bv };
  return { side: (lowerWins ? av < bv : av > bv) ? "p1" : "p2", av, bv };
}

function lowerConfidence(confidence) {
  return CONFIDENCE_ORDER[
    Math.max(0, CONFIDENCE_ORDER.indexOf(confidence) - 1)
  ];
}

function playerSnapshot(player) {
  return { name: player.name, player_id: player.player_id ?? null };
}

function missingData(a, b) {
  const history = historyValue(a) == null || historyValue(b) == null;
  const power = numberValue(a.power) == null || numberValue(b.power) == null;
  const qualifier =
    a.qualifier_rank == null ||
    b.qualifier_rank == null ||
    timeValue(a.qualifier_time) == null ||
    timeValue(b.qualifier_time) == null;
  return [
    history && "history",
    power && "power",
    qualifier && "qualifier",
  ].filter(Boolean);
}

export function adviseMatch(
  a,
  b,
  { round, slot, dependsOn = [], upstreamForced = false } = {},
) {
  const metrics = [
    {
      basis: "previous_performance",
      label: "上屆進度",
      result: compareMetric(a, b, historyValue),
    },
    {
      basis: "previous_performance",
      label: "上屆時間",
      result: compareMetric(
        a,
        b,
        (player) => timeValue(player.prev_time),
        true,
      ),
      onlyWhenHistoryTied: true,
    },
    {
      basis: "power",
      label: "本屆戰力",
      result: compareMetric(a, b, (player) => numberValue(player.power)),
    },
    {
      basis: "qualifier_rank",
      label: "資格賽排名",
      result: compareMetric(a, b, (player) => player.qualifier_rank, true),
    },
    {
      basis: "qualifier_time",
      label: "資格賽時間",
      result: compareMetric(
        a,
        b,
        (player) => timeValue(player.qualifier_time),
        true,
      ),
    },
  ];
  const history = metrics[0].result;
  const historyTime = metrics[1].result;
  const candidates = history.side
    ? [metrics[0], ...metrics.slice(2)]
    : historyTime.side
      ? [metrics[1], ...metrics.slice(2)]
      : metrics.slice(2);
  const decisive = candidates.find((metric) => metric.result.side) ?? {
    basis: "fixed_slot",
    label: "固定籤位",
    result: { side: "p1" },
  };
  const selectedSide = decisive.result.side;
  const selected = selectedSide === "p1" ? a : b;
  const lowerMetrics = metrics
    .slice(
      metrics.findIndex(
        (metric) =>
          metric.basis === decisive.basis && metric.label === decisive.label,
      ) + 1,
    )
    .filter((metric) => metric.result.side);
  const conflicts = lowerMetrics.filter(
    (metric) => metric.result.side !== selectedSide,
  );
  const supports = lowerMetrics.filter(
    (metric) => metric.result.side === selectedSide,
  );
  const forced = decisive.basis !== "previous_performance";
  let confidence =
    decisive.basis === "fixed_slot"
      ? "low"
      : forced
        ? "medium"
        : supports.length
          ? "high"
          : "medium";
  if (conflicts.length) confidence = lowerConfidence(confidence);
  if (upstreamForced) confidence = lowerConfidence(confidence);
  const risk = [
    conflicts.length &&
      `${conflicts.map((metric) => metric.label).join("、")}方向相反`,
    upstreamForced && "上游含強制選擇",
  ]
    .filter(Boolean)
    .join("；");
  return {
    round,
    slot,
    p1: playerSnapshot(a),
    p2: playerSnapshot(b),
    selected_side: selectedSide,
    confidence,
    basis: decisive.basis,
    reason: `${decisive.label}選擇 ${selected.name}${risk ? `；${risk}` : ""}`,
    evidence: {
      previous_performance: {
        p1: {
          progress: a.prev_best ?? a.prev_progress ?? null,
          time: a.prev_time ?? null,
        },
        p2: {
          progress: b.prev_best ?? b.prev_progress ?? null,
          time: b.prev_time ?? null,
        },
      },
      power: { p1: a.power ?? null, p2: b.power ?? null },
      qualifier: {
        p1: { rank: a.qualifier_rank ?? null, time: a.qualifier_time ?? null },
        p2: { rank: b.qualifier_rank ?? null, time: b.qualifier_time ?? null },
      },
    },
    missing: missingData(a, b),
    forced,
    depends_on: dependsOn,
    selected,
  };
}

function enrichSide(side, players) {
  if (Number.isInteger(side.draw_index) && players[side.draw_index]) {
    return { ...players[side.draw_index], ...side };
  }
  if (side.player_id) {
    const matched = players.find(
      (player) => player.player_id === side.player_id,
    );
    if (matched) return { ...matched, ...side };
  }
  const named = players.filter((player) => player.name === side.name);
  if (named.length === 1) return { ...named[0], ...side };
  return side;
}

export function generatePrediction(
  season,
  matchup,
  {
    publishedAt = new Date().toISOString(),
    source = "snapshot",
    status = "published",
  } = {},
) {
  if (matchup.season_id !== season.id)
    throw new Error(
      `matchup season_id ${matchup.season_id} 與賽事 ${season.id} 不符`,
    );
  const groupIds = matchup.groups.map((group) => group.id);
  if (
    new Set(groupIds).size !== 8 ||
    ![1, 2, 3, 4, 5, 6, 7, 8].every((id) => groupIds.includes(id))
  )
    throw new Error("matchup 必須包含不重複的第 1–8 組");
  for (const group of matchup.groups) {
    const slots = group.matches.map((match) => match.slot);
    if (
      new Set(slots).size !== 4 ||
      !["A", "B", "C", "D"].every((slot) => slots.includes(slot))
    )
      throw new Error(`第 ${group.id} 組必須包含不重複的 A、B、C、D`);
  }
  const groups = matchup.groups.map((inputGroup) => {
    const seasonGroup = season.groups.find(
      (group) => group.id === inputGroup.id,
    );
    if (!seasonGroup)
      throw new Error(`賽事缺少第 ${inputGroup.id} 組 players 資料`);
    const picks = [];
    const winners = new Map();
    const forced = new Map();
    for (const match of inputGroup.matches) {
      const a = enrichSide(match.p1, seasonGroup.players ?? []);
      const b = enrichSide(match.p2, seasonGroup.players ?? []);
      const pick = adviseMatch(a, b, { round: "R1", slot: match.slot });
      picks.push(pick);
      winners.set(match.slot, pick.selected);
      forced.set(match.slot, pick.forced);
    }
    for (const [slot, sources] of [
      ["upper", ["A", "C"]],
      ["lower", ["B", "D"]],
    ]) {
      const pick = adviseMatch(
        winners.get(sources[0]),
        winners.get(sources[1]),
        {
          round: "R2",
          slot,
          dependsOn: sources,
          upstreamForced: sources.some((sourceSlot) => forced.get(sourceSlot)),
        },
      );
      picks.push(pick);
      winners.set(slot, pick.selected);
      forced.set(
        slot,
        pick.forced || sources.some((sourceSlot) => forced.get(sourceSlot)),
      );
    }
    const finalSources = ["upper", "lower"];
    picks.push(
      adviseMatch(winners.get("upper"), winners.get("lower"), {
        round: "決賽",
        slot: "final",
        dependsOn: finalSources,
        upstreamForced: finalSources.some((sourceSlot) =>
          forced.get(sourceSlot),
        ),
      }),
    );
    return {
      id: inputGroup.id,
      picks: picks.map(({ selected: _selected, ...pick }) => pick),
    };
  });
  const entrants = season.groups.flatMap((group) => group.players ?? []);
  return {
    season_id: season.id,
    status,
    source,
    published_at: publishedAt,
    ruleset: "star-cup-v1",
    source_document: null,
    coverage: {
      power: {
        available: entrants.filter(
          (player) => numberValue(player.power) != null,
        ).length,
        total: 64,
      },
      qualifier: {
        available: entrants.filter(
          (player) =>
            player.qualifier_rank != null &&
            timeValue(player.qualifier_time) != null,
        ).length,
        total: 64,
      },
      history: {
        available: entrants.filter((player) => historyValue(player) != null)
          .length,
        total: 64,
      },
    },
    groups,
  };
}
