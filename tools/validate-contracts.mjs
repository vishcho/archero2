import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { readJson } from './lib/json.mjs';
import { dataPath } from './lib/repo.mjs';
import { validateSchema } from './lib/schema-validation.mjs';
import { validateEnchantColors, validatePlayerReferences, validatePrediction, validateSeasonRelations, validateTournamentResults } from './lib/domain.mjs';
import { printDiagnostics } from './lib/diagnostics.mjs';

const diagnostics = [];
const cupsFile = dataPath('cups.json');
const playersFile = dataPath('players.json');
const cups = await readJson(cupsFile); const players = await readJson(playersFile);
diagnostics.push(...validateSchema('cups', cups, cupsFile), ...validateSchema('players', players, playersFile));
const knownIds = new Set(Object.keys(players));

for (const cup of cups) {
  const dir = dataPath(cup.slug);
  for (const entry of await readdir(dir)) {
    if (entry === 'seasons.json' || !entry.endsWith('.json')) continue;
    const file = path.join(dir, entry); const value = await readJson(file);
    diagnostics.push(...validateSchema(cup.schema, value, file));
    if (value.id !== path.basename(entry, '.json')) diagnostics.push({ severity: 'error', file, location: '/id', message: 'id 與檔名不符' });
    if (cup.schema === 'season') {
      diagnostics.push(...validateSeasonRelations(value, file));
      for (const [gi, group] of (value.groups ?? []).entries()) diagnostics.push(...validatePlayerReferences(group.players ?? [], knownIds, file, `/groups/${gi}/players`));
      diagnostics.push(...validateTournamentResults(value, file));
    } else {
      for (const [pi, player] of (value.roster ?? []).entries()) {
        // Roster ID comes directly from the game UI and may legitimately predate a profile capture.
        // Keep that legacy-compatible case visible without forcing synthetic players.json records.
        if (player.player_id && !knownIds.has(player.player_id)) diagnostics.push({ severity: 'warning', file, location: `/roster/${pi}/player_id`, message: `player_id ${player.player_id} 尚無 players.json 名片紀錄` });
      }
      diagnostics.push(...validateEnchantColors(value.roster ?? [], file));
    }
  }
}

const predictionIds = await readJson(dataPath('predictions', 'star-cup', 'seasons.json'));
const seasonIds = new Set(await readJson(dataPath('star-cup', 'seasons.json')));
for (const id of predictionIds) {
  const file = dataPath('predictions', 'star-cup', `${id}.json`);
  const value = await readJson(file);
  diagnostics.push(...validateSchema('prediction', value, file), ...validatePrediction(value, seasonIds, file));
}

printDiagnostics(diagnostics);
if (diagnostics.some((d) => d.severity === 'error')) process.exit(1);
console.log('JSON Schema 與跨檔案資料契約驗證通過');
