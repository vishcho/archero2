# 弓箭傳說2 明星賽事紀錄（archero2-web）

記錄《弓箭傳說2》（Archero 2）明星賽事的靜態網站與資料庫。
收錄**兩種賽事**，兩者制度不同、資料結構也不同，全站一律分開呈現：

| 賽事           | 週期     | 賽制                                | 收錄資料                   |
| -------------- | -------- | ----------------------------------- | -------------------------- |
| **明星盃**     | 兩週一輪 | 資格賽 → 8 組 × 8 人淘汰賽 → 總決賽 | 排名、對陣、逐場戰報       |
| **超級明星盃** | 四週一輪 | 受邀制（賽制待補）                  | 選手配置（精靈裝備與附魔） |

> **用字統一**：一律寫「明星**盃**」，勿用「杯」；合稱時用「明星賽事」。
> 兩者是不同賽事，**不要混稱「明星賽」**。

純靜態網站，無建置流程、無相依套件（Tailwind 走 CDN）。

## 這個 repo 的用途

遊戲內只看得到「當下」——賽事結束後對陣表就被下一屆洗掉，沒有歷史查詢。
這個 repo 把每屆賽事從截圖固化成可查詢、可比對、可累積的紀錄。

具體要解決的問題：

1. **留存賽事歷史**：把手機截圖轉成結構化 JSON，讓歷屆成績不隨遊戲改版消失。
2. **跨屆追蹤選手**：同一位選手在各屆的戰力、名次、通關時間變化；
   並處理同名玩家的辨識問題（`flag` 欄位）。
3. **賽前情報與競猜輔助**：用歷史資料產出對陣分析與競猜指南，
   在下注前判斷各組勝算。
4. **個人養成規劃**：資源累積推估與長期規劃筆記（`notes/`）。

**運作模式是「截圖 → AI 抽取 → 驗證 → 產出」的資料管線**：
截圖是原料（不進 git），JSON 是唯一真實來源，Markdown 戰報與網站頁面都是它的呈現層。
`tools/` 的腳本負責讓 JSON 與 Markdown 保持一致、並在寫入前擋掉不完整的資料。
完整規則見 [notes/workflows/](notes/workflows/)。

## 快速開始

因為頁面用 `fetch` 讀取本地 JSON，直接雙擊 HTML 會被瀏覽器 CORS 擋下，
需起一個本地 HTTP server：

```bash
# 專案根目錄執行（任選其一）
python -m http.server 8000
```

然後開 <http://localhost:8000>。

## 頁面

| 頁面           | 說明                                                                     | 資料來源                     |
| -------------- | ------------------------------------------------------------------------ | ---------------------------- |
| `index.html`   | 首頁：**依賽事分成兩區塊**，各自列出歷屆                                 | `data/cups.json` + 各賽事    |
| `season.html`  | 單屆詳情，`?cup=` 指定賽事、`?id=` 指定屆次                              | `data/{cup}/{id}.json`       |
| `bracket.html` | 淘汰賽 SVG 對陣圖（8 組、每組 8 人），`?id=` 指定屆次，預設最新一屆      | `data/star-cup/{id}.json`    |

`season.html` 依該賽事的 `schema` 切換呈現方式：

- `schema: "season"`（明星盃）→ 資格賽 / 淘汰賽 / 總決賽三個分頁
- `schema: "roster"`（超級明星盃）→ 單張選手配置表

`bracket.html` 是明星盃專屬（對陣圖是明星盃才有的概念），不吃 `?cup=`。
`?cup=` 省略時預設 `star-cup`，舊有 `season.html?id=` 連結仍可用。

**兩種賽事怎麼分辨**：明星盃金色、超級明星盃紫色，色票由 `data/cups.json` 的
`accent` 指定，經 `accentOf()` 套用，所有頁面一致。
共用常數與 fetch 工具在 [js/common.js](js/common.js)。

## 目錄結構

頂層依「誰讀它」分成三類：`data/` 機器讀、`docs/` 賽事文件、`notes/` 個人筆記。

