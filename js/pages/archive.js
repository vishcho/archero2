async function loadArchive() {
  const cups = await fetchCups();
  const sections = await Promise.all(cups.map(async (cup) => {
    const ids = await fetchSeasonIds(cup.slug);
    const seasons = await Promise.all([...ids].reverse().map((id) => fetchSeason(id, cup.slug)));
    return { cup, seasons };
  }));
  document.getElementById('app').innerHTML = `<section><p class="eyebrow">Archive</p><h1>完整賽事資料</h1><p class="lede">資格賽、淘汰賽、總決賽與選手配置的歷史紀錄。</p></section>${sections.map(({ cup, seasons }) => `<section class="section" id="${escapeHtml(cup.slug)}"><h2>${escapeHtml(cup.name)}</h2><p class="muted">${escapeHtml(cup.format)}</p><div class="list">${seasons.map((season) => `<a class="panel list-row" href="season.html?cup=${encodeURIComponent(cup.slug)}&id=${encodeURIComponent(season.id)}"><div><strong>${escapeHtml(season.date)}</strong><div class="muted">${escapeHtml(season.theme || season.season || '無主題資料')}</div></div><span class="status">${escapeHtml(statusLabel(season.status))}</span></a>`).join('')}</div></section>`).join('')}`;
}
loadArchive().catch((error) => showError(error, document.getElementById('app')));
