const SLOT_LABEL = { A: '1 · A', B: '2 · B', C: '3 · C', D: '4 · D', upper: '5 · R2 上', lower: '6 · R2 下', final: '7 · 組冠軍' };
const CONFIDENCE_LABEL = { high: '優勢明確', medium: '可考慮', low: '風險較高' };

function pickCard(pick) {
  const selected = selectedPlayer(pick);
  const outcomeClass = pick.outcome === 'correct' ? 'correct' : pick.outcome === 'wrong' ? 'wrong' : 'selected';
  const result = pick.outcome === 'correct' ? '<div class="result correct">✓ 命中</div>'
    : pick.outcome === 'wrong' ? `<div class="result wrong">✕ 未命中 · 實際 ${escapeHtml(pick.actual_winner)}</div>` : '';
  return `<article class="pick ${outcomeClass}"><div class="pick-head"><span>${escapeHtml(SLOT_LABEL[pick.slot])}</span><span class="confidence">${escapeHtml(CONFIDENCE_LABEL[pick.confidence])}</span></div><div class="pick-name">${escapeHtml(selected.name)}</div><div class="pick-reason">${escapeHtml(pick.reason)}</div>${pick.depends_on.length ? `<div class="pick-reason">依賴：${pick.depends_on.join('、')} 勝者</div>` : ''}${result}</article>`;
}

function copyText(groups) {
  return groups.map((group) => `第${group.id}組：${group.picks.map((pick) => `${SLOT_LABEL[pick.slot].replace(/^\d · /, '')} ${selectedPlayer(pick).name}`).join('、')}`).join('\n');
}

async function loadAdvice() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) throw new Error('網址缺少屆次 id');
  const ids = await fetchPredictionIds();
  if (!ids.includes(id)) throw new Error(`屆次 ${id} 尚未發布正式下注建議`);
  const [prediction, season] = await Promise.all([fetchPrediction(id), fetchSeason(id)]);
  const score = scorePrediction(prediction, season);
  const app = document.getElementById('app');
  app.innerHTML = `<section class="summary"><div><p class="eyebrow">${escapeHtml(prediction.source === 'snapshot' ? '正式快照' : '賽前文件還原')}</p><h1>${escapeHtml(season.date)} ${season.status === 'finished' ? '當初建議與賽果' : '下注建議'}</h1><p class="lede">操作順序：A → B → C → D → R2 上 → R2 下 → 組冠軍</p></div><div><strong>${formatRate(score.correct, score.settled)}</strong><div class="muted">目前命中率</div></div></section><div class="coverage"><span class="chip">戰力 ${prediction.coverage.power.available}/64</span><span class="chip">資格賽 ${prediction.coverage.qualifier.available}/64</span><span class="chip">歷史 ${prediction.coverage.history.available}/64</span></div><div class="actions"><button id="copy-all" class="button">複製全部 56 場</button><a class="button" href="season.html?id=${encodeURIComponent(id)}">完整賽事資料</a></div><div id="tabs" class="tabs"></div><div id="group"></div>`;
  const tabs = app.querySelector('#tabs');
  const groupEl = app.querySelector('#group');
  function showGroup(group) {
    tabs.querySelectorAll('button').forEach((button) => button.classList.toggle('active', Number(button.dataset.id) === group.id));
    const scoredGroup = score.groups.find((item) => item.id === group.id);
    groupEl.innerHTML = `<section class="panel"><div class="summary"><div><p class="eyebrow">第 ${group.id} 組</p><h2>完整預測路徑</h2></div><strong>${formatRate(scoredGroup.correct, scoredGroup.settled)}</strong></div><div class="bracket"><div class="round r1">${scoredGroup.picks.slice(0,4).map(pickCard).join('')}</div><div class="round">${scoredGroup.picks.slice(4,6).map(pickCard).join('')}</div><div class="round">${scoredGroup.picks.slice(6).map(pickCard).join('')}</div></div><div class="actions"><button class="button" id="copy-group">複製本組 7 場</button></div></section>`;
    groupEl.querySelector('#copy-group').onclick = () => navigator.clipboard.writeText(copyText([group]));
  }
  prediction.groups.forEach((group) => {
    const button = document.createElement('button'); button.className = 'tab'; button.dataset.id = group.id; button.textContent = `第 ${group.id} 組`; button.onclick = () => showGroup(group); tabs.append(button);
  });
  app.querySelector('#copy-all').onclick = () => navigator.clipboard.writeText(copyText(prediction.groups));
  showGroup(prediction.groups[0]);
}

loadAdvice().catch((error) => showError(error, document.getElementById('app')));
