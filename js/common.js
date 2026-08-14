const DATA_BASE = 'data';
const DEFAULT_CUP = 'star-cup';

async function fetchJson(url, { optional = false } = {}) {
  const response = await fetch(url);
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`無法載入 ${url}（HTTP ${response.status}）`);
  try { return await response.json(); }
  catch { throw new Error(`${url} 不是有效的 JSON`); }
}

const fetchCups = () => fetchJson(`${DATA_BASE}/cups.json`);
async function fetchCup(slug) {
  const cup = (await fetchCups()).find((item) => item.slug === slug);
  if (!cup) throw new Error(`不存在的賽事類型：${slug}`);
  return cup;
}
const fetchSeasonIds = (cup = DEFAULT_CUP) => fetchJson(`${DATA_BASE}/${cup}/seasons.json`);
const fetchSeason = (id, cup = DEFAULT_CUP) => fetchJson(`${DATA_BASE}/${cup}/${id}.json`);
const fetchPredictionIds = () => fetchJson(`${DATA_BASE}/predictions/star-cup/seasons.json`);
const fetchPrediction = (id, optional = false) => fetchJson(`${DATA_BASE}/predictions/star-cup/${id}.json`, { optional });

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}

function selectedPlayer(pick) { return pick?.[pick.selected_side] ?? null; }
function statusLabel(status) { return ({ upcoming: '準備中', in_progress: '進行中', finished: '已結束' })[status] ?? '狀態不明'; }
function formatRate(correct, settled) { return settled ? `${correct}/${settled}（${Math.round(correct / settled * 100)}%）` : '尚未結算'; }
function statusBadge(status) { return `<span class="text-xs bg-slate-600 text-slate-200 px-2 py-0.5 rounded-full">${escapeHtml(statusLabel(status))}</span>`; }
function roundLabel(data) { return data.round ? `第 ${data.round} 屆` : null; }
function themeLabel(data) { return [data.season, data.theme].filter(Boolean).join('｜') || null; }
function periodLabel(data) {
  const fmt = (date) => date?.slice(5).replace('-', '/');
  return [data.qualifier_period && `預選賽 ${fmt(data.qualifier_period[0])} – ${fmt(data.qualifier_period[1])}`, data.knockout_period && `淘汰賽 ${fmt(data.knockout_period[0])} – ${fmt(data.knockout_period[1])}`].filter(Boolean).join('｜') || null;
}
function displayName(player) { return `${player.name}${player.flag ? ` ${player.flag}` : ''}`; }
function prevBadge(value) { return value ? `<span class="prev-best-badge bg-slate-600 text-slate-100">${escapeHtml(value)}</span>` : ''; }
function accentOf(cup) { return cup?.accent === 'violet' ? { text: 'text-violet-400' } : { text: 'text-yellow-400' }; }

function nameDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return rows[a.length][b.length];
}

function alignFirstRound(group, actualMatches) {
  const predicted = group.picks.filter((pick) => pick.round === 'R1');
  const actual = actualMatches.filter((match) => match.round === 'R1');
  let best = null;
  function visit(index, remaining, pairs, cost) {
    if (index === predicted.length) { if (!best || cost < best.cost) best = { cost, pairs }; return; }
    const pick = predicted[index];
    for (const match of remaining) {
      const direct = nameDistance(pick.p1.name, match.p1.name) + nameDistance(pick.p2.name, match.p2.name);
      const reverse = nameDistance(pick.p1.name, match.p2.name) + nameDistance(pick.p2.name, match.p1.name);
      const mapped = direct <= reverse ? [[pick.p1.name, match.p1.name], [pick.p2.name, match.p2.name]] : [[pick.p1.name, match.p2.name], [pick.p2.name, match.p1.name]];
      visit(index + 1, remaining.filter((item) => item !== match), [...pairs, { pick, match, mapped }], cost + Math.min(direct, reverse));
    }
  }
  visit(0, actual, [], 0);
  return best?.pairs ?? [];
}

function scorePrediction(prediction, season) {
  let correct = 0;
  let settled = 0;
  const groups = prediction.groups.map((group) => {
    const actualGroup = season.groups.find((candidate) => candidate.id === group.id);
    const matches = actualGroup?.matches ?? [];
    const aligned = alignFirstRound(group, matches);
    const r1Results = new Map(aligned.map((entry) => [entry.pick.slot, entry.match]));
    const identities = new Map(aligned.flatMap((entry) => entry.mapped));
    const resultFor = (pick) => {
      if (pick.round === '決賽') return matches.find((match) => match.round === '決賽');
      if (pick.round === 'R1') return r1Results.get(pick.slot);
      const winners = pick.depends_on.map((slot) => r1Results.get(slot)?.winner);
      return matches.find((match) => match.round === 'R2' && winners.every((name) => [match.p1.name, match.p2.name].includes(name)));
    };
    const picks = group.picks.map((pick) => {
      const result = resultFor(pick);
      if (!result) return { ...pick, outcome: 'pending' };
      settled += 1;
      const selectedName = identities.get(selectedPlayer(pick)?.name) ?? selectedPlayer(pick)?.name;
      const hit = selectedName === result.winner;
      if (hit) correct += 1;
      return { ...pick, outcome: hit ? 'correct' : 'wrong', actual_winner: result.winner };
    });
    return { id: group.id, picks, correct: picks.filter((pick) => pick.outcome === 'correct').length, settled: picks.filter((pick) => pick.outcome !== 'pending').length };
  });
  return { correct, settled, groups };
}

function showError(error, target = document.body) {
  const message = error instanceof Error ? error.message : String(error);
  target.innerHTML = `<main class="shell error-state"><p class="eyebrow">資料載入失敗</p><h1>目前無法顯示這個頁面</h1><p>${escapeHtml(message)}</p><nav class="actions"><a class="button primary" href="index.html">返回首頁</a><a class="button" href="archive.html">完整賽事資料</a><a class="button" href="history.html">歷屆下注成效</a></nav></main>`;
}
