import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJson } from '../tools/lib/json.mjs';
import { validateSchema } from '../tools/lib/schema-validation.mjs';
import { derivePreviousSummary, validateEnchantColors, validatePlayerReferences, validateSeasonRelations, validateTournamentResults } from '../tools/lib/domain.mjs';
import { dataPath } from '../tools/lib/repo.mjs';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { atomicWriteJson } from '../tools/lib/json.mjs';

const fixtures = path.resolve('test', 'fixtures');
for (const name of ['cups', 'season', 'roster', 'players']) {
  test(`${name} schema accepts legal and rejects illegal fixture with location`, async () => {
    assert.deepEqual(validateSchema(name, await readJson(path.join(fixtures, `${name}.valid.json`))), []);
    const errors = validateSchema(name, await readJson(path.join(fixtures, `${name}.invalid.json`)), `${name}.invalid.json`);
    assert.ok(errors.length > 0); assert.ok(errors.every((e) => e.file && e.location));
  });
}

const side = (name) => ({ name });
const match = (round, slot, a, b, winner) => ({ round, slot, p1: side(a), p2: side(b), winner, loser: winner === a ? b : a });
const validGroup = { id: 1, champion: 'A', runner_up: 'E', players: [{ name: 'A', player_id: '1', qualifier_time: '01:02.3' }], matches: [
  match('R1','A','A','B','A'), match('R1','B','C','D','C'), match('R1','C','E','F','E'), match('R1','D','G','H','G'),
  match('R2','upper','A','C','A'), match('R2','lower','E','G','E'), match('決賽','final','A','E','A'),
] };
test('bracket advancement accepts legal and rejects illegal cases', () => {
  assert.deepEqual(validateTournamentResults({ groups: [validGroup] }), []);
  const broken = structuredClone(validGroup); broken.matches[4].p1.name = 'B';
  assert.ok(validateTournamentResults({ groups: [broken] }).some((e) => e.location.includes('/groups/1')));
});
test('previous summary derives only from player_id and preserves legacy snapshots', () => {
  assert.deepEqual(derivePreviousSummary({ groups: [validGroup] }, '1'), { prev_best: '1強', prev_time: '01:02.3' });
  assert.equal(derivePreviousSummary({ groups: [validGroup] }, null), null);
  assert.equal(derivePreviousSummary({ groups: [validGroup] }, 'missing'), null);
});
test('season period and id relations accept legal and reject illegal cases', async () => {
  const valid = await readJson(path.join(fixtures, 'season.valid.json'));
  assert.deepEqual(validateSeasonRelations(valid), []);
  assert.ok(validateSeasonRelations({ ...valid, knockout_period: ['2026-01-03', '2026-01-09'] }).length);
  assert.ok(validateSeasonRelations({ ...valid, qualifier_period: ['2026-01-02', '2026-01-04'] }).length);
});
test('player references accept registered IDs and reject unknown IDs with location', () => {
  assert.deepEqual(validatePlayerReferences([{ player_id: '1' }], new Set(['1'])), []);
  const errors = validatePlayerReferences([{ player_id: '2' }], new Set(['1']));
  assert.equal(errors[0].location, '/players/0/player_id');
});
test('enchant colors accept consistent entries and reject conflicts', () => {
  assert.deepEqual(validateEnchantColors([{ enchants: [{ text: '詞條', color: '紅' }] }, { enchants: [{ text: '詞條', color: '紅' }] }]), []);
  assert.ok(validateEnchantColors([{ enchants: [{ text: '詞條', color: '紅' }] }, { enchants: [{ text: '詞條', color: '黃' }] }]).length);
});
test('all committed data passes contract validator prerequisites', async () => {
  assert.ok(Array.isArray(await readJson(dataPath('cups.json'))));
});
test('failed validation leaves the original JSON intact', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'archero2-atomic-'));
  const file = path.join(dir, 'data.json');
  try {
    await writeFile(file, '{"original":true}\n');
    await assert.rejects(atomicWriteJson(file, { replacement: true }, { validate: async () => { throw new Error('invalid'); } }));
    assert.equal(await readFile(file, 'utf8'), '{"original":true}\n');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
