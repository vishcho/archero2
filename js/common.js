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

function statusBadge(status) {
  return status === 'in_progress'
    ? '<span class="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">進行中</span>'
    : '<span class="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded-full">已結束</span>';
}

// groups[].players 依對陣位置排序，相鄰兩人為一場：0,1=A、2,3=B、4,5=C、6,7=D
function matchLabel(i) {
  return 'ABCD'[i >> 1] || '';
}

// flag：⚠=同名多人（上屆對應僅供參考）、≈=疑為同一人（名稱微異）
function displayName(p) {
  return p.flag ? `${p.name} ${p.flag}` : p.name;
}

async function fetchSeasonIds() {
  const res = await fetch('data/seasons.json');
  return res.json();
}

async function fetchSeason(id) {
  const res = await fetch(`data/${id}.json`);
  return res.json();
}

async function fetchAllSeasons() {
  const ids = await fetchSeasonIds();
  return Promise.all(ids.map(fetchSeason));
}