```
archero2/
├── index.html          # 賽季列表首頁
├── season.html         # 賽季詳情頁（tabs：資格賽/淘汰賽/總決賽）
├── bracket.html        # 淘汰賽 SVG 對陣圖（?id= 指定屆次）
├── js/
│   └── common.js       # 共用常數（DATA_BASE、徽章色表）與工具（statusBadge / prevBadge / fetch helpers）
├── data/               # 網站唯一結構化資料源（執行期依賴，勿搬動）
│   ├── cups.json       # 賽事系列登記表（名稱、週期、schema、色票）
│   ├── star-cup/                        # 明星盃（schema: season）
│   │   ├── seasons.json                 # 該賽事的屆次 id 清單（舊→新）
│   │   └── 2026-06-19.json …            # 單屆完整資料（見下方 schema）
│   └── super-star-cup/                  # 超級明星盃（schema: roster）
│       ├── seasons.json
│       └── 2026-08-06.json              # 選手配置
├── docs/               # 賽事文件（人讀）
│   ├── README.md                        # 文件索引（由腳本生成，勿手改）
│   ├── sources.md                       # 截圖批次索引（截圖本體不進 git）
│   ├── activity-calendar.md             # 遊戲活動行事曆
│   ├── star-cup/                        # 明星盃
│   │   ├── star-cup.md                  # 賽制規則與競猜機制
│   │   ├── {date}-round{N}-matchup.md       # 賽前對陣分析
│   │   ├── {date}-round{N}-betting-guide.md # 競猜指南
│   │   └── {date}-tournament-results.md     # 逐場戰報（由 data/ 渲染）
│   └── super-star-cup/                  # 超級明星盃
│       ├── super-star-cup.md            # 賽制規則與欄位定義
│       └── {date}-{主題}-roster.md      # 選手配置表（由 data/ 渲染）
├── notes/              # 個人筆記（與賽事紀錄無關）
│   ├── 弓箭傳說2-長期規劃.md            # 資源累積推估
│   └── workflows/                       # 資料整理與自動化流程
│       ├── star-cup-pre-match-workflow.md
│       └── tournament-results-workflow.md
├── tools/              # Node.js 腳本（無相依套件，直接 node 執行）
│   ├── validate-season.mjs                     # 結構驗證：欄位型別、值域、必填
│   ├── validate-tournament-results.mjs         # 邏輯驗證：淘汰賽晉級自洽
│   ├── render-tournament-results.mjs           # data JSON → 戰報 md
│   ├── import-tournament-results-from-doc.mjs  # 戰報 md → data JSON（僅舊資料遷移）
│   └── build-docs-index.mjs                    # 由目錄結構生成 docs/README.md
├── img/
│   └── fire.png        # 網站 favicon（img/ 只放頁面會引用的資產）
├── tmp/                # 中繼檔（對陣暫存 JSON 等）
└── screenshots/        # 原始截圖 — gitignored，只留本地供 AI 分析
    └── star-cup/{YYYY-MM-DD-用途}/
```

**資料與文件的分工**：`data/` 是網站唯一的結構化資料來源，屬於執行期依賴，
搬動它會直接讓網站讀不到資料；`docs/` 放 JSON 裝不下的東西——規則、逐場戰報、
同名玩家考證。同一筆成績以 `data/` 的 JSON 為準。

**截圖不進 git**：原始截圖放 `screenshots/`（已 gitignore），分析產出
（`data/*.json`、`docs/*.md`）才 commit。每批截圖在 [docs/sources.md](docs/sources.md)
登記位置、張數與產出，維持可追溯性。截圖如需備份請另外用雲端同步。

## 資料格式

### `data/cups.json` — 賽事系列登記表

新增一種賽事只需在這裡增列一筆，頁面骨架不用改：

```json
{
  "slug": "super-star-cup",   // 同時是 data/ 與 docs/ 的目錄名
  "name": "超級明星盃",
  "cadence": "四週一輪",
  "format": "選手配置紀錄（賽制資料尚未納入管線）",
  "schema": "roster",          // season | roster — 決定套哪組驗證與哪種頁面
  "accent": "violet",          // 全站強調色，見 js/common.js 的 CUP_ACCENT
  "docs": "docs/super-star-cup/super-star-cup.md"
}
```

