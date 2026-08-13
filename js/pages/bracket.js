const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(tag, attributes = {}, textValue) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  if (textValue !== undefined) node.textContent = String(textValue);
  return node;
}

function renderBracket(group) {
  const model = buildBracketViewModel(group);
  const matches = [...model.r1, ...model.r2, model.final].filter(Boolean);
  const width = 900;
  const rowHeight = 64;
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${matches.length * rowHeight + 70}`,
    width: "100%",
    role: "img",
    "aria-label": `第 ${group.id} 組淘汰賽對陣`,
  });
  svg.style.maxWidth = `${width}px`;
  svg.append(
    svgElement(
      "text",
      { x: 12, y: 25, fill: "#eab308", "font-size": 15, "font-weight": 700 },
      `🏆 組冠軍：${model.champion || "待定"}`,
    ),
  );
  matches.forEach((match, index) => {
    const y = 45 + index * rowHeight;
    svg.append(
      svgElement("rect", {
        x: 4,
        y,
        width: width - 8,
        height: rowHeight - 8,
        rx: 7,
        fill: "#1e293b",
        stroke: "#334155",
      }),
      svgElement(
        "text",
        { x: 18, y: y + 22, fill: "#94a3b8", "font-size": 11 },
        `${match.round}/${match.slot}`,
      ),
      svgElement(
        "text",
        { x: 155, y: y + 22, fill: "#f1f5f9", "font-size": 13 },
        displayName(match.p1 || { name: "尚無資料" }),
      ),
      svgElement(
        "text",
        { x: 410, y: y + 22, fill: "#64748b", "font-size": 11 },
        "vs",
      ),
      svgElement(
        "text",
        { x: 465, y: y + 22, fill: "#f1f5f9", "font-size": 13 },
        displayName(match.p2 || { name: "尚無資料" }),
      ),
      svgElement(
        "text",
        { x: 155, y: y + 43, fill: "#eab308", "font-size": 11 },
        `勝者：${match.winner || "待定"}${match.unverifiableIdentity ? " ◦" : ""}`,
      ),
    );
  });
  return svg;
}

async function loadBracket() {
  const state = document.getElementById("page-state");
  const tabs = document.getElementById("tabs");
  const wrap = document.getElementById("bracket-wrap");
  state.append(messageState("載入中…", "loading"));
  try {
    const params = new URLSearchParams(location.search);
    const ids = await fetchSeasonIds(DEFAULT_CUP);
    let id = params.get("id");
    let data;
    if (id) {
      data = await fetchSeason(id, DEFAULT_CUP);
    } else {
      for (let index = ids.length - 1; index >= 0; index -= 1) {
        data = await fetchSeason(ids[index], DEFAULT_CUP);
        id = ids[index];
        if (data.groups?.length) break;
      }
    }
    clear(state);
    document.title = `${data.date} 淘汰賽對陣 — 弓箭傳說2`;
    document.getElementById("title").textContent = `${data.date} 淘汰賽對陣`;
    document.getElementById("back-link").href =
      `season.html?id=${encodeURIComponent(id)}`;
    if (!data.groups?.length) {
      wrap.append(messageState("尚無分組資料"));
      return;
    }
    const select = (group, selected) => {
      clear(wrap).append(renderBracket(group));
      tabs
        .querySelectorAll("button")
        .forEach((button) =>
          button.classList.toggle("bg-yellow-500", button === selected),
        );
    };
    data.groups.forEach((group, index) => {
      const button = element("button", {
        className:
          "px-4 py-2 rounded-lg text-sm font-semibold bg-slate-700 text-slate-300",
        text: `第 ${group.id} 組`,
      });
      button.addEventListener("click", () => select(group, button));
      tabs.append(button);
      if (index === 0) select(group, button);
    });
  } catch (error) {
    renderError(state, error);
  }
}

loadBracket();
