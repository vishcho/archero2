// 由 groups[].matches 建立淘汰賽對陣的顯示模型。
//
// 為什麼需要這層：groups[].players 的陣列位置「不是」對陣位置。實測四屆資料，
// 各屆採用的排列規則並不相同（2026-07-31 全 8 組用 A:[0,2] B:[4,6] C:[1,3] D:[5,7]，
// 2026-07-03 多數組用 [0,1][2,3][4,5][6,7]），因此任何索引規則都必然畫錯某些屆次。
// matches[].round / matches[].slot 是唯一能同時解釋所有屆次的來源。
//
// players 僅用來補 matches 沒有的顯示屬性（prev_best、qualifier_rank、flag…），
// 且關聯規則刻意保守：寧可降級顯示，也不猜測身分。見 attachPlayer()。
//
// 本檔以傳統 script 載入（無建置流程），結尾同時支援 node --test 匯入。

const BRACKET_SLOTS = {
  R1: ['A', 'B', 'C', 'D'],
  R2: ['upper', 'lower'],
  決賽: ['final'],
};

// R1 勝者流向哪一場 R2——供驗證與 diagnostics 使用，不用來決定畫面結構。
const R2_SOURCE_SLOTS = { upper: ['A', 'B'], lower: ['C', 'D'] };

// match side 與 group player 的關聯規則（見 tmp/architecture-review.md 共識方案）：
//   1. 兩邊都有 player_id → 只以 player_id 關聯。
//   2. side 無 player_id 且名稱在該組恰好一筆 → 以名稱關聯。
//   3. 名稱對應多筆 → 不得以位置/戰力/時間猜測。
//   7. 歧義時走降級路徑（用 side 自身資料），並標記 ambiguous。
//   4. 完全找不到 → 降級顯示，標記 unmatched。
//
// 回傳 { player, match: 'id'|'unique'|'ambiguous'|'unmatched', candidates }
function matchSideToPlayer(side, players) {
  const list = players || [];
  if (side && side.player_id) {
    const byId = list.filter((p) => p.player_id === side.player_id);
    if (byId.length === 1) return { player: byId[0], match: 'id', candidates: byId };
  }
  const named = list.filter((p) => p.name === (side && side.name));
  if (named.length === 1) return { player: named[0], match: 'unique', candidates: named };
  if (named.length > 1) return { player: null, match: 'ambiguous', candidates: named };
  return { player: null, match: 'unmatched', candidates: [] };
}

// 合併 match side 與 player 屬性成一張卡片。
// side 自身的 power/time 是「該場」的實際數值，優先於 player 的資格賽數值;
// player 專屬欄位（prev_best、qualifier_rank、flag）在降級時留白，不猜測。
function buildCard(side, players, context, diagnostics) {
  if (!side) return null;
  const { player, match, candidates } = matchSideToPlayer(side, players);
  if (match === 'ambiguous' || match === 'unmatched') {
    diagnostics.push({
      severity: 'warning',
      kind: match === 'ambiguous' ? 'ambiguous-identity' : 'unmatched-name',
      round: context.round,
      slot: context.slot,
      name: side.name,
      candidates: candidates.map((p) => p.player_id || null),
      message: match === 'ambiguous'
        ? `「${side.name}」在該組對應 ${candidates.length} 位選手，無法確定身分，改用該場資料顯示`
        : `「${side.name}」不在該組 players 中，改用該場資料顯示`,
    });
  }
  return {
    name: side.name,
    // side.power 是該場戰力快照；缺少時退回 player 的資格賽戰力。
    power: side.power || (player && player.power) || null,
    time: side.time != null ? side.time : null,
    progress: side.progress != null ? side.progress : null,
    qualifier_time: (player && player.qualifier_time) || null,
    qualifier_rank: player && player.qualifier_rank != null ? player.qualifier_rank : null,
    prev_best: (player && (player.prev_best || player.prev_progress)) || null,
    flag: (player && player.flag) || null,
    player_id: (player && player.player_id) || (side && side.player_id) || null,
    identity: match,
  };
}

// 一場比賽 → 顯示模型。winner/loser 是純字串，同名時無法辨識身分，
// 因此 winner 只在能唯一判定時標記，其餘標為 unverifiable（共識規則 7d）。
function buildMatch(match, players, diagnostics) {
  if (!match) return null;
  const context = { round: match.round, slot: match.slot };
  const p1 = buildCard(match.p1, players, context, diagnostics);
  const p2 = buildCard(match.p2, players, context, diagnostics);
  const sameName = p1 && p2 && p1.name === p2.name;
  let winnerSide = null;
  if (!sameName) {
    if (p1 && match.winner === p1.name) winnerSide = 'p1';
    else if (p2 && match.winner === p2.name) winnerSide = 'p2';
  }
  // 同名對戰時 winner 字串無法區分是誰勝出——現行 schema 下無解，
  // 必須明確標記而非靜默選一邊（見 2026-07-31 第 1 組 R2/upper 兩位「牛大力」）。
  const unverifiable = sameName;
  if (unverifiable) {
    diagnostics.push({
      severity: 'warning',
      kind: 'unverifiable-identity',
      round: match.round,
      slot: match.slot,
      name: match.winner,
      message: `${match.round}/${match.slot} 雙方同名「${match.winner}」，缺 player_id 時無法判定勝者身分`,
    });
  }
  return {
    round: match.round,
    slot: match.slot,
    p1,
    p2,
    winner: match.winner || null,
    loser: match.loser || null,
    winnerSide,
    unverifiableIdentity: unverifiable,
  };
}

