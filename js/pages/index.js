async function loadHome() {
  const [seasonIds, superSeasonIds, predictionIds] = await Promise.all([
    fetchSeasonIds(),
    fetchSeasonIds("super-star-cup"),
    fetchPredictionIds(),
  ]);
  const latestId = seasonIds.at(-1);
  const latestSuperId = superSeasonIds.at(-1);
  const [latest, latestSuper, prediction] = await Promise.all([
    fetchSeason(latestId),
    fetchSeason(latestSuperId, "super-star-cup"),
    fetchPrediction(latestId, true),
  ]);
  const scored = await Promise.all(
    predictionIds.map(async (id) => {
      const [item, season] = await Promise.all([
        fetchPrediction(id),
        fetchSeason(id),
      ]);
      return { id, season, ...scorePrediction(item, season) };
    }),
  );
  const cumulative = scored.reduce(
    (sum, item) => ({
      correct: sum.correct + item.correct,
      settled: sum.settled + item.settled,
    }),
    { correct: 0, settled: 0 },
  );
  const previous = [...scored].reverse().find((item) => item.settled === 56);
  const latestScore = prediction ? scorePrediction(prediction, latest) : null;
  const actionLabel = latest.status === "finished" ? "查看建議與結果" : "查看 56 場下注建議";
  const action = prediction
    ? `<a class="button primary" href="bracket?id=${encodeURIComponent(latestId)}">${actionLabel}</a>`
    : '<span class="button primary" aria-disabled="true">下注建議準備中</span>';
  const coverage = prediction?.coverage;
  const forced =
    prediction?.groups
      .flatMap((group) => group.picks)
      .filter((pick) => pick.forced).length ?? 0;
  const state = bettingState(latest, prediction);
  const gaps = coverageGaps(coverage);
  const published = prediction
    ? new Date(prediction.published_at).toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
      })
    : null;

  const publishedLabel = published
    ? `發布於 ${escapeHtml(published)}`
    : "正式建議尚未發布";
  const dataHealth = gaps.length ? gaps.join("、") : "資料完整";

  document.getElementById("app").innerHTML = `
    <section class="home-intro">
      <div><p class="eyebrow">Archero 2 社群資料工具</p><h1>賽事預測、歷史數據<br>與實用攻略</h1></div>
      <p class="lede">為《弓箭傳說 2》玩家整理的非官方資料工具。快速取得當期下注建議，也能查閱歷史賽事與選手配置。</p>
    </section>

    <section class="panel focus-panel">
      <div class="focus-copy">
        <div class="section-label"><span class="live-dot"></span>本期焦點</div>
        <p class="eyebrow">${escapeHtml(state.label)}</p>
        <h2>${escapeHtml(latest.date)} 明星盃</h2>
        <p class="focus-value">8 組共 56 場完整預測路徑</p><p class="muted">${escapeHtml(latest.season || latest.theme || "最新一屆")}</p>
        <div class="actions">${action}<a class="button" href="season?id=${encodeURIComponent(latestId)}">查看賽事資料</a></div>
      </div>
      <div class="focus-stats">
        <div class="compact-stat"><span>戰力資料</span><strong>${coverage ? `${coverage.power.available}/${coverage.power.total} 人` : "待收集"}</strong></div>
        <div class="compact-stat"><span>資格賽資料</span><strong>${coverage ? `${coverage.qualifier.available}/${coverage.qualifier.total} 人` : "待收集"}</strong></div>
        <div class="compact-stat"><span>歷史資料</span><strong>${coverage ? `${coverage.history.available}/${coverage.history.total} 人` : "待收集"}</strong></div>
        <div class="compact-stat"><span>強制選擇 <span class="help" title="資料不足、仍須完成下注路徑的場次">?</span></span><strong>${prediction ? `${forced}/56 場` : "—"}</strong></div>
        <div class="focus-meta"><span>${publishedLabel}</span><span>${escapeHtml(dataHealth)}</span></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><p class="eyebrow">主要功能</p><h2>快速入口</h2></div><a href="archive">全部賽事資料 →</a></div>
      <div class="grid portal-grid">
        <a class="panel portal-card" href="bracket?id=${encodeURIComponent(latestId)}">
          <img class="game-icon" src="img/game/events/dice.png" alt="" width="64" height="64">
          <div><span class="portal-kicker">兩週一輪</span><h3>明星盃</h3><p>下注建議、歷史成效與完整對陣資料。</p></div><span class="portal-arrow">→</span>
        </a>
        <a class="panel portal-card" href="archive#super-star-cup">
          <img class="game-icon" src="img/game/runes/twin-core.png" alt="" width="64" height="64">
          <div><span class="portal-kicker">${escapeHtml(statusLabel(latestSuper.status))}</span><h3>超級明星盃</h3><p>${escapeHtml(latestSuper.theme || "最新選手配置")}｜${escapeHtml(latestSuper.date)}</p></div><span class="portal-arrow">→</span>
        </a>
        <article class="panel portal-card" id="guides">
          <img class="game-icon" src="img/game/guides/character.png" alt="" width="64" height="64">
          <div><span class="portal-kicker">持續整理</span><h3>遊戲攻略</h3><p>角色、裝備、技能與活動資源規劃。</p></div><span class="status">準備中</span>
        </article>
      </div>
    </section>

    <section class="section split-grid">
      <div class="panel performance-panel">
        <div class="section-head"><div><p class="eyebrow">預測成效</p><h2>下注成效</h2></div><a href="history">完整報告 →</a></div>
        <div class="performance-list">
          <div><span>本屆目前</span><strong>${latestScore ? formatRate(latestScore.correct, latestScore.settled) : "尚未發布"}</strong></div>
          <div><span>上一完整屆</span><strong>${previous ? formatRate(previous.correct, previous.settled) : "尚無完整資料"}</strong></div>
          <div><span>正式歷史累計</span><strong>${formatRate(cumulative.correct, cumulative.settled)}</strong></div>
        </div>
      </div>
      <div class="panel update-panel">
        <div class="section-head"><div><p class="eyebrow">最近更新</p><h2>最近資料</h2></div><a href="archive">查看全部 →</a></div>
        <div class="update-list">
          <a href="season?id=${encodeURIComponent(latestId)}"><span class="update-type">明星盃</span><strong>${escapeHtml(latest.date)} ${escapeHtml(latest.season || latest.theme || "賽事資料")}</strong><small>${escapeHtml(statusLabel(latest.status))}</small></a>
          <a href="season?cup=super-star-cup&id=${encodeURIComponent(latestSuperId)}"><span class="update-type">超級明星盃</span><strong>${escapeHtml(latestSuper.date)} ${escapeHtml(latestSuper.theme || "選手配置")}</strong><small>${escapeHtml(statusLabel(latestSuper.status))}</small></a>
          <a href="history"><span class="update-type">統計</span><strong>正式下注歷史累計</strong><small>${formatRate(cumulative.correct, cumulative.settled)}</small></a>
        </div>
      </div>
    </section>`;
}

loadHome().catch((error) => showError(error, document.getElementById("app")));