**兩種賽事刻意不共用 schema**：明星盃有資格賽與對陣，超級明星盃只有選手配置，
硬套同一組欄位會兩邊都是空欄。共用的只有 `cups.json` 這層外殼。

### `data/{cup}/seasons.json` — 該賽事的屆次 id 清單

```json
["2026-06-19", "2026-07-03"]
```

只是 id 陣列（舊→新），**每個賽事各一份**；日期、主題、狀態等都從
各屆的 `data/{cup}/{id}.json` 讀，避免同一欄位要改兩個檔。

### `data/super-star-cup/{id}.json` — 超級明星盃單屆（schema: roster）

```json
{
  "id": "2026-08-06",          // 該輪起始日，非紀錄日
  "date": "2026/8/6",
  "theme": "精靈季 1",
  "status": "in_progress",
  "recorded_at": "2026-08-09", // 資料抓取時間
  "source": "好友 ID 查詢個人資訊 ＋ 超級明星盃介面",
  "notes": ["…"],
  "roster": [
    {
      "player_id": "101874870",
      "name": "koeee",
      "spirit_awe": "紅",       // 紅 | 金 | 金1–金3 | 未知；省略=未取得
      "spirit_assist": "紅",
      "enchants": [null, null, "精靈傷害+30%", "精靈暴擊傷害+30%"]
    }
  ]
}
```

**`enchants` 索引即槽位**：中間空槽填 `null` 佔位不可壓縮，否則後段詞條會位移；
尾端空槽直接省略。欄位語意與「空值 vs 未知」的區別見
[docs/super-star-cup/super-star-cup.md](docs/super-star-cup/super-star-cup.md)。

### `data/star-cup/{id}.json` — 明星盃單屆（schema: season）

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

| 欄位             | 說明                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| `name`           | 玩家名稱                                                                |
| `flag`           | `⚠`＝同名多人（上屆對應僅供參考）、`≈`＝疑為同一人（名稱微異）          |
| `power`          | 本屆戰力                                                                |
| `qualifier_rank` | 本屆資格賽排名                                                          |
| `qualifier_time` | 本屆資格賽通關時間                                                      |
| `prev_best`      | 上屆最終名次徽章：`1強`/`2強`/`4強`/`8強`/`16強`/`32強`/`64強`/`未入選` |
| `prev_power`     | 上屆戰力                                                                |
| `prev_progress`  | 上屆淘汰賽最佳進度（如 `10/10`）                                        |
| `prev_time`      | 上屆最佳通關時間（未達 10/10 記 `未通關`）                              |

`prev_best`（徽章式）與 `prev_power/progress/time`（明細式）兩種「上屆」表達
擇一使用即可，表格欄位會依資料自動調整。

#### `groups[].matches` 的逐場結果約定

淘汰賽結果寫進 `groups[].matches`，作為 `docs/star-cup/YYYY-MM-DD-tournament-results.md`
的結構化來源：

```json
{
  "round": "R1",
  "slot": "A",
  "p1": {
    "name": "玩家A",
    "progress": 10,
    "time": "03:07.25",
    "power": "13.24M"
  },
  "p2": {
    "name": "玩家B",
    "progress": 10,
    "time": "03:52.27",
    "power": "6.64M"
  },
  "winner": "玩家A",
  "loser": "玩家B",
  "notes": ["雙方滿時，依遊戲標示判定勝負"]
}
```

- `round`：`R1` / `R2` / `決賽`
- `slot`：R1 使用 `A`/`B`/`C`/`D`，R2 使用 `upper`/`lower`，決賽使用 `final`
- `power`：對戰彈窗的賽時戰力；R2/決賽若截圖不顯示可省略
- `champion_power`：該組冠軍賽時戰力
- `champion_current_power`：樹狀圖目前戰力；無資料時省略

