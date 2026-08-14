async function loadArchive() {
  const cups = await fetchCups();
  const sections = await Promise.all(cups.map(async (cup) => {
    const ids = await fetchSeasonIds(cup.slug);
    const seasons = await Promise.all([...ids].reverse().map((id) => fetchSeason(id, cup.slug)));
    return { cup, seasons };
  }));
  const records = sections.flatMap(({ cup, seasons }) => seasons.map((season) => ({ cup, season })));
  const app = document.getElementById("app");
  app.innerHTML = `<section><p class="eyebrow">賽事典藏</p><h1>完整賽事資料</h1><p class="lede">搜尋資格賽、淘汰賽、總決賽與選手配置的歷史紀錄。</p></section><form class="filter-bar" id="archive-filters" role="search"><input class="field" id="archive-query" type="search" placeholder="搜尋日期、主題或賽季" aria-label="搜尋賽事"><select class="field" id="archive-cup" aria-label="盃賽類型"><option value="">所有盃賽</option>${cups.map((cup) => `<option value="${escapeHtml(cup.slug)}">${escapeHtml(cup.name)}</option>`).join("")}</select><select class="field" id="archive-status" aria-label="賽事狀態"><option value="">所有狀態</option><option value="upcoming">準備中</option><option value="in_progress">進行中</option><option value="finished">已結束</option></select></form><p class="filter-summary" id="filter-summary" aria-live="polite"></p><div id="archive-results"></div>`;
  const results = app.querySelector("#archive-results");
  const render = () => {
    const query = app.querySelector("#archive-query").value.trim().toLocaleLowerCase("zh-TW");
    const cupSlug = app.querySelector("#archive-cup").value;
    const status = app.querySelector("#archive-status").value;
    const filtered = records.filter(({ cup, season }) => {
      const text = [season.date, season.theme, season.season, cup.name].filter(Boolean).join(" ").toLocaleLowerCase("zh-TW");
      return (!query || text.includes(query)) && (!cupSlug || cup.slug === cupSlug) && (!status || season.status === status);
    });
    app.querySelector("#filter-summary").textContent = `顯示 ${filtered.length} 筆，共 ${records.length} 筆賽事`;
    if (!filtered.length) {
      results.innerHTML = '<div class="panel empty-state"><h2>找不到符合條件的賽事</h2><p class="muted">請調整關鍵字或清除篩選條件。</p><button class="button" id="clear-filters" type="button">清除篩選</button></div>';
      results.querySelector("#clear-filters").onclick = () => { app.querySelector("#archive-filters").reset(); render(); };
      return;
    }
    results.innerHTML = cups.map((cup) => {
      const items = filtered.filter((record) => record.cup.slug === cup.slug);
      if (!items.length) return "";
      return `<section class="section" id="${escapeHtml(cup.slug)}"><h2>${escapeHtml(cup.name)}</h2><p class="muted">${escapeHtml(cup.format)}</p><div class="list">${items.map(({ season }) => `<a class="panel list-row card-link" href="season.html?cup=${encodeURIComponent(cup.slug)}&id=${encodeURIComponent(season.id)}"><div><strong>${escapeHtml(season.date)}</strong><div class="muted">${escapeHtml(season.theme || season.season || "無主題資料")}</div></div><span class="status" data-status="${escapeHtml(season.status)}">${escapeHtml(statusLabel(season.status))}</span></a>`).join("")}</div></section>`;
    }).join("");
  };
  app.querySelector("#archive-filters").addEventListener("input", render);
  const hashCup = location.hash.slice(1);
  if (cups.some((cup) => cup.slug === hashCup)) app.querySelector("#archive-cup").value = hashCup;
  render();
}
loadArchive().catch((error) => showError(error, document.getElementById("app")));
