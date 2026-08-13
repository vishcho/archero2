// 由 groups[].matches 建立淘汰賽對陣的顯示模型。
//
// 為什麼需要這層：groups[].players 的陣列位置「不是」對陣位置。實測四屆資料，
// 各屆採用的排列規則並不相同（2026-07-31 全 8 組用 A:[0,2] B:[4,6] C:[1,3] D:[5,7]，
// 2026-07-03 多數組用 [0,1][2,3][4,5][6,7]），因此任何索引規則都必然畫錯某些屆次。
// matches[].round / matches[].slot 是唯一能同時解釋所有屆次的來源。
//
// 同理，R1 slot 與 R2 的對應關係也沒有全域規則。實測四屆 32 組：
// 2026-06-19 與 2026-07-17 全部是 A/B → upper、C/D → lower；
// 2026-07-03 與 2026-07-31 全部是 A/C → upper、B/D → lower（各 16 組）。
// 因此晉級路徑必須逐組從該組的 R1 winners 與 R2 participants 反推，見 deriveR2Sources()。
//
// players 僅用來補 matches 沒有的顯示屬性（prev_best、qualifier_rank、flag…），
// 且關聯規則刻意保守：寧可降級顯示，也不猜測身分。見 matchSideToPlayer()。
//
// 本檔以傳統 script 載入（無建置流程），測試透過 test/helpers/load-browser-script.mjs 匯入。

const BRACKET_SLOTS = {
  R1: ['A', 'B', 'C', 'D'],
  R2: ['upper', 'lower'],
  決賽: ['final'],
};

// match side 與 group player 的關聯規則（見 tmp/architecture-review.md 共識方案）：
//   1. side 有 player_id 時「只能」以 player_id 判定身分，找不到不得退回名稱——
//      同名不同人（如 2026-07-31 第 1 組兩位「牛大力」）會因此錯接。
//   2. side 無 player_id 且名稱在該組恰好一筆 → 以名稱關聯。
//   3. 名稱對應多筆 → 不得以位置/戰力/時間猜測。
//   7. 歧義時走降級路徑（用 side 自身資料），並標記 ambiguous。
//   4. 完全找不到 → 降級顯示，標記 unmatched。
//
// 回傳 { player, match: 'id'|'id-mismatch'|'id-duplicate'|'unique'|'ambiguous'|'unmatched', candidates }
function matchSideToPlayer(side, players) {
  const list = players || [];
  if (side && side.player_id) {
    const byId = list.filter((p) => p.player_id === side.player_id);
    if (byId.length === 1) return { player: byId[0], match: 'id', candidates: byId };
    // 有 ID 但對不上：不得 fallback 到名稱，否則同名者會被錯接。
    if (byId.length > 1) return { player: null, match: 'id-duplicate', candidates: byId };
    return { player: null, match: 'id-mismatch', candidates: [] };
  }
  const named = list.filter((p) => p.name === (side && side.name));
  if (named.length === 1) return { player: named[0], match: 'unique', candidates: named };
  if (named.length > 1) return { player: null, match: 'ambiguous', candidates: named };
  return { player: null, match: 'unmatched', candidates: [] };
}

// 身分無法唯一確定的關聯結果——這些一律走降級顯示路徑。
const DEGRADED_IDENTITIES = ['ambiguous', 'unmatched', 'id-mismatch', 'id-duplicate'];

function isDegradedIdentity(identity) {
  return DEGRADED_IDENTITIES.indexOf(identity) !== -1;
}