完整自動化流程見 [notes/workflows/tournament-results-workflow.md](notes/workflows/tournament-results-workflow.md)。

## 總決賽資料

`grand_finals` 與頂層 `champion` **目前尚未納入資料管線**——現行截圖流程只涵蓋到
淘汰賽（`groups[].matches`），因此各屆這兩個欄位皆為 `null`。這是尚未實作，
不是待填的空欄位。頁面在 `status` 為 `finished` 時會顯示「總決賽資料未收錄」以示區別。

要補齊需新增一批總決賽截圖來源，並擴充抽取流程；schema 已預留欄位型別檢查。

## 新增一屆賽事的流程

**先確認是哪一種賽事**——兩者的 id 慣例都是「該輪起始日」，但檔案放在不同目錄。

### 明星盃

1. 在 `data/star-cup/` 新增 `{id}.json`（複製上一屆改內容，注意 players 要照對陣位置排序）
2. 在 `data/star-cup/seasons.json` 尾端加上新 id
3. 截圖放進 `screenshots/star-cup/{YYYY-MM-DD-用途}/`，並在 `docs/sources.md` 登記
4. 逐場戰報、考證註記寫進 `docs/star-cup/`
5. 賽事結束後把該屆 `status` 改為 `finished`、填入各組 `champion`/`runner_up`

### 超級明星盃

1. 在 `data/super-star-cup/` 新增 `{id}.json`（`roster` 陣列，注意 `enchants` 槽位）
2. 在 `data/super-star-cup/seasons.json` 尾端加上新 id
3. 截圖放進 `screenshots/super-star-cup/{YYYY-MM-DD-用途}/`，並在 `docs/sources.md` 登記
4. 配置表寫進 `docs/super-star-cup/{date}-{主題}-roster.md`

### 兩者共通：驗證與索引生成

```bash
node tools/validate-season.mjs --all              # 結構：依 cups.json 的 schema 分派驗證
node tools/validate-tournament-results.mjs data/star-cup/{id}.json  # 邏輯：晉級自洽（僅明星盃）
node tools/build-docs-index.mjs                   # 重生 docs/README.md
```

`validate-season.mjs --all` 會走訪 `cups.json` 登記的每個賽事目錄，
各自檢查 `seasons.json` 與該目錄檔案是否對應。

## 賽制速覽

- **明星盃**：資格賽（全員，前 64 名晉級）→ 淘汰賽（8 組 × 8 人，組冠軍晉級）
  → 總決賽（8 人單淘汰）。完整規則與競猜機制見
  [docs/star-cup/star-cup.md](docs/star-cup/star-cup.md)。
- **超級明星盃**：四週一輪、受邀制，賽制細節待補；目前收錄選手配置。
  見 [docs/super-star-cup/super-star-cup.md](docs/super-star-cup/super-star-cup.md)。

## 已知限制與後續方向

已完成的架構調整（2026-08-09）：頂層依讀者拆成 `data/` / `docs/` / `notes/`、
資料源路徑收斂為 `DATA_BASE`、`status` 值域統一、新增結構驗證與索引生成腳本。

尚未處理，屆數增加後才會真正變痛的：

### 跨屆選手資料仍靠名稱字串比對

`prev_best` / `prev_power` 等「上屆」欄位是**冗餘複製**——同一位選手的成績同時
存在於本屆的 `prev_*` 與上屆的 `qualifier`/`matches`，兩邊可能不一致，且完全
依賴玩家名稱比對（所以才需要 `⚠` / `≈` 兩種 flag 人工標註）。

要真正做到「跨屆追蹤選手」，需要一份 `data/players.json` 給每位選手穩定 id，
各屆只存 id 參照，`prev_*` 改由腳本從上屆資料推導而非手抄。
屆數還少時現況可接受，但這是目前最大的資料模型債。

### 總決賽尚未納入管線

見上方「總決賽資料」一節。

### 驗證未自動化

`tools/` 的驗證需手動執行。若之後接 CI 或 git hook，可在 commit 前擋下
結構錯誤的資料，避免像 `status` 值域分岔那樣累積數屆才被發現。
