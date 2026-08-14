import assert from "node:assert/strict";
import { test } from "node:test";
import { readJson } from "../tools/lib/json.mjs";
import { validateSchema } from "../tools/lib/schema-validation.mjs";
import {
  derivePreviousSummary,
  predictionScore,
  validateEnchantColors,
  validatePlayerReferences,
  validatePrediction,
  validateSeasonRelations,
  validateTournamentResults,
} from "../tools/lib/domain.mjs";
import { dataPath } from "../tools/lib/repo.mjs";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { atomicWriteJson } from "../tools/lib/json.mjs";
import { adviseMatch, generatePrediction } from "../tools/lib/prediction.mjs";

const fixtures = path.resolve("test", "fixtures");
for (const name of ["cups", "season", "roster", "players"]) {
  test(`${name} schema accepts legal and rejects illegal fixture with location`, async () => {
    assert.deepEqual(
      validateSchema(
        name,
        await readJson(path.join(fixtures, `${name}.valid.json`)),
      ),
      [],
    );
    const errors = validateSchema(
      name,
      await readJson(path.join(fixtures, `${name}.invalid.json`)),
      `${name}.invalid.json`,
    );
    assert.ok(errors.length > 0);
    assert.ok(errors.every((e) => e.file && e.location));
  });
}

test("published predictions have 56 coherent picks and fully settled historical scores", async () => {
  const seasonIds = new Set(
    await readJson(dataPath("star-cup", "seasons.json")),
  );
  const expected = new Map([
    ["2026-07-03", 39],
    ["2026-07-17", 40],
    ["2026-07-31", 41],
  ]);
  for (const [id, correct] of expected) {
    const prediction = await readJson(
      dataPath("predictions", "star-cup", `${id}.json`),
    );
    const season = await readJson(dataPath("star-cup", `${id}.json`));
    assert.deepEqual(validateSchema("prediction", prediction), []);
    assert.deepEqual(validatePrediction(prediction, seasonIds), []);
    assert.deepEqual(
      {
        correct: predictionScore(prediction, season).correct,
        settled: predictionScore(prediction, season).settled,
      },
      { correct, settled: 56 },
    );
  }
});

test("prediction validation rejects duplicate slots and broken advancement", async () => {
  const value = await readJson(
    dataPath("predictions", "star-cup", "2026-07-31.json"),
  );
  const seasonIds = new Set(["2026-07-31"]);
  const duplicate = structuredClone(value);
  duplicate.groups[0].picks[1].slot = "A";
  assert.ok(
    validatePrediction(duplicate, seasonIds).some((error) =>
      error.location.includes("/groups/0/picks"),
    ),
  );
  const broken = structuredClone(value);
  broken.groups[0].picks[4].p1.name = "不存在的晉級者";
  assert.ok(
    validatePrediction(broken, seasonIds).some((error) =>
      error.message.includes("上游預測晉級者"),
    ),
  );
});

test("betting rules keep higher-priority history over power and mark fallbacks forced", () => {
  const historical = {
    name: "歷史強者",
    prev_best: "8強",
    prev_time: "02:00.0",
    power: "1M",
    qualifier_rank: 10,
    qualifier_time: "04:10.0",
  };
  const powerful = {
    name: "戰力強者",
    power: "100M",
    qualifier_rank: 1,
    qualifier_time: "03:00.0",
  };
  const historyPick = adviseMatch(historical, powerful, {
    round: "R1",
    slot: "A",
  });
  assert.equal(historyPick.selected_side, "p1");
  assert.equal(historyPick.basis, "previous_performance");
  assert.equal(historyPick.forced, false);
  assert.equal(
    historyPick.confidence,
    "medium",
    "低順位反向時降低一級信心，不翻案",
  );

  const powerPick = adviseMatch(
    { name: "A", power: "2M" },
    { name: "B", power: "1M" },
    { round: "R1", slot: "B" },
  );
  assert.equal(powerPick.selected_side, "p1");
  assert.equal(powerPick.basis, "power");
  assert.equal(powerPick.forced, true);
  assert.ok(powerPick.missing.includes("history"));

  const fixed = adviseMatch(
    { name: "A" },
    { name: "B" },
    { round: "R1", slot: "C" },
  );
  assert.equal(fixed.selected_side, "p1");
  assert.equal(fixed.basis, "fixed_slot");
  assert.equal(fixed.confidence, "low");
});

test("prediction generator creates a validated 8 by 7 snapshot with dependencies", () => {
  const groups = Array.from({ length: 8 }, (_, groupIndex) => {
    const players = Array.from({ length: 8 }, (_, playerIndex) => ({
      name: `G${groupIndex + 1}P${playerIndex + 1}`,
      power: `${20 - playerIndex}M`,
      qualifier_rank: groupIndex * 8 + playerIndex + 1,
      qualifier_time: `04:${String(groupIndex * 8 + playerIndex).padStart(2, "0")}.0`,
    }));
    return { id: groupIndex + 1, players };
  });
  const season = { id: "2026-08-14", groups };
  const matchup = {
    season_id: season.id,
    groups: groups.map((group) => ({
      id: group.id,
      matches: ["A", "B", "C", "D"].map((slot, index) => ({
        slot,
        p1: { name: group.players[index * 2].name },
        p2: { name: group.players[index * 2 + 1].name },
      })),
    })),
  };
  const prediction = generatePrediction(season, matchup, {
    publishedAt: "2026-08-14T00:00:00+08:00",
  });
  assert.equal(prediction.groups.flatMap((group) => group.picks).length, 56);
  assert.deepEqual(
    prediction.groups[0].picks.find((pick) => pick.slot === "upper").depends_on,
    ["A", "C"],
  );
  assert.deepEqual(validateSchema("matchup", matchup), []);
  assert.deepEqual(validateSchema("prediction", prediction), []);
  assert.deepEqual(validatePrediction(prediction, new Set([season.id])), []);
});

