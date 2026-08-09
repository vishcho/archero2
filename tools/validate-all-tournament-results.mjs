// Run the Star Cup bracket-consistency validator for every registered Star Cup season.
// Keeping discovery here gives humans, agents, and CI one complete validation entry point.

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const dataDir = path.join('data', 'star-cup');
const ids = JSON.parse(await readFile(path.join(dataDir, 'seasons.json'), 'utf8'));

for (const id of ids) {
  const file = path.join(dataDir, `${id}.json`);
  const result = spawnSync(
    process.execPath,
    [path.join('tools', 'validate-tournament-results.mjs'), file],
    { stdio: 'inherit' },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`${ids.length} 個明星盃賽季的淘汰賽邏輯驗證通過`);
