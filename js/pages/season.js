const seasonParams = new URLSearchParams(location.search);
const seasonId = seasonParams.get("id");
const seasonCup = seasonParams.get("cup") || DEFAULT_CUP;

function renderQualifier(data) {
  if (!data.qualifier?.length) return messageState("尚無資格賽資料");
  return createTable(
    ["排名", "玩家", "流派/稱號", "通關時間"],
    data.qualifier.map((player) => [
      `#${player.rank}`,
      player.name,
      player.title,
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
    card.append(
      createTable(
        ["場次", "排名", "玩家", "戰力", "資格賽時間", "上屆"],
        group.players.map((player) => [
          slots.get(player),
          player.qualifier_rank == null ? null : `#${player.qualifier_rank}`,
          displayName(player),
          player.power,
          player.qualifier_time,
          player.prev_best,
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
  return createTable(
    ["名次", "玩家", "戰力"],
    data.grand_finals.results.map((player) => [
      player.rank === 1 ? "🏆 冠軍" : `第 ${player.rank} 名`,
      player.name,
      player.power,
    ]),
  );
}

function renderRoster(data) {
  if (!data.roster?.length) return messageState("尚無選手配置資料");
  const enchantCount = Math.max(
    ...data.roster.map((player) => (player.enchants || []).length),
  );
  return createTable(
    [
      "ID",
      "角色名稱",
      "精靈威攝",
      "精靈協戰",
      ...Array.from({ length: enchantCount }, (_, index) => `附魔${index + 1}`),
    ],
    data.roster.map((player) => [
      player.player_id,
      player.name,
      player.spirit_awe,
      player.spirit_assist,
      ...Array.from(
        { length: enchantCount },
        (_, index) => player.enchants?.[index]?.text,
      ),
    ]),
  );
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
