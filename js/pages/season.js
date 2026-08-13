const seasonParams = new URLSearchParams(location.search);
const seasonId = seasonParams.get("id");
const seasonCup = seasonParams.get("cup") || DEFAULT_CUP;

function renderQualifier(data) {
  if (!data.qualifier?.length) return messageState("尚無資格賽資料");
  const hasTitle = data.qualifier.some((player) => player.title);
  return createTable(
    ["排名", "玩家", ...(hasTitle ? ["流派/稱號"] : []), "通關時間"],
    data.qualifier.map((player) => [
      `#${player.rank}`,
      player.name,
      ...(hasTitle ? [player.title] : []),
      player.time,
    ]),
  );
}

function renderGroups(data) {
  if (!data.groups?.length) return messageState("尚無分組資料");
  const root = element("div");
  const bracketLink = element("a", {
    className: "block text-right text-sm text-yellow-400 hover:underline mb-4",
    text: "查看對陣圖 →",
    attributes: {
      href: `bracket.html?id=${encodeURIComponent(data.id)}`,
    },
  });
  root.append(bracketLink);
  for (const group of data.groups) {
    const card = element("section", {
      className:
        "bg-slate-800 border border-slate-700 rounded-xl mb-5 overflow-hidden",
    });
    card.append(
      element("h3", {
        className: "bg-slate-700 px-4 py-2.5 font-bold text-yellow-300",
        text: `第 ${group.id} 組`,
      }),
    );
    const slots = playerSlotMap(group);
    const hasRank = group.players.some(
      (player) => player.qualifier_rank != null,
    );
    const hasPrevBest = group.players.some((player) => player.prev_best);
    const hasPrevDetail = group.players.some(
      (player) => player.prev_power || player.prev_progress || player.prev_time,
    );
    card.append(
      createTable(
        [
          "場次",
          ...(hasRank ? ["排名"] : []),
          "玩家",
          "戰力",
          "資格賽時間",
          ...(hasPrevBest ? ["上屆"] : []),
          ...(hasPrevDetail ? ["上屆戰力", "上屆成績"] : []),
        ],
        group.players.map((player) => [
          slots.get(player),
          ...(hasRank
            ? [
                player.qualifier_rank == null
                  ? null
                  : `#${player.qualifier_rank}`,
              ]
            : []),
          displayName(player),
          player.power,
          player.qualifier_time,
          ...(hasPrevBest ? [previousBadge(player.prev_best)] : []),
          ...(hasPrevDetail
            ? [
                player.prev_power,
                player.prev_progress
                  ? `${player.prev_progress}｜${player.prev_time || "未通關"}`
                  : null,
              ]
            : []),
        ]),
      ),
    );
    if (group.champion) {
      card.append(
        element("div", {
          className: "px-4 py-2 bg-slate-900 text-xs text-slate-400",
          text: `🏆 冠軍：${group.champion}｜亞軍：${group.runner_up || "—"}`,
        }),
      );
    }
    root.append(card);
  }
  return root;
}

function renderFinals(data) {
  if (!data.grand_finals) {
    return messageState(
      data.status === "finished" ? "本屆總決賽資料尚未收錄" : "總決賽尚未開始",
    );
  }
  const root = element("div", { className: "space-y-5" });
  root.append(
    createTable(
      ["名次", "玩家", "戰力"],
      data.grand_finals.results.map((player) => [
        finalRankLabel(player.rank),
        player.name,
        player.power,
      ]),
    ),
  );
  const path = element("section", {
    className: "bg-slate-800 rounded-xl overflow-hidden",
  });
  path.append(
    element("h3", {
      className: "bg-slate-700 px-4 py-2.5 font-bold text-yellow-300",
      text: "對戰路徑",
    }),
  );
  for (const [round, label] of [
    ["R1", "8強"],
    ["R2", "4強"],
    ["決賽", "決賽"],
  ]) {
    const matches = data.grand_finals.bracket.filter(
      (match) => match.round === round,
    );
    if (!matches.length) continue;
    const section = element("div", {
      className: "px-4 py-3 border-t border-slate-700",
    });
    section.append(
      element("h4", { className: "text-xs text-slate-500 mb-2", text: label }),
    );
    for (const match of matches) {
      section.append(
        element("div", {
          className: "text-sm mb-1.5",
          text: `${match.p1.name} vs ${match.p2.name}　▶ ${match.winner}`,
        }),
      );
    }
    path.append(section);
  }
  root.append(path);
  return root;
}

