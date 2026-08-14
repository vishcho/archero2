async function loadHistory() {
  const ids = await fetchPredictionIds();
  const rows = await Promise.all([...ids].reverse().map(async (id) => {
    const [prediction, season] = await Promise.all([fetchPrediction(id), fetchSeason(id)]);
    return { id, prediction, season, score: scorePrediction(prediction, season) };
  }));
  const total = rows.reduce((sum, row) => ({ correct: sum.correct + row.score.correct, settled: sum.settled + row.score.settled }), { correct: 0, settled: 0 });
  document.getElementById('app').innerHTML = `<nav class="breadcrumb" aria-label="麵包屑"><a href="archive">賽事資料</a><span aria-hidden="true">／</span><span aria-current="page">歷屆下注成效</span></nav><section><p class="eyebrow">預測成效</p><h1>歷屆下注成效</h1><p class="lede">只統計正式快照與可追溯的賽前文件還原；未結算場次不進入分母。</p></section><section class="grid metrics"><div class="panel metric"><span>正式累計</span><strong>${formatRate(total.correct,total.settled)}</strong></div><div class="panel metric"><span>已納入屆次</span><strong>${rows.length}</strong></div></section><section class="list">${rows.map(({ id, prediction, season, score }) => `<a class="panel list-row card-link" href="bracket?id=${encodeURIComponent(id)}"><div><span class="status">${escapeHtml(prediction.source === 'snapshot' ? '正式快照' : '文件還原')}</span><h2 style="margin:8px 0 0">${escapeHtml(season.date)} 第 ${season.round} 屆</h2></div><strong>${formatRate(score.correct,score.settled)}</strong></a>`).join('')}</section>`;
}
loadHistory().catch((error) => showError(error, document.getElementById('app')));
