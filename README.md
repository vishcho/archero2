# 弓箭傳說2 明星賽紀錄（archero2-web）

記錄《弓箭傳說2》（Archero 2）**明星杯**賽事的靜態網站與資料庫：
歷屆資格賽排名、淘汰賽對陣、總決賽結果，以及相關活動的截圖與統計。

純靜態網站，無建置流程、無相依套件（Tailwind 走 CDN）。

## 快速開始

因為頁面用 `fetch` 讀取本地 JSON，直接雙擊 HTML 會被瀏覽器 CORS 擋下，
需起一個本地 HTTP server：

```bash
# 專案根目錄執行（任選其一）
python -m http.server 8000
npx serve .
```

然後開 <http://localhost:8000>。

## 頁面

| 頁面          | 說明                                                                | 資料來源            |
| ------------- | -------------------------------------------------------------------- | ------------------- |
| `index.html`  | 首頁：歷屆明星賽列表（日期、主題、狀態、冠軍）                       | 所有 `data/{id}.json` |
| `season.html` | 單屆詳情：資格賽排名 / 淘汰賽對陣 / 總決賽三個分頁，`?id=` 指定屆次   | `data/{id}.json`    |
| `bracket.html`| 淘汰賽 SVG 對陣圖（8 組、每組 8 人），`?id=` 指定屆次，預設最新一屆   | `data/{id}.json`    |

**單一資料來源**：三個頁面都只讀 `data/`，更新成績只需要改 JSON，不用動 HTML。
共用的徽章色表與 fetch 工具在 [js/common.js](js/common.js)。

## 目錄結構

```
archero2-web/
├── index.html          # 賽季列表首頁
├── season.html         # 賽季詳情頁（tabs：資格賽/淘汰賽/總決賽）
├── bracket.html        # 淘汰賽 SVG 對陣圖（?id= 指定屆次）
├── js/
│   └── common.js       # 共用常數（徽章色表）與工具（statusBadge / prevBadge / fetch helpers）
├── data/
│   ├── seasons.json    # 賽季 id 清單（依時間舊→新排序）
│   ├── 2026-06-19.json # 單屆完整資料（見下方 schema）
│   └── 2026-07-03.json
├── docs/               # 規則、詳細戰報與分析（非網站資料源）
│   ├── star-cup.md                  # 明星杯規則（賽制、競猜）
│   ├── round1-tournament-results.md # 6/19 淘汰賽逐場戰報（含 R1/R2/決賽細節）
│   ├── round2-matchup.md            # 7/3 對陣表原始整理（含同名玩家考證註記）
│   ├── activity-calendar.md         # 遊戲活動日曆
│   ├── rune-ruins-stats.md          # 符文廢墟符文統計
│   └── sources.md                   # 截圖批次索引（截圖本體不進 git）
├── img/
│   └── fire.png        # 網站 favicon（img/ 只放頁面會引用的資產）
└── screenshots/        # 原始截圖 — gitignored，只留本地供 AI 分析
    ├── star-cup/{YYYY-MM-DD-用途}/
    └── rune-ruins/{YYYY-MM-DD}/
```

**docs/ 與 data/ 的分工**：`data/` 是網站唯一的結構化資料來源；`docs/` 放
JSON 裝不下的東西——規則、逐場戰報、同名玩家考證。同一筆成績以 `data/` 為準。

**截圖不進 git**：原始截圖放 `screenshots/`（已 gitignore），分析產出
（`data/*.json`、`docs/*.md`）才 commit。每批截圖在 [docs/sources.md](docs/sources.md)
登記位置、張數與產出，維持可追溯性。截圖如需備份請另外用雲端同步。

## 資料格式

### `data/seasons.json` — 賽季 id 清單

```json
["2026-06-19", "2026-07-03"]
```

只是 id 陣列（舊→新）；日期、主題、狀態等都從各屆的 `data/{id}.json` 讀，
避免同一欄位要改兩個檔。

### `data/{id}.json` — 單屆資料

頂層欄位：

```json
{
  "id": "2026-07-03",
  "date": "2026/7/3",
  "theme": "獲得飛劍和流星流派技能",
  "status": "in_progress",   // in_progress | finished
  "champion": null,          // 總決賽冠軍，未產生為 null
  "qualifier": [...],
  "groups": [...],
  "grand_finals": null
}
```

- `qualifier`：資格賽排名 `[{ rank, name, time, title? }]`（`title` = 流派/稱號，選填）
- `groups`：淘汰賽分組 `[{ id, champion?, runner_up?, players: [...] }]`
- `grand_finals`：總決賽 `{ results: [{ rank, name, power }], bracket: [{ round, p1, p2, winner }] }`，未開賽時為 `null`

#### `groups[].players` 的排序約定（重要）

**陣列順序 = 對陣位置**，`bracket.html` 和 `season.html` 的場次標籤都依此推導：

```
players[0..3] = 對陣圖左側（上→下）、players[4..7] = 右側（上→下）
相鄰兩人為一場 R1：0,1 = A 場、2,3 = B 場、4,5 = C 場、6,7 = D 場
準決賽：A 勝者 vs C 勝者（上半）、B 勝者 vs D 勝者（下半）
```

player 欄位（除 `name` 外皆選填，缺值頁面顯示 `—`）：

| 欄位             | 說明                                                        |
| ---------------- | ----------------------------------------------------------- |
| `name`           | 玩家名稱                                                    |
| `flag`           | `⚠`＝同名多人（上屆對應僅供參考）、`≈`＝疑為同一人（名稱微異） |
| `power`          | 本屆戰力                                                    |
| `qualifier_rank` | 本屆資格賽排名                                              |
| `qualifier_time` | 本屆資格賽通關時間                                          |
| `prev_best`      | 上屆最終名次徽章：`1強`/`2強`/`4強`/`8強`/`16強`/`32強`/`64強`/`未入選` |
| `prev_power`     | 上屆戰力                                                    |
| `prev_progress`  | 上屆淘汰賽最佳進度（如 `10/10`）                            |
| `prev_time`      | 上屆最佳通關時間（未達 10/10 記 `未通關`）                  |

`prev_best`（徽章式）與 `prev_power/progress/time`（明細式）兩種「上屆」表達
擇一使用即可，表格欄位會依資料自動調整。

## 新增一屆賽事的流程

1. 在 `data/` 新增 `{id}.json`（複製上一屆改內容，注意 players 要照對陣位置排序）
2. 在 `data/seasons.json` 尾端加上新 id
3. 截圖放進 `screenshots/star-cup/{YYYY-MM-DD-用途}/`，並在 `docs/sources.md` 登記
4. 逐場戰報、考證註記寫進 `docs/`
5. 賽事結束後把該屆 `status` 改為 `finished`、填入 `champion` 與各組 `champion`/`runner_up`

## 明星杯賽制速覽

資格賽（全員，前 64 名晉級）→ 淘汰賽（8 組 × 8 人，組冠軍晉級）→ 總決賽（8 人單淘汰）。
完整規則與競猜機制見 [docs/star-cup.md](docs/star-cup.md)。