function previousBadge(value) {
  if (!value) return null;
  return element("span", {
    className: `text-xs px-2 py-0.5 rounded-full font-semibold ${PREV_BADGE_CLASS[value] || "bg-slate-600 text-slate-200"}`,
    text: value,
  });
}

function finalRankLabel(rank) {
  if (rank === 1) return "🏆 冠軍";
  if (rank === 2) return "🥈 亞軍";
  if (rank === 3) return "🥉 並列 4強";
  return "並列 8強";
}

function tierNode(value) {
  if (value == null) return null;
  const className =
    value === "紅"
      ? "text-red-400 font-medium"
      : value.startsWith("金")
        ? "text-amber-300 font-medium"
        : value === "未知"
          ? "text-slate-500 font-medium"
          : "text-slate-300";
  return element("span", { className, text: value });
}

function enchantNode(enchant) {
  if (!enchant) return null;
  const root = element("span", {
    className: enchant.color === "紅" ? "text-red-400" : "text-amber-300",
  });
  root.append(
    element("span", {
      className: `inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${enchant.color === "紅" ? "bg-red-500" : "bg-amber-400"}`,
      attributes: { "aria-hidden": "true" },
    }),
    document.createTextNode(enchant.text),
  );
  return root;
}

function renderRoster(data) {
  if (!data.roster?.length) return messageState("尚無選手配置資料");
  const enchantCount = Math.max(
    ...data.roster.map((player) => (player.enchants || []).length),
  );
  const root = element("div", { className: "space-y-5" });
  if (data.notes?.length || data.recorded_at || data.source) {
    const notes = element("aside", {
      className:
        "bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-xs text-slate-400 space-y-1",
    });
    for (const note of data.notes || [])
      notes.append(element("p", { text: `• ${note}` }));
    notes.append(
      element("p", {
        className: "pt-1 text-slate-500",
        text: `紀錄時間：${data.recorded_at || "—"}｜來源：${data.source || "—"}`,
      }),
    );
    root.append(notes);
  }
  root.append(
    createTable(
      [
        "ID",
        "角色名稱",
        "精靈威攝",
        "精靈協戰",
        ...Array.from(
          { length: enchantCount },
          (_, index) => `附魔${index + 1}`,
        ),
      ],
      data.roster.map((player) => [
        player.player_id,
        player.name,
        tierNode(player.spirit_awe),
        tierNode(player.spirit_assist),
        ...Array.from({ length: enchantCount }, (_, index) =>
          enchantNode(player.enchants?.[index]),
        ),
      ]),
    ),
  );
  return root;
}

async function loadSeason() {
  const state = document.getElementById("page-state");
  const content = document.getElementById("content");
  state.append(messageState("載入中…", "loading"));
  try {
    const cup = await fetchCup(seasonCup);
    const data = await fetchSeason(seasonId, seasonCup);
    clear(state);
    document.title = `${data.date} ${cup.name}`;
    const title = document.getElementById("title");
    title.textContent = roundLabel(data)
      ? `${cup.name} ${roundLabel(data)}`
      : `${data.date} ${cup.name}`;
    title.className = `text-2xl font-bold ${accentOf(cup).text}`;
    document.getElementById("status").append(statusBadgeNode(data.status));
    document.getElementById("theme").textContent = themeLabel(data)
      ? `主題：${themeLabel(data)}`
      : "";
    document.getElementById("period").textContent = periodLabel(data) || "";

    if (cup.schema !== "season") {
      content.append(renderRoster(data));
      return;
    }
    const views = {
      qualifier: () => renderQualifier(data),
      groups: () => renderGroups(data),
      finals: () => renderFinals(data),
    };
    const tabs = document.getElementById("tabs");
    tabs.classList.remove("hidden");
    const select = (name) => {
      clear(content).append(views[name]());
      tabs
        .querySelectorAll("button")
        .forEach((button) =>
          button.classList.toggle("active", button.dataset.tab === name),
        );
    };
    for (const [name, label] of [
      ["qualifier", "資格賽排名"],
      ["groups", "淘汰賽對陣"],
      ["finals", "總決賽"],
    ]) {
      const button = element("button", {
        className:
          "tab-btn px-4 py-2 rounded-lg text-sm font-semibold bg-slate-700",
        text: label,
        attributes: { "data-tab": name },
      });
      button.addEventListener("click", () => select(name));
      tabs.append(button);
    }
    select("qualifier");
  } catch (error) {
    renderError(state, error);
  }
}

loadSeason();