// group → bracket 顯示模型。純函式，不修改輸入，不讀取 g.players[i] 決定任何對戰關係。
function buildBracketViewModel(group) {
  const diagnostics = [];
  const players = (group && group.players) || [];
  const matches = (group && group.matches) || [];

  const bySlot = {};
  for (const round of Object.keys(BRACKET_SLOTS)) bySlot[round] = {};
  for (const match of matches) {
    if (!match || !BRACKET_SLOTS[match.round]) continue;
    if (BRACKET_SLOTS[match.round].indexOf(match.slot) === -1) continue;
    // 同 round 同 slot 重複時保留第一筆並記錄；validator 會另行攔截。
    if (bySlot[match.round][match.slot]) {
      diagnostics.push({
        severity: 'warning',
        kind: 'duplicate-slot',
        round: match.round,
        slot: match.slot,
        message: `${match.round}/${match.slot} 有多筆比賽，僅顯示第一筆`,
      });
      continue;
    }
    bySlot[match.round][match.slot] = match;
  }

  const r1 = BRACKET_SLOTS.R1.map((slot) => {
    const built = buildMatch(bySlot.R1[slot], players, diagnostics);
    if (!built) {
      diagnostics.push({
        severity: 'warning',
        kind: 'missing-slot',
        round: 'R1',
        slot,
        message: `缺少 R1/${slot}`,
      });
    }
    return built || { round: 'R1', slot, p1: null, p2: null, winner: null, loser: null, winnerSide: null, unverifiableIdentity: false };
  });

  const r2 = BRACKET_SLOTS.R2.map((slot) => {
    const built = buildMatch(bySlot.R2[slot], players, diagnostics);
    if (!built) {
      diagnostics.push({
        severity: 'warning',
        kind: 'missing-slot',
        round: 'R2',
        slot,
        message: `缺少 R2/${slot}`,
      });
    }
    return built || { round: 'R2', slot, p1: null, p2: null, winner: null, loser: null, winnerSide: null, unverifiableIdentity: false };
  });

  const final = buildMatch(bySlot['決賽'].final, players, diagnostics);
  if (!final) {
    diagnostics.push({ severity: 'warning', kind: 'missing-slot', round: '決賽', slot: 'final', message: '缺少決賽' });
  }

  // 未出現在任何 R1 的 group player——通常代表該屆 players 與 matches 尚未對齊。
  const r1Names = r1.flatMap((m) => [m.p1 && m.p1.name, m.p2 && m.p2.name]).filter(Boolean);
  for (const player of players) {
    if (r1Names.indexOf(player.name) === -1) {
      diagnostics.push({
        severity: 'warning',
        kind: 'player-not-in-r1',
        round: 'R1',
        slot: null,
        name: player.name,
        candidates: [player.player_id || null],
        message: `選手「${player.name}」未出現在任何 R1 比賽`,
      });
    }
  }

  return {
    groupId: group && group.id != null ? group.id : null,
    r1,
    r2,
    final,
    // champion 以決賽結果為準；缺決賽時退回 group.champion。
    champion: (final && final.winner) || (group && group.champion) || null,
    championUnverifiable: !!(final && final.unverifiableIdentity),
    diagnostics,
    hasBracket: matches.length > 0,
  };
}

// 每位 group player 在 R1 屬於哪一個 slot（season.html 的「場次」欄用）。
// 同樣依 matches 判定，不用陣列索引。回傳 Map<player, slot|null>，
// 名稱歧義或找不到時為 null——寧可顯示「—」，也不標錯場次。
function playerSlotMap(group) {
  const model = buildBracketViewModel(group);
  const players = (group && group.players) || [];
  const result = new Map();
  for (const player of players) {
    const sameName = players.filter((p) => p.name === player.name);
    let slot = null;
    for (const match of model.r1) {
      for (const card of [match.p1, match.p2]) {
        if (!card) continue;
        const byId = player.player_id && card.player_id === player.player_id;
        const byName = card.name === player.name && sameName.length === 1;
        if (byId || byName) slot = match.slot;
      }
    }
    result.set(player, slot);
  }
  return result;
}

// R1 勝者是否確實出現在對應的 R2——供 audit tool（PR 2）複用，畫面不依賴它。
function bracketAdvancementIssues(model) {
  const issues = [];
  for (const r2 of model.r2) {
    const sources = R2_SOURCE_SLOTS[r2.slot] || [];
    const expected = sources
      .map((slot) => model.r1.find((m) => m.slot === slot))
      .filter(Boolean)
      .map((m) => m.winner)
      .filter(Boolean);
    const actual = [r2.p1 && r2.p1.name, r2.p2 && r2.p2.name].filter(Boolean);
    for (const name of expected) {
      if (actual.indexOf(name) === -1) {
        issues.push({ round: 'R2', slot: r2.slot, name, message: `R1 勝者 ${name} 未出現在 R2/${r2.slot}` });
      }
    }
  }
  return issues;
}

// 本檔以傳統 <script> 載入（頁面無建置流程、無 module 系統），因此不使用 export。
// 測試與 PR 2 的 audit tool 透過 test/helpers/load-browser-script.mjs 以 vm 載入同一份
// 實作，確保畫面與稽核結果不會有兩套會漂移的邏輯。
