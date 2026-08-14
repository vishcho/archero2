const SLOT_LABEL = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  upper: "A × C",
  lower: "B × D",
  final: "冠軍賽",
};
const CONFIDENCE_LABEL = {
  high: "優勢明確",
  medium: "可考慮",
  low: "風險較高",
};

function pickCard(pick) {
  const selected = selectedPlayer(pick);
  const opponent = pick.selected_side === "p1" ? pick.p2 : pick.p1;
  const outcomeClass =
    pick.outcome === "correct"
      ? "correct"
      : pick.outcome === "wrong"
        ? "wrong"
        : "selected";
  const result =
    pick.outcome === "correct"
      ? '<div class="result correct">✓ 命中</div>'
      : pick.outcome === "wrong"
        ? `<div class="result wrong">✕ 未命中 · 實際 ${escapeHtml(pick.actual_winner)}</div>`
        : "";
  const desktopDetails = window.matchMedia("(min-width: 521px)").matches ? " open" : "";
  return `<article class="pick ${outcomeClass}"><div class="pick-head"><strong>${escapeHtml(SLOT_LABEL[pick.slot])}</strong><span class="confidence" data-confidence="${escapeHtml(pick.confidence)}">${escapeHtml(CONFIDENCE_LABEL[pick.confidence])}</span></div><div class="pick-recommendation"><span>建議選擇</span><strong>${escapeHtml(selected.name)}</strong></div><div class="pick-opponent">對手：${escapeHtml(opponent.name)}</div><details class="pick-details"${desktopDetails}><summary>查看預測理由</summary><div class="pick-reason">${escapeHtml(pick.reason)}</div>${pick.depends_on.length ? `<div class="pick-reason">依賴：${pick.depends_on.join("、")} 勝者</div>` : ""}</details>${result}</article>`;
}

function formatBracketPower(power) {
  if (typeof power === "number") return `${power.toFixed(2)}M`;
  return typeof power === "string" && power ? power : "—";
}

function bracketPlayerCard(pick, side) {
  const player = pick[side];
  const power = pick.evidence?.power?.[side];
  const advancing = side === pick.selected_side;
  return `<div class="game-player${advancing ? " advancing" : ""}"><span class="game-avatar" aria-hidden="true">${escapeHtml(player.name.slice(0, 1))}</span><span class="game-player-copy"><strong>${escapeHtml(player.name)}</strong><small><span aria-hidden="true">◆</span> ${escapeHtml(formatBracketPower(power))}</small></span></div>`;
}

function bracketMatchCard(pick, position) {
  const players = [
    bracketPlayerCard(pick, "p1"),
    bracketPlayerCard(pick, "p2"),
  ].join("");
  const slotLabel = ["A", "B", "C", "D"].includes(pick.slot)
    ? ""
    : `<div class="game-slot">${escapeHtml(SLOT_LABEL[pick.slot])}</div>`;
  return `<article class="game-match ${position}">${slotLabel}${players}</article>`;
}

