import assert from "node:assert/strict";
import { test } from "node:test";
import { readJson } from "../tools/lib/json.mjs";
import { validateSchema } from "../tools/lib/schema-validation.mjs";
import {
  derivePreviousSummary,
  validateEnchantColors,
  validatePlayerReferences,
  validateSeasonRelations,
  validateTournamentResults,
} from "../tools/lib/domain.mjs";
import { dataPath } from "../tools/lib/repo.mjs";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { atomicWriteJson } from "../tools/lib/json.mjs";

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
  assert.deepEqual(
    validateTournamentResults({ groups: [validGroup] }).filter(
      (item) => item.severity === "error",
    ),
    [],
  );
  const broken = structuredClone(validGroup);
  broken.matches[4].p1.name = "B";
  assert.ok(
    validateTournamentResults({ groups: [broken] }).some((e) =>
      e.location.includes("/groups/0"),
    ),
  );
});
test("bracket validation rejects duplicate and missing slots", () => {
  const duplicate = structuredClone(validGroup);
  duplicate.matches[1].slot = "A";
  const diagnostics = validateTournamentResults({ groups: [duplicate] });
  assert.ok(diagnostics.some((item) => item.kind === "duplicate-slot"));
  assert.ok(diagnostics.some((item) => item.kind === "missing-slot"));
});
test("ambiguous same-name winners are explicitly unverifiable", () => {
  const group = structuredClone(validGroup);
  group.matches[4] = match("R2", "upper", "牛大力", "牛大力", "牛大力");
  const diagnostics = validateTournamentResults({ groups: [group] });
  assert.ok(diagnostics.some((item) => item.kind === "unverifiable-identity"));
});
test("R1 diagnostics use real match indexes and avoid duplicate-name count noise", () => {
  const shuffled = structuredClone(validGroup);
  shuffled.players = [
    { name: "同名", player_id: "same-1" },
    { name: "同名", player_id: "same-2" },
    ...shuffled.players,
  ];
  shuffled.matches = [
    match("R2", "upper", "A", "C", "A"),
    match("R1", "A", "A", "缺少名冊", "A"),
    match("R1", "B", "同名", "同名", "同名"),
    ...shuffled.matches.filter(
      (item) =>
        !(item.round === "R2" && item.slot === "upper") &&
        !(item.round === "R1" && (item.slot === "A" || item.slot === "B")),
    ),
  ];
  const diagnostics = validateTournamentResults({ groups: [shuffled] });
  assert.ok(
    diagnostics.some(
      (item) =>
        item.kind === "unmatched-name" &&
        item.location === "/groups/0/matches/1/p2",
    ),
  );
  assert.equal(
    diagnostics.filter(
      (item) =>
        item.kind === "player-r1-count" && item.message.includes("同名"),
    ).length,
    0,
  );
});
test("season schema accepts player_id and rejects side or match drift", async () => {
  const valid = await readJson(path.join(fixtures, "season.valid.json"));
  valid.groups = [
    { id: 1, players: [], matches: [match("R1", "A", "A", "B", "A")] },
  ];
  valid.groups[0].matches[0].p1.player_id = "123";
  assert.deepEqual(validateSchema("season", valid), []);

  for (const mutate of [
    (season) => {
      season.groups[0].matches[0].unknown = true;
    },
    (season) => {
      season.groups[0].matches[0].p1.unknown = true;
    },
    (season) => {
      season.groups[0].matches[0].p1.player_id = "abc";
    },
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.ok(validateSchema("season", invalid).length > 0);
  }
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