const side = (name) => ({ name });
const match = (round, slot, a, b, winner) => ({
  round,
  slot,
  p1: side(a),
  p2: side(b),
  winner,
  loser: winner === a ? b : a,
});
const validGroup = {
  id: 1,
  champion: "A",
  runner_up: "E",
  players: [{ name: "A", player_id: "1", qualifier_time: "01:02.3" }],
  matches: [
    match("R1", "A", "A", "B", "A"),
    match("R1", "B", "C", "D", "C"),
    match("R1", "C", "E", "F", "E"),
    match("R1", "D", "G", "H", "G"),
    match("R2", "upper", "A", "C", "A"),
    match("R2", "lower", "E", "G", "E"),
    match("決賽", "final", "A", "E", "A"),
  ],
};
test("bracket advancement accepts legal and rejects illegal cases", () => {
  assert.deepEqual(validateTournamentResults({ groups: [validGroup] }), []);
  const broken = structuredClone(validGroup);
  broken.matches[4].p1.name = "B";
  assert.ok(
    validateTournamentResults({ groups: [broken] }).some((e) =>
      e.location.includes("/groups/1"),
    ),
  );
});
test("grand finals reuse bracket validation and require eight group champions", () => {
  const groups = ["A", "C", "E", "G", "I", "K", "M", "O"].map(
    (champion, index) => ({ id: index + 1, champion }),
  );
  const bracket = [
    match("R1", "A", "A", "C", "A"),
    match("R1", "B", "E", "G", "E"),
    match("R1", "C", "I", "K", "I"),
    match("R1", "D", "M", "O", "M"),
    match("R2", "upper", "A", "E", "A"),
    match("R2", "lower", "I", "M", "I"),
    match("決賽", "final", "A", "I", "A"),
  ];
  const ranks = [1, 2, 3, 3, 5, 5, 5, 5];
  const results = ["A", "I", "E", "M", "C", "G", "K", "O"].map(
    (name, index) => ({ rank: ranks[index], name }),
  );
  const season = { groups, champion: "A", grand_finals: { results, bracket } };
  assert.deepEqual(validateTournamentResults(season), []);
  season.champion = "I";
  assert.ok(
    validateTournamentResults(season).some(
      (error) => error.location === "/grand_finals/bracket",
    ),
  );
});
test("previous summary derives only from player_id and preserves legacy snapshots", () => {
  assert.deepEqual(derivePreviousSummary({ groups: [validGroup] }, "1"), {
    prev_best: "1強",
    prev_time: "01:02.3",
  });
  assert.equal(derivePreviousSummary({ groups: [validGroup] }, null), null);
  assert.equal(
    derivePreviousSummary({ groups: [validGroup] }, "missing"),
    null,
  );
});
test("season period and id relations accept legal and reject illegal cases", async () => {
  const valid = await readJson(path.join(fixtures, "season.valid.json"));
  assert.deepEqual(validateSeasonRelations(valid), []);
  assert.ok(
    validateSeasonRelations({
      ...valid,
      knockout_period: ["2026-01-03", "2026-01-09"],
    }).length,
  );
  assert.ok(
    validateSeasonRelations({
      ...valid,
      qualifier_period: ["2026-01-02", "2026-01-04"],
    }).length,
  );
});
test("player references accept registered IDs and reject unknown IDs with location", () => {
  assert.deepEqual(
    validatePlayerReferences([{ player_id: "1" }], new Set(["1"])),
    [],
  );
  const errors = validatePlayerReferences([{ player_id: "2" }], new Set(["1"]));
  assert.equal(errors[0].location, "/players/0/player_id");
});
test("enchant colors accept consistent entries and reject conflicts", () => {
  assert.deepEqual(
    validateEnchantColors([
      { enchants: [{ text: "詞條", color: "紅" }] },
      { enchants: [{ text: "詞條", color: "紅" }] },
    ]),
    [],
  );
  assert.ok(
    validateEnchantColors([
      { enchants: [{ text: "詞條", color: "紅" }] },
      { enchants: [{ text: "詞條", color: "黃" }] },
    ]).length,
  );
});
test("all committed data passes contract validator prerequisites", async () => {
  assert.ok(Array.isArray(await readJson(dataPath("cups.json"))));
});
test("failed validation leaves the original JSON intact", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "archero2-atomic-"));
  const file = path.join(dir, "data.json");
  try {
    await writeFile(file, '{"original":true}\n');
    await assert.rejects(
      atomicWriteJson(
        file,
        { replacement: true },
        {
          validate: async () => {
            throw new Error("invalid");
          },
        },
      ),
    );
    assert.equal(await readFile(file, "utf8"), '{"original":true}\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
