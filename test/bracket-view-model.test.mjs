import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJson } from '../tools/lib/json.mjs';
import { dataPath } from '../tools/lib/repo.mjs';
import { loadBrowserScript } from './helpers/load-browser-script.mjs';

const { buildBracketViewModel, matchSideToPlayer, bracketAdvancementIssues, playerSlotMap } =
  await loadBrowserScript('js/bracket-view-model.js');

const side = (name, extra = {}) => ({ name, ...extra });
const match = (round, slot, a, b, winner) => ({
  round, slot, p1: side(a), p2: side(b), winner, loser: winner === a ? b : a,
});

// 一組結構完整、無歧義的對陣，作為多數測試的基準。
const cleanGroup = {
  id: 1,
  players: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((name, i) => ({
    name, player_id: String(100 + i), prev_best: '8強', qualifier_rank: i + 1,
  })),
  matches: [
    match('R1', 'A', 'A', 'B', 'A'), match('R1', 'B', 'C', 'D', 'C'),
    match('R1', 'C', 'E', 'F', 'E'), match('R1', 'D', 'G', 'H', 'G'),
    match('R2', 'upper', 'A', 'C', 'A'), match('R2', 'lower', 'E', 'G', 'E'),
    match('決賽', 'final', 'A', 'E', 'A'),
  ],
};

