function seasonSummary(cup, season) {
  if (cup.schema !== "season") {
    return `已收錄 ${(season.roster || []).length} 位選手配置`;
  }
  if (season.champion) return `🏆 冠軍：${season.champion}`;
  if (season.status === "finished") return "總決賽資料未收錄";
  return season.status === "upcoming" ? "尚未開賽" : "總決賽待定";
}

function createSeasonCard(cup, season) {
  const link = element("a", {
    className:
      "block bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-5 transition",
    attributes: {
      href: `season.html?cup=${encodeURIComponent(cup.slug)}&id=${encodeURIComponent(season.id)}`,
    },
  });
  const heading = element("div", { className: "flex items-center gap-2 mb-1" });
  heading.append(
    element("span", {
      className: "text-lg font-bold text-white",
      text: season.date,
    }),
  );
  if (roundLabel(season)) {
    heading.append(
      element("span", {
        className: "text-sm text-slate-400",
        text: roundLabel(season),
      }),
    );
  }
  heading.append(statusBadgeNode(season.status));
  const body = element("div");
  body.append(heading);
  if (themeLabel(season)) {
    body.append(
      element("div", {
        className: "text-sm text-slate-400",
        text: `主題：${themeLabel(season)}`,
      }),
    );
  }
  if (periodLabel(season)) {
    body.append(
      element("div", {
        className: "text-xs text-slate-500 mt-0.5",
        text: periodLabel(season),
      }),
    );
  }
  body.append(
    element("div", {
      className: "text-sm text-slate-500 mt-1",
      text: seasonSummary(cup, season),
    }),
  );
  link.append(body);
  return link;
}

async function loadIndex() {
  const state = document.getElementById("page-state");
  const container = document.getElementById("cups");
  state.append(messageState("載入中…", "loading"));
  try {
    const cups = await fetchCups();
    clear(state);
    if (!cups.length) return state.append(messageState("尚無賽事系列"));
    for (const cup of cups) {
      const seasons = (await fetchAllSeasons(cup.slug)).reverse();
      const section = element("section");
      section.append(
        element("h2", {
          className: `text-xl font-bold ${accentOf(cup).text} border-b border-slate-700 pb-2`,
          text: cup.name,
        }),
        element("p", {
          className: "text-xs text-slate-500 my-2",
          text: `${cup.cadence}｜${cup.format}`,
        }),
      );
      const cards = element("div", { className: "space-y-4" });
      if (seasons.length) {
        cards.append(...seasons.map((season) => createSeasonCard(cup, season)));
      } else {
        cards.append(messageState("尚無收錄"));
      }
      section.append(cards);
      container.append(section);
    }
  } catch (error) {
    renderError(state, error);
  }
}

loadIndex();