function gameBracket(scoredGroup) {
  const bySlot = new Map(scoredGroup.picks.map((pick) => [pick.slot, pick]));
  const routeClass = (slot) =>
    bySlot.get(slot).confidence === "low" ? "route-low" : "route-default";
  const branchClass = (slot, side) =>
    bySlot.get(slot).selected_side === side ? routeClass(slot) : "route-loser";
  return `<div class="game-bracket" aria-label="第 ${scoredGroup.id} 組預測對陣圖">
    <svg class="game-bracket-lines" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
      <path class="${branchClass("A", "p1")}" d="M300 122 H400 V158"/>
      <path class="${branchClass("A", "p2")}" d="M300 193 H400 V158"/>
      <path class="${branchClass("C", "p1")}" d="M700 122 H600 V158"/>
      <path class="${branchClass("C", "p2")}" d="M700 193 H600 V158"/>
      <path class="${branchClass("upper", "p1")}" d="M400 158 H500"/>
      <path class="${branchClass("upper", "p2")}" d="M600 158 H500"/>
      <path class="${branchClass("final", "p1")}" d="M500 158 V310"/>
      <path class="${branchClass("B", "p1")}" d="M300 449 H400 V485"/>
      <path class="${branchClass("B", "p2")}" d="M300 520 H400 V485"/>
      <path class="${branchClass("D", "p1")}" d="M700 449 H600 V485"/>
      <path class="${branchClass("D", "p2")}" d="M700 520 H600 V485"/>
      <path class="${branchClass("lower", "p1")}" d="M400 485 H500"/>
      <path class="${branchClass("lower", "p2")}" d="M600 485 H500"/>
      <path class="${branchClass("final", "p2")}" d="M500 485 V310"/>
    </svg>
    <div class="game-junction-label game-label-a">A</div>
    <div class="game-junction-label game-label-c">C</div>
    <div class="game-junction-label game-label-b">B</div>
    <div class="game-junction-label game-label-d">D</div>
    <div class="game-matchup-label game-label-ac">A × C</div>
    <div class="game-matchup-label game-label-bd">B × D</div>
    ${bracketMatchCard(bySlot.get("A"), "game-r1 game-a")}
    ${bracketMatchCard(bySlot.get("C"), "game-r1 game-c")}
    ${bracketMatchCard(bySlot.get("B"), "game-r1 game-b")}
    ${bracketMatchCard(bySlot.get("D"), "game-r1 game-d")}
    <article class="game-champion ${routeClass("final")}">
      <div class="game-final-node">${escapeHtml(SLOT_LABEL.final)}</div>
    </article>
  </div>`;
}

