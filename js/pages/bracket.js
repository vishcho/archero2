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
  const width = 980;
  const height = 520;
  const cardWidth = 205;
  const cardHeight = 48;
  const leftX = 8;
  const rightX = width - cardWidth - 8;
  const centerX = width / 2;
  const rows = [35, 91, 327, 383];
  const centers = rows.map((value) => value + cardHeight / 2);
  const upperY = (centers[0] + centers[1]) / 2;
  const lowerY = (centers[2] + centers[3]) / 2;
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    role: "img",
    "aria-label": `第 ${group.id} 組淘汰賽對陣`,
  });
  svg.style.maxWidth = `${width}px`;

  const r1Slot = (slot) => model.r1.find((match) => match.slot === slot);
  const pairs = [
    r1Slot(model.layout.leftTop),
    r1Slot(model.layout.leftBottom),
    r1Slot(model.layout.rightTop),
    r1Slot(model.layout.rightBottom),
  ];
  const cards = pairs.flatMap((match) => [match?.p1, match?.p2]);

  function line(x1, y1, x2, y2) {
    svg.append(
      svgElement("line", {
        x1,
        y1,
        x2,
        y2,
        stroke: "#475569",
        "stroke-width": 2,
      }),
    );
  }

  function playerCard(player, x, y) {
    const degraded = player && isDegradedIdentity(player.identity);
    svg.append(
      svgElement("rect", {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        rx: 6,
        fill: "#1e293b",
        stroke: degraded ? "#a16207" : "#334155",
        "stroke-dasharray": player ? "none" : "4 3",
      }),
    );
    const name = player ? displayName(player) : "尚無資料";
    svg.append(
      svgElement(
        "text",
        {
          x: x + 10,
          y: y + 18,
          fill: player ? "#f1f5f9" : "#64748b",
          "font-size": 12,
          "font-weight": 600,
        },
        `${player?.qualifier_rank != null ? `#${player.qualifier_rank} ` : ""}${name}${degraded ? " ◦" : ""}`,
      ),
      svgElement(
        "text",
        {
          x: x + 10,
          y: y + 37,
          fill: "#94a3b8",
          "font-size": 10,
        },
        `${player?.power || "—"}　${player?.time || player?.qualifier_time || "—"}${player?.prev_best ? `　上屆 ${player.prev_best}` : ""}`,
      ),
    );
  }

  [cards[0], cards[1], cards[2], cards[3]].forEach((card, index) =>
    playerCard(card, leftX, rows[index]),
  );
  [cards[4], cards[5], cards[6], cards[7]].forEach((card, index) =>
    playerCard(card, rightX, rows[index]),
  );

  const leftArm = leftX + cardWidth + 25;
  const rightArm = rightX - 25;
  for (const [top, bottom, meet] of [
    [0, 1, upperY],
    [2, 3, lowerY],
  ]) {
    line(leftX + cardWidth, centers[top], leftArm, centers[top]);
    line(leftX + cardWidth, centers[bottom], leftArm, centers[bottom]);
    line(leftArm, centers[top], leftArm, centers[bottom]);
    line(leftArm, meet, centerX - 85, meet);
    line(rightX, centers[top], rightArm, centers[top]);
    line(rightX, centers[bottom], rightArm, centers[bottom]);
    line(rightArm, centers[top], rightArm, centers[bottom]);
    line(centerX + 85, meet, rightArm, meet);
  }
  line(centerX, upperY + 22, centerX, 224);
  line(centerX, 286, centerX, lowerY - 22);

  function roundNode(y, label, match) {
    svg.append(
      svgElement("rect", {
        x: centerX - 85,
        y: y - 22,
        width: 170,
        height: 44,
        rx: 7,
        fill: "#172033",
        stroke: "#64748b",
      }),
      svgElement(
        "text",
        {
          x: centerX,
          y: y - 5,
          "text-anchor": "middle",
          fill: "#94a3b8",
          "font-size": 10,
        },
        label,
      ),
      svgElement(
        "text",
        {
          x: centerX,
          y: y + 13,
          "text-anchor": "middle",
          fill: "#f1f5f9",
          "font-size": 11,
        },
        match ? `${match.p1?.name || "—"} vs ${match.p2?.name || "—"}` : "待定",
      ),
    );
  }
  roundNode(
    upperY,
    "準決賽 upper",
    model.r2.find((match) => match.slot === "upper"),
  );
  roundNode(
    lowerY,
    "準決賽 lower",
    model.r2.find((match) => match.slot === "lower"),
  );
  svg.append(
    svgElement("rect", {
      x: centerX - 105,
      y: 224,
      width: 210,
      height: 62,
      rx: 9,
      fill: "#1c2a0a",
      stroke: "#eab308",
      "stroke-width": 2,
    }),
    svgElement(
      "text",
      {
        x: centerX,
        y: 247,
        "text-anchor": "middle",
        fill: "#eab308",
        "font-size": 11,
        "font-weight": 700,
      },
      "🏆 組冠軍",
    ),
    svgElement(
      "text",
      {
        x: centerX,
        y: 270,
        "text-anchor": "middle",
        fill: "#f1f5f9",
        "font-size": 13,
      },
      `${model.champion || "待定"}${model.championUnverifiable ? " ◦" : ""}`,
    ),
  );
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