// 合併 match side 與 player 屬性成一張卡片。
// side 自身的 power/time 是「該場」的實際數值，優先於 player 的資格賽數值;
// player 專屬欄位（prev_best、qualifier_rank、flag）在降級時留白，不猜測。
function buildCard(side, players, context, diagnostics) {
  if (!side) return null;
  const { player, match, candidates } = matchSideToPlayer(side, players);
  if (isDegradedIdentity(match)) {
    const messages = {
      ambiguous: `「${side.name}」在該組對應 ${candidates.length} 位選手，無法確定身分，改用該場資料顯示`,
      unmatched: `「${side.name}」不在該組 players 中，改用該場資料顯示`,
      'id-mismatch': `「${side.name}」的 player_id ${side.player_id} 不在該組 players 中，不退回名稱比對`,
      'id-duplicate': `player_id ${side.player_id} 在該組對應 ${candidates.length} 位選手，資料有誤`,
    };
    const kinds = {
      ambiguous: 'ambiguous-identity',
      unmatched: 'unmatched-name',
      'id-mismatch': 'id-mismatch',
      'id-duplicate': 'duplicate-player-id',
    };
    diagnostics.push({
      severity: match === 'id-duplicate' ? 'error' : 'warning',
      kind: kinds[match],
      round: context.round,
      slot: context.slot,
      name: side.name,
      candidates: candidates.map((p) => p.player_id || null),
      message: messages[match],
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

  const r2Sources = deriveR2Sources(r1, r2, diagnostics);

  return {
    groupId: group && group.id != null ? group.id : null,
    r1,
    r2,
    final,
    // 該組實際的晉級路徑：{ upper: ['A','C'], lower: ['B','D'] } 之類，逐組反推而非全域假設。
    r2Sources,
    // R1 卡片由上而下的顯示順序，直接反映 r2Sources；renderer 不得自行決定排列。
    layout: buildLayout(r2Sources),
    // champion 以決賽結果為準；缺決賽時退回 group.champion。
    champion: (final && final.winner) || (group && group.champion) || null,
    championUnverifiable: !!(final && final.unverifiableIdentity),
    diagnostics,
    hasBracket: matches.length > 0,
  };
}

// 逐組反推「哪些 R1 slot 的勝者進入哪一場 R2」。
// 不使用任何全域 mapping——實測四屆資料存在兩套不同的路徑，各佔一半。
// 勝者名稱在多個 R1 slot 都出現（同名）時無法唯一歸屬，該 slot 留給 fallback 補位。
function deriveR2Sources(r1, r2, diagnostics) {
  const sources = { upper: [], lower: [] };
  const assigned = [];
  for (const r2Match of r2) {
    if (!sources[r2Match.slot]) continue;
    for (const card of [r2Match.p1, r2Match.p2]) {
      if (!card) continue;
      const from = r1.filter((m) => m.winner && m.winner === card.name);
      if (from.length === 1) {
        sources[r2Match.slot].push(from[0].slot);
        assigned.push(from[0].slot);
      } else if (from.length > 1) {
        diagnostics.push({
          severity: 'warning',
          kind: 'ambiguous-advancement',
          round: r2Match.round,
          slot: r2Match.slot,
          name: card.name,
          message: `「${card.name}」同時是 ${from.map((m) => m.slot).join('、')} 的勝者，無法確定晉級來源`,
        });
      }
    }
  }
  // 補上無法反推的 slot，維持版面完整（缺 R2 資料的進行中屆次會走到這裡）。
  for (const slot of BRACKET_SLOTS.R1) {
    if (assigned.indexOf(slot) !== -1) continue;
    const target = sources.upper.length <= sources.lower.length ? 'upper' : 'lower';
    sources[target].push(slot);
  }
  return sources;
}

// 由晉級路徑決定 R1 卡片的上下排列：
// 版面上半兩對接到 R2 upper、下半兩對接到 R2 lower，
// 因此 upper 的兩個來源 slot 必須畫在上半，lower 的畫在下半。
function buildLayout(r2Sources) {
  const upper = r2Sources.upper.slice(0, 2);
  const lower = r2Sources.lower.slice(0, 2);
  return {
    // 左上、左下、右上、右下——與 SVG 的四個 R1 配對位置一一對應。
    leftTop: upper[0] || null,
    leftBottom: lower[0] || null,
    rightTop: upper[1] || null,
    rightBottom: lower[1] || null,
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

// 每位 R1 勝者是否都出現在某一場 R2——供 audit tool（PR 2）複用，畫面不依賴它。
// 刻意不假設「A/B → upper」之類的固定路徑：實測資料存在兩套，斷言任一套都會誤報。
// 這裡只檢查可驗證的部分：勝者必須晉級到某場 R2，且每場 R2 的參賽者都要有 R1 來源。
function bracketAdvancementIssues(model) {
  const issues = [];
  const r2Names = model.r2.flatMap((m) => [m.p1 && m.p1.name, m.p2 && m.p2.name]).filter(Boolean);
  for (const r1 of model.r1) {
    if (!r1.winner) continue;
    if (r2Names.indexOf(r1.winner) === -1) {
      issues.push({ round: 'R1', slot: r1.slot, name: r1.winner, message: `R1/${r1.slot} 勝者 ${r1.winner} 未晉級任何 R2` });
    }
  }
  const r1Winners = model.r1.map((m) => m.winner).filter(Boolean);
  for (const r2 of model.r2) {
    for (const card of [r2.p1, r2.p2]) {
      if (!card) continue;
      if (r1Winners.indexOf(card.name) === -1) {
        issues.push({ round: 'R2', slot: r2.slot, name: card.name, message: `R2/${r2.slot} 的 ${card.name} 不是任何 R1 勝者` });
      }
    }
  }
  return issues;
}

// 本檔以傳統 <script> 載入（頁面無建置流程、無 module 系統），因此不使用 export。
// 測試與 PR 2 的 audit tool 透過 test/helpers/load-browser-script.mjs 以 vm 載入同一份
// 實作，確保畫面與稽核結果不會有兩套會漂移的邏輯。