async function loadAdvice() {
  const params = new URLSearchParams(location.search);
  const previewId = params.get("preview");
  let id = previewId || params.get("id");
  if (!previewId) {
    const ids = await fetchPredictionIds();
    if (!id) id = ids.at(-1);
    if (!id) throw new Error("尚未發布任何正式下注建議");
    if (!ids.includes(id)) throw new Error(`屆次 ${id} 尚未發布正式下注建議`);
  }
  const [prediction, season] = await Promise.all([
    previewId ? fetchPreview(id) : fetchPrediction(id),
    fetchSeason(id),
  ]);
  const score = scorePrediction(prediction, season);
  const app = document.getElementById("app");
  const legend =
    season.status === "finished"
      ? '<p class="muted">綠色＝命中，紅色＝未命中；卡片保留當時的預測理由。</p>'
      : "";
  const previewNotice = previewId
    ? '<div class="notice">這是非正式前端預覽，不代表已發布建議，也不會進入歷史命中率。</div>'
    : "";
  const heading = previewId
    ? "非正式預覽"
    : prediction.source === "snapshot"
      ? "正式快照"
      : "賽前文件還原";
  app.innerHTML = `${previewNotice}<section class="summary"><div><p class="eyebrow">${escapeHtml(heading)}</p><h1>${escapeHtml(season.date)} 明星盃${season.theme ? ` ${escapeHtml(season.theme)}` : ""}</h1>${season.status === "finished" ? '<p class="title-note">當初建議與賽果</p>' : '<p class="title-note">對陣圖與下注參考</p>'}<p class="lede">操作順序：A → B → C → D → A × C → B × D → 冠軍賽</p>${legend}</div><div><strong>${previewId ? "不計 KPI" : formatRate(score.correct, score.settled)}</strong><div class="muted">${previewId ? "預覽模式" : "目前命中率"}</div></div></section><div class="coverage" aria-label="資料涵蓋率"><span class="chip">戰力資料 ${prediction.coverage.power.available}/64 人</span><span class="chip">資格賽資料 ${prediction.coverage.qualifier.available}/64 人</span><span class="chip">歷史資料 ${prediction.coverage.history.available}/64 人</span><span class="chip">${previewId ? "產生" : "發布"} ${escapeHtml(new Date(prediction.published_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }))}</span></div><div class="actions"><button id="copy-all" class="button">複製全部 56 場</button><a class="button" href="season?id=${encodeURIComponent(id)}">完整賽事資料</a></div><div id="tabs" class="tabs" role="tablist" aria-label="賽事分組"></div><div id="group" role="tabpanel"></div>`;
  const tabs = app.querySelector("#tabs");
  const groupEl = app.querySelector("#group");
  let activeGroupIndex = 0;
  let mobileView = "diagram";
  const copyWithFeedback = async (button, text, originalLabel) => {
    await navigator.clipboard.writeText(text);
    button.textContent = "已複製";
    window.setTimeout(() => { button.textContent = originalLabel; }, 1400);
  };
  function showGroup(group) {
    activeGroupIndex = prediction.groups.findIndex((item) => item.id === group.id);
    tabs
      .querySelectorAll("button")
      .forEach((button) =>
        {
          const active = Number(button.dataset.id) === group.id;
          button.classList.toggle("active", active);
          button.setAttribute("aria-selected", String(active));
          button.tabIndex = active ? 0 : -1;
          if (active) button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        },
      );
    const scoredGroup = score.groups.find((item) => item.id === group.id);
    groupEl.innerHTML = `<div class="view-switch" role="group" aria-label="手機檢視模式"><button class="button" data-view="diagram" aria-pressed="${mobileView === "diagram"}">完整對陣圖</button><button class="button" data-view="list" aria-pressed="${mobileView === "list"}">下注列表</button></div><div class="group-sections"><section class="panel bracket-panel" data-mobile-view="${mobileView}"><div><p class="eyebrow">第 ${group.id} 組 · 淘汰賽競猜期</p><h2>對陣圖</h2><p class="muted">金色＝建議晉級；橘色＝風險較高；深色＝未建議路徑。</p></div><div class="bracket-scroll">${gameBracket(scoredGroup)}</div></section><section class="panel advice-panel"><div class="summary"><div><p class="eyebrow">遊戲操作順序</p><h2>下注建議列表</h2><p class="muted">A → B → C → D → A × C → B × D → 冠軍賽</p></div><strong>${formatRate(scoredGroup.correct, scoredGroup.settled)}</strong></div><div class="advice-grid">${scoredGroup.picks.map(pickCard).join("")}</div><div class="actions"><button class="button" id="copy-group">複製本組 7 場</button></div></section></div><nav class="mobile-group-dock" aria-label="分組快速操作"><button class="dock-button" id="previous-group" type="button"${activeGroupIndex === 0 ? " disabled" : ""}>← 上一組</button><span><strong>第 ${group.id} 組</strong><small>${activeGroupIndex + 1}／${prediction.groups.length}</small></span><button class="dock-button" id="dock-copy" type="button">複製</button><button class="dock-button" id="next-group" type="button"${activeGroupIndex === prediction.groups.length - 1 ? " disabled" : ""}>下一組 →</button></nav>`;
    groupEl.querySelectorAll("[data-view]").forEach((button) => button.onclick = () => {
      mobileView = button.dataset.view;
      groupEl.querySelector(".bracket-panel").dataset.mobileView = mobileView;
      groupEl.querySelectorAll("[data-view]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
    groupEl.querySelector("#copy-group").onclick = (event) => copyWithFeedback(event.currentTarget, predictionText([group]), "複製本組 7 場");
    groupEl.querySelector("#dock-copy").onclick = (event) => copyWithFeedback(event.currentTarget, predictionText([group]), "複製");
    groupEl.querySelector("#previous-group").onclick = () => showGroup(prediction.groups[activeGroupIndex - 1]);
    groupEl.querySelector("#next-group").onclick = () => showGroup(prediction.groups[activeGroupIndex + 1]);
  }
  prediction.groups.forEach((group) => {
    const button = document.createElement("button");
    button.className = "tab";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", "false");
    button.dataset.id = group.id;
    button.textContent = `第 ${group.id} 組`;
    button.onclick = () => showGroup(group);
    tabs.append(button);
  });
  app.querySelector("#copy-all").onclick = () =>
    navigator.clipboard.writeText(predictionText(prediction.groups));
  showGroup(prediction.groups[0]);
}

loadAdvice().catch((error) => showError(error, document.getElementById("app")));
