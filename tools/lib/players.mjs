export function normalizePlayerName(value) {
  return value.replace(/[丨|ｌI]/g, '|').replace(/ᴬ/g, 'A').replace(/ᴷ/g, 'K')
    .replace(/ᶠ/g, 'f').replace(/ˣ/g, 'x').replace(/[\s^]/g, '').toLowerCase();
}

export function buildPlayerIndex(players) {
  const byId = new Map(); const byName = new Map(); const byNormalizedName = new Map();
  for (const player of Object.values(players)) {
    byId.set(player.player_id, player);
    for (const name of [...player.names, ...(player.ocr_variants ?? [])]) {
      if (!byName.has(name)) byName.set(name, []); byName.get(name).push(player);
      const key = normalizePlayerName(name);
      if (!byNormalizedName.has(key)) byNormalizedName.set(key, []);
      if (!byNormalizedName.get(key).includes(player)) byNormalizedName.get(key).push(player);
    }
  }
  return { byId, byName, byNormalizedName };
}
