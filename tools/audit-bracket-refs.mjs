#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadBrowserScript } from "../test/helpers/load-browser-script.mjs";

const { buildBracketViewModel } = await loadBrowserScript("js/domain.js");
const json = process.argv.includes("--json");
const dataDir = path.join("data", "star-cup");
const baseline = JSON.parse(
  await readFile(path.join("tools", "bracket-audit-baseline.json"), "utf8"),
);
const ids = JSON.parse(
  await readFile(path.join(dataDir, "seasons.json"), "utf8"),
);
const classifications = { unique: [], ambiguous: [], unmatched: [] };
const diagnostics = [];
const indexRules = [];

for (const seasonId of ids) {
  const season = JSON.parse(
    await readFile(path.join(dataDir, `${seasonId}.json`), "utf8"),
  );
  let matchingGroups = 0;
  let auditedGroups = 0;

  for (const group of season.groups || []) {
    if (!group.matches?.length) continue;
    auditedGroups += 1;
    const model = buildBracketViewModel(group);
    for (const match of [...model.r1, ...model.r2, model.final].filter(
      Boolean,
    )) {
      for (const side of [match.p1, match.p2].filter(Boolean)) {
        const classification =
          side.identity === "ambiguous"
            ? "ambiguous"
            : side.identity === "unmatched"
              ? "unmatched"
              : "unique";
        classifications[classification].push({
          season: seasonId,
          group: group.id,
          round: match.round,
          slot: match.slot,
          name: side.name,
          candidates: (group.players || [])
            .filter((player) => player.name === side.name)
            .map((player) => player.player_id)
            .filter(Boolean),
        });
      }
    }
    diagnostics.push(
      ...model.diagnostics.map((diagnostic) => ({
        season: seasonId,
        group: group.id,
        ...diagnostic,
      })),
    );

    const actualPairs = model.r1.map((match) =>
      [match.p1?.name, match.p2?.name].sort().join("\u0000"),
    );
    const legacyPairs = [0, 2, 4, 6].map((index) =>
      [group.players?.[index]?.name, group.players?.[index + 1]?.name]
        .sort()
        .join("\u0000"),
    );
    if (legacyPairs.every((pair) => actualPairs.includes(pair))) {
      matchingGroups += 1;
    }
  }
  indexRules.push({
    season: seasonId,
    matchingGroups,
    totalGroups: auditedGroups,
    differingGroups: auditedGroups - matchingGroups,
  });
}

const report = {
  counts: Object.fromEntries(
    Object.entries(classifications).map(([key, value]) => [key, value.length]),
  ),
  classifications,
  diagnostics,
  indexRules,
};
const baselineDrift = Object.entries(baseline.counts).filter(
  ([key, expected]) => report.counts[key] !== expected,
);

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Bracket references: ${report.counts.unique} unique, ` +
      `${report.counts.ambiguous} ambiguous, ${report.counts.unmatched} unmatched`,
  );
  for (const item of [
    ...classifications.ambiguous,
    ...classifications.unmatched,
  ]) {
    const candidates = item.candidates.length
      ? `; candidates: ${item.candidates.join(", ")}`
      : "";
    console.warn(
      `warning: ${item.season} g${item.group} ${item.round}/${item.slot} ` +
        `${item.name}${candidates}`,
    );
  }
  console.log("Legacy adjacent-index rule:");
  for (const item of indexRules) {
    console.log(
      `  ${item.season}: ${item.matchingGroups}/${item.totalGroups} groups match; ` +
        `${item.differingGroups} differ`,
    );
  }
}

if (baselineDrift.length) {
  console.error(
    `Bracket audit baseline drift: ${baselineDrift
      .map(
        ([key, expected]) =>
          `${key} expected ${expected}, got ${report.counts[key]}`,
      )
      .join("; ")}`,
  );
  process.exitCode = 1;
}
