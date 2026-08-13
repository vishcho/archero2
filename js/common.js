const DEFAULT_CUP = "star-cup";

const PREV_BADGE_CLASS = {
  "1強": "bg-yellow-500 text-black",
  "2強": "bg-slate-300 text-black",
  "4強": "bg-amber-700 text-white",
  "8強": "bg-purple-600 text-white",
  "16強": "bg-blue-600 text-white",
  "32強": "bg-teal-600 text-white",
  "64強": "bg-slate-600 text-slate-200",
  未入選: "bg-slate-800 text-slate-500",
};

const CUP_ACCENT = {
  yellow: {
    text: "text-yellow-400",
    bg: "bg-yellow-500",
    chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  },
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-500",
    chip: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
};

function accentOf(cup) {
  return CUP_ACCENT[cup?.accent] || CUP_ACCENT.yellow;
}

// This function only composes display text. It does not escape HTML and its
// result must only be assigned through textContent or another text-node API.
function displayName(player) {
  return player.flag ? `${player.name} ${player.flag}` : player.name;
}

function themeLabel(data) {
  return [data.season, data.theme].filter(Boolean).join("｜") || null;
}

function periodLabel(data) {
  const format = (date) => date.replace(/^\d{4}-0?/, "").replace(/-0?/, "/");
  const parts = [];
  if (data.qualifier_period) {
    parts.push(
      `預選賽 ${format(data.qualifier_period[0])} – ${format(data.qualifier_period[1])}`,
    );
  }
  if (data.knockout_period) {
    parts.push(
      `淘汰賽 ${format(data.knockout_period[0])} – ${format(data.knockout_period[1])}`,
    );
  }
  return parts.join("｜") || null;
}

function roundLabel(data) {
  return data.round ? `第 ${data.round} 屆` : null;
}
