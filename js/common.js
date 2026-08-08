// 三個頁面共用的常數與工具，直接以 <script src="js/common.js"> 載入（無建置流程）。

// 上屆名次徽章 — Tailwind class 版（season.html 表格用）
const PREV_BADGE_CLASS = {
  '1強':   'bg-yellow-500 text-black',
  '2強':   'bg-slate-300 text-black',
  '4強':   'bg-amber-700 text-white',
  '8強':   'bg-purple-600 text-white',
  '16強':  'bg-blue-600 text-white',
  '32強':  'bg-teal-600 text-white',
  '64強':  'bg-slate-600 text-slate-200',
  '未入選': 'bg-slate-800 text-slate-500',
};

// 上屆名次徽章 — inline style 版（bracket.html 的 SVG foreignObject 內無法用 Tailwind class）
const PREV_BADGE_STYLE = {
  '1強':   'background:#ca8a04;color:#000',
  '2強':   'background:#94a3b8;color:#000',
  '4強':   'background:#92400e;color:#fff',
  '8強':   'background:#6d28d9;color:#fff',
  '16強':  'background:#1d4ed8;color:#fff',
  '32強':  'background:#0f766e;color:#fff',
  '64強':  'background:#374151;color:#9ca3af',
  '未入選': 'background:#1e293b;color:#4b5563',
};

function prevBadge(val) {
  if (!val) return '';
  const cls = PREV_BADGE_CLASS[val] || 'bg-slate-600 text-slate-200';
  return `<span class="prev-best-badge ${cls}">${val}</span>`;
}

// status 值域固定為 in_progress | finished（由 tools/validate-season.mjs 強制檢查）。
// 未知值不靜默 fallback，顯示為「狀態不明」以便及早發現資料錯誤。
function statusBadge(status) {
  if (status === 'in_progress') {
    return '<span class="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">進行中</span>';
  }
  if (status === 'finished') {
    return '<span class="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded-full">已結束</span>';
  }
  return '<span class="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">狀態不明</span>';
}

// groups[].players 依對陣位置排序，相鄰兩人為一場：0,1=A、2,3=B、4,5=C、6,7=D
function matchLabel(i) {
  return 'ABCD'[i >> 1] || '';
}

// flag：⚠=同名多人（上屆對應僅供參考）、≈=疑為同一人（名稱微異）
function displayName(p) {
  return p.flag ? `${p.name} ${p.flag}` : p.name;
}

// 資料源位置只在這裡定義一次；搬動 data/ 時只需要改這一行。
const DATA_BASE = 'data';

// 賽事系列（明星盃 / 超級明星盃）各自一個目錄，各自一份 seasons.json。
// 兩者 schema 不同（season vs roster），刻意不共用資料結構，只共用這層外殼；
// 之後再多一種賽事只需在 data/cups.json 增列，頁面骨架不用動。
const DEFAULT_CUP = 'star-cup';

async function fetchCups() {
  const res = await fetch(`${DATA_BASE}/cups.json`);
  return res.json();
}

async function fetchCup(slug) {
  const cups = await fetchCups();
  const cup = cups.find((c) => c.slug === slug);
  if (!cup) throw new Error(`data/cups.json 沒有 slug 為 ${slug} 的賽事`);
  return cup;
}

// cup 參數省略時預設明星盃，維持舊有 ?id= 連結可用。
async function fetchSeasonIds(cup = DEFAULT_CUP) {
  const res = await fetch(`${DATA_BASE}/${cup}/seasons.json`);
  return res.json();
}

async function fetchSeason(id, cup = DEFAULT_CUP) {
  const res = await fetch(`${DATA_BASE}/${cup}/${id}.json`);
  return res.json();
}

async function fetchAllSeasons(cup = DEFAULT_CUP) {
  const ids = await fetchSeasonIds(cup);
  return Promise.all(ids.map((id) => fetchSeason(id, cup)));
}

// 賽事強調色：明星盃金、超級明星盃紫，讓兩者在任何頁面都能一眼分辨。
const CUP_ACCENT = {
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500', chip: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500', chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
};

function accentOf(cup) {
  return CUP_ACCENT[cup?.accent] || CUP_ACCENT.yellow;
}

function cupChip(cup) {
  return `<span class="text-xs px-2 py-0.5 rounded-full border ${accentOf(cup).chip}">${cup.name}</span>`;
}