test('bracket 結構完全由 matches 的 round/slot 決定，與 players 順序無關', () => {
  const model = buildBracketViewModel(cleanGroup);
  assert.deepEqual(model.r1.map((m) => m.slot), ['A', 'B', 'C', 'D']);
  assert.deepEqual(model.r1.map((m) => [m.p1.name, m.p2.name]), [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G', 'H']]);
  assert.deepEqual(model.r2.map((m) => m.slot), ['upper', 'lower']);
  assert.equal(model.final.slot, 'final');
  assert.equal(model.champion, 'A');
  assert.deepEqual(model.diagnostics, []);

  // 打亂 players 順序不得改變任何對戰關係——這正是舊索引規則的失效點。
  const shuffled = { ...cleanGroup, players: [...cleanGroup.players].reverse() };
  const shuffledModel = buildBracketViewModel(shuffled);
  assert.deepEqual(
    shuffledModel.r1.map((m) => [m.p1.name, m.p2.name]),
    model.r1.map((m) => [m.p1.name, m.p2.name]),
  );
});

test('matches 順序被打亂時仍依 slot 正確排列', () => {
  const scrambled = { ...cleanGroup, matches: [...cleanGroup.matches].reverse() };
  const model = buildBracketViewModel(scrambled);
  assert.deepEqual(model.r1.map((m) => m.slot), ['A', 'B', 'C', 'D']);
  assert.deepEqual(model.r1.map((m) => m.p1.name), ['A', 'C', 'E', 'G']);
});

test('唯一名稱可關聯 player 屬性', () => {
  const model = buildBracketViewModel(cleanGroup);
  const card = model.r1[0].p1;
  assert.equal(card.identity, 'unique');
  assert.equal(card.prev_best, '8強');
  assert.equal(card.qualifier_rank, 1);
  assert.equal(card.player_id, '100');
});

test('player_id 存在時優先以 id 關聯，不受同名影響', () => {
  const players = [{ name: '同名', player_id: '1', prev_best: '1強' }, { name: '同名', player_id: '2', prev_best: '64強' }];
  const hit = matchSideToPlayer({ name: '同名', player_id: '2' }, players);
  assert.equal(hit.match, 'id');
  assert.equal(hit.player.prev_best, '64強');
});

test('名稱歧義時降級顯示且不猜測身分（共識規則 3、7）', () => {
  const players = [
    { name: '牛大力', player_id: '1', prev_best: '1強', qualifier_rank: 10 },
    { name: '牛大力', player_id: '2', prev_best: '64強', qualifier_rank: 34 },
  ];
  const result = matchSideToPlayer({ name: '牛大力' }, players);
  assert.equal(result.match, 'ambiguous');
  assert.equal(result.player, null, '歧義時不得選擇任何一位 player');

  const group = { id: 1, players, matches: [match('R1', 'A', '牛大力', '對手', '牛大力')] };
  const model = buildBracketViewModel(group);
  const card = model.r1[0].p1;
  assert.equal(card.identity, 'ambiguous');
  assert.equal(card.name, '牛大力', '名稱仍須顯示');
  assert.equal(card.prev_best, null, 'player 專屬欄位必須留白，不可猜測');
  assert.equal(card.qualifier_rank, null);

  const diag = model.diagnostics.find((d) => d.kind === 'ambiguous-identity');
  assert.ok(diag, '必須產生 ambiguous diagnostic');
  assert.deepEqual(diag.candidates, ['1', '2'], 'diagnostic 須列出所有候選 player_id');
  assert.equal(diag.round, 'R1');
  assert.equal(diag.slot, 'A');
});

test('名稱找不到時以該場資料降級顯示（共識規則 4）', () => {
  const group = {
    id: 1,
    players: [{ name: '正式名稱', player_id: '1' }],
    matches: [match('R1', 'A', 'OCR差異名', '對手', 'OCR差異名')],
  };
  const model = buildBracketViewModel(group);
  const card = model.r1[0].p1;
  assert.equal(card.identity, 'unmatched');
  assert.equal(card.name, 'OCR差異名', '不得替換成相似的正式名稱');
  const diag = model.diagnostics.find((d) => d.kind === 'unmatched-name');
  assert.ok(diag);
  assert.equal(diag.name, 'OCR差異名');
});

test('雙方同名時勝者身分標記為 unverifiable（共識規則 7d）', () => {
  const players = [{ name: '牛大力', player_id: '1' }, { name: '牛大力', player_id: '2' }];
  const group = {
    id: 1, players,
    matches: [{ round: 'R2', slot: 'upper', p1: side('牛大力', { power: '42.72M' }), p2: side('牛大力', { power: '30.53M' }), winner: '牛大力', loser: '牛大力' }],
  };
  const model = buildBracketViewModel(group);
  const upper = model.r2.find((m) => m.slot === 'upper');
  assert.equal(upper.unverifiableIdentity, true);
  assert.equal(upper.winnerSide, null, '同名時不得指定勝者是 p1 或 p2');
  assert.ok(model.diagnostics.some((d) => d.kind === 'unverifiable-identity'));
  // 該場自身的 power 快照仍須保留，畫面才不會空白。
  assert.equal(upper.p1.power, '42.72M');
  assert.equal(upper.p2.power, '30.53M');
});

test('缺少 slot 與重複 slot 會被記錄而非丟失', () => {
  const partial = { id: 1, players: [], matches: [match('R1', 'A', 'A', 'B', 'A')] };
  const model = buildBracketViewModel(partial);
  assert.equal(model.r1.length, 4, '缺少的 slot 仍須佔位，避免畫面錯位');
  assert.ok(model.diagnostics.filter((d) => d.kind === 'missing-slot').length >= 4);

  const duplicated = { id: 1, players: [], matches: [match('R1', 'A', 'A', 'B', 'A'), match('R1', 'A', 'X', 'Y', 'X')] };
  const dupModel = buildBracketViewModel(duplicated);
  assert.equal(dupModel.r1[0].p1.name, 'A', '重複 slot 保留第一筆');
  assert.ok(dupModel.diagnostics.some((d) => d.kind === 'duplicate-slot'));
});

test('空 groups 與缺 matches 不丟例外', () => {
  for (const group of [undefined, {}, { id: 1 }, { id: 1, players: [], matches: [] }]) {
    const model = buildBracketViewModel(group);
    assert.equal(model.hasBracket, false);
    assert.equal(model.r1.length, 4);
  }
});

test('晉級路徑檢查可偵測 R1 勝者未進入對應 R2', () => {
  assert.deepEqual(bracketAdvancementIssues(buildBracketViewModel(cleanGroup)), []);
  const broken = structuredClone(cleanGroup);
  broken.matches[4].p1 = side('B'); // A 勝出卻由 B 進入 R2/upper
  const issues = bracketAdvancementIssues(buildBracketViewModel(broken));
  assert.ok(issues.some((i) => i.slot === 'upper' && i.name === 'A'));
});

// ── 以真實資料回歸驗證：view model 必須重現 matches，而非索引規則 ──

const SEASONS = ['2026-06-19', '2026-07-03', '2026-07-17', '2026-07-31'];

test('四屆真實資料：R1 對戰與 matches 完全一致', async () => {
  for (const id of SEASONS) {
    const season = await readJson(dataPath('star-cup', `${id}.json`));
    for (const group of season.groups) {
      const model = buildBracketViewModel(group);
      const expected = group.matches
        .filter((m) => m.round === 'R1')
        .map((m) => [m.slot, m.p1.name, m.p2.name])
        .sort();
      const actual = model.r1.map((m) => [m.slot, m.p1 && m.p1.name, m.p2 && m.p2.name]).sort();
      assert.deepEqual(actual, expected, `${id} 第 ${group.id} 組的 R1 必須完全來自 matches`);
    }
  }
});

test('2026-07-31 第 1 組：修正前用索引規則會畫錯，view model 必須正確', async () => {
  const season = await readJson(dataPath('star-cup', '2026-07-31.json'));
  const group = season.groups.find((g) => g.id === 1);
  const model = buildBracketViewModel(group);

  // 這一屆實際排列是 A:[0,2] B:[4,6] C:[1,3] D:[5,7]，與前端舊假設 [0,1][2,3][4,5][6,7] 不同。
  assert.deepEqual(
    model.r1.map((m) => [m.p1.name, m.p2.name]),
    [['牛大力', 'LD丨도하'], ['龍×이노40', 'LD丨힘'], ['牛大刃', '牛大力'], ['AK丨나츠', '單品咖啡']],
  );
  // 舊索引規則會畫出 A: 牛大力 vs 牛大刃——確認我們沒有重現該錯誤。
  assert.notDeepEqual([model.r1[0].p1.name, model.r1[0].p2.name], ['牛大力', '牛大刃']);

  // 該組有兩位同名「牛大力」且在 R2/upper 正面對決。
  const upper = model.r2.find((m) => m.slot === 'upper');
  assert.equal(upper.unverifiableIdentity, true);
  assert.equal(model.championUnverifiable, false, '決賽對手不同名，冠軍身分可判定');
  assert.equal(model.champion, 'LD丨힘');
});

test('season 場次欄依 matches 判定，歧義時留白不猜測', async () => {
  const season = await readJson(dataPath('star-cup', '2026-07-31.json'));
  const group = season.groups.find((g) => g.id === 1);
  const slots = playerSlotMap(group);
  const actual = group.players.map((p) => slots.get(p) || '—');
  // 舊索引規則會標成 A,A,B,B,C,C,D,D——全部都是錯的。
  assert.deepEqual(actual, ['—', 'C', 'A', '—', 'B', 'D', 'B', 'D']);
  assert.notDeepEqual(actual, ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D']);
});

test('四屆真實資料：診斷分類數與稽核基準一致', async () => {
  const counts = { unique: 0, id: 0, ambiguous: 0, unmatched: 0 };
  for (const id of SEASONS) {
    const season = await readJson(dataPath('star-cup', `${id}.json`));
    for (const group of season.groups) {
      const model = buildBracketViewModel(group);
      for (const m of [...model.r1, ...model.r2, model.final]) {
        for (const card of [m && m.p1, m && m.p2]) if (card) counts[card.identity] += 1;
      }
    }
  }
  // 基準值來自 tmp/architecture-review.md 的實測（400 unique / 5 ambiguous / 43 unmatched）。
  // 這些數字是遷移進度指標：補上 player_id 後 ambiguous 與 unmatched 應下降。
  assert.equal(counts.ambiguous, 5, 'ambiguous 數量變動代表資料或關聯規則改變，需重新檢視');
  assert.equal(counts.unmatched, 43, 'unmatched 數量變動代表歷史資料被修改，須有截圖佐證');
  assert.equal(counts.unique + counts.id, 400);
});
