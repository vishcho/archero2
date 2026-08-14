async function loadHome() {
  const seasonIds = await fetchSeasonIds();
  const latestId = seasonIds.at(-1);
  const latest = await fetchSeason(latestId);
  const prediction = await fetchPrediction(latestId, true);
  const predictionIds = await fetchPredictionIds();
  const scored = await Promise.all(predictionIds.map(async (id) => {
    const [item, season] = await Promise.all([fetchPrediction(id), fetchSeason(id)]);
    return { id, season, ...scorePrediction(item, season) };
  }));
  const cumulative = scored.reduce((sum, item) => ({ correct: sum.correct + item.correct, settled: sum.settled + item.settled }), { correct: 0, settled: 0 });
  const previous = [...scored].reverse().find((item) => item.settled === 56);
  const latestScore = prediction ? scorePrediction(prediction, latest) : null;
  const action = prediction
    ? `<a class="button primary" href="bracket.html?id=${encodeURIComponent(latestId)}">${latest.status === 'finished' ? '查看當初建議與結果' : '查看下注建議'}</a>`
    : '<span class="button primary" aria-disabled="true">下注建議準備中</span>';
  const coverage = prediction?.coverage;
  const forced = prediction?.groups.flatMap((group) => group.picks).filter((pick) => pick.forced).length ?? 0;

  document.getElementById('app').innerHTML = `
    <section class="panel hero">
      <p class="eyebrow">最新一屆 · ${escapeHtml(statusLabel(latest.status))}</p>
      <h1>${escapeHtml(latest.date)} 明星盃<br>56 場下注建議</h1>
      <p class="lede">依照上屆表現、戰力與資格賽資料，提供 8 組完整預測路徑。本站只提供建議，不保證賽果。</p>
      <div class="actions">${action}<a class="button" href="season.html?id=${encodeURIComponent(latestId)}">查看本屆資料</a></div>
    </section>
    <section class="grid metrics">
      <div class="panel metric"><span>戰力覆蓋</span><strong>${coverage ? `${coverage.power.available}/64` : '待收集'}</strong></div>
      <div class="panel metric"><span>資格賽覆蓋</span><strong>${coverage ? `${coverage.qualifier.available}/64` : '待收集'}</strong></div>
      <div class="panel metric"><span>歷史覆蓋</span><strong>${coverage ? `${coverage.history.available}/64` : '待收集'}</strong></div>
      <div class="panel metric"><span>強制選擇</span><strong>${prediction ? `${forced}/56` : '—'}</strong></div>
    </section>
    <section class="panel">
      <div class="summary"><div><p class="eyebrow">回測成效</p><h2>建議是否真的有效</h2></div><a href="history.html">查看逐屆成效 →</a></div>
      <div class="grid metrics">
        <div class="metric"><span>本屆目前</span><strong>${latestScore ? formatRate(latestScore.correct, latestScore.settled) : '尚未發布'}</strong></div>
        <div class="metric"><span>上一完整屆</span><strong>${previous ? formatRate(previous.correct, previous.settled) : '尚無完整資料'}</strong></div>
        <div class="metric"><span>正式歷史累計</span><strong>${formatRate(cumulative.correct, cumulative.settled)}</strong></div>
      </div>
    </section>
    <section class="section"><h2>其他入口</h2><div class="grid cards">
      <a class="panel card-link" href="history.html"><p class="eyebrow">Performance</p><h3>歷屆下注成效</h3><p class="muted">比較當時建議與實際賽果。</p></a>
      <a class="panel card-link" href="archive.html"><p class="eyebrow">Archive</p><h3>完整賽事資料</h3><p class="muted">查詢資格賽、淘汰賽與總決賽。</p></a>
      <a class="panel card-link" href="archive.html#super-star-cup"><p class="eyebrow" style="color:var(--violet)">Roster</p><h3>超級明星盃</h3><p class="muted">查看選手配置紀錄。</p></a>
    </div></section>`;
}

loadHome().catch((error) => showError(error, document.getElementById('app')));
