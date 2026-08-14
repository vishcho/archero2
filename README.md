# 弓箭傳說2 明星賽事紀錄（archero2-web）

記錄《弓箭傳說2》（Archero 2）明星賽事的靜態網站與資料庫。
收錄**兩種賽事**，兩者制度不同、資料結構也不同，全站一律分開呈現：

| 賽事           | 週期     | 賽制                                | 收錄資料                   |
| -------------- | -------- | ----------------------------------- | -------------------------- |
| **明星盃**     | 兩週一輪 | 資格賽 → 8 組 × 8 人淘汰賽 → 總決賽 | 排名、對陣、逐場戰報       |
| **超級明星盃** | 四週一輪 | 受邀制（賽制待補）                  | 選手配置（精靈裝備與附魔） |

> **用字統一**：一律寫「明星**盃**」，勿用「杯」；合稱時用「明星賽事」。
> 兩者是不同賽事，**不要混稱「明星賽」**。

純靜態網站，頁面無建置流程、無 runtime 相依套件（Tailwind 走 CDN）；Node.js 腳本與 CI
負責資料驗證及文件索引生成。

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
npm run dev                   # 建議：與 npm run check 同一套工具鏈，只需 Node
python -m http.server 8000    # 備援：手邊沒有 Node 時
```

然後開 <http://localhost:8000>。連接埠被占用時用
`npm run dev -- --port 8001`。

資料或文件變更完成後，執行統一檢查：

```bash
npm run check
```

Codex、Claude Code 與其他 AI agents 的共用操作規範見 [AGENTS.md](AGENTS.md)；
任務專屬的資料抽取規則仍以 [notes/workflows/](notes/workflows/) 為準。

## 頁面

| 頁面           | 說明                                                                     | 資料來源                     |
| -------------- | ------------------------------------------------------------------------ | ---------------------------- |
| `index.html`   | 最新一屆下注狀態、資料覆蓋與歷史命中率                                  | 賽事 + 正式預測              |
| `bracket.html` | 8 組共 56 場的正式下注建議；賽後比較實際結果                             | `data/predictions/` + 賽果   |
| `history.html` | 歷屆正式下注成效                                                         | 正式預測 + 賽果              |
| `archive.html` | 明星盃與超級明星盃完整屆次入口                                           | `data/cups.json` + 各賽事    |
| `season.html`  | 單屆完整資料，`?cup=` 指定賽事、`?id=` 指定屆次                          | `data/{cup}/{id}.json`       |

`season.html` 依該賽事的 `schema` 切換呈現方式：

- `schema: "season"`（明星盃）→ 資格賽 / 淘汰賽 / 總決賽三個分頁
- `schema: "roster"`（超級明星盃）→ 單張選手配置表

`bracket.html` 是明星盃正式下注快照專屬，不吃 `?cup=`；沒有正式快照時會顯示明確錯誤。
`season.html` 的 `?cup=` 省略時預設 `star-cup`，舊連結仍可用。

**兩種賽事怎麼分辨**：明星盃金色、超級明星盃紫色，色票由 `data/cups.json` 的
`accent` 指定，經 `accentOf()` 套用，所有頁面一致。
共用常數與 fetch 工具在 [js/common.js](js/common.js)。

## 目錄結構

頂層依「誰讀它」分成三類：`data/` 機器讀、`docs/` 賽事文件、`notes/` 個人筆記。

```
archero2/
├── AGENTS.md          # 人與 AI agents 共用的操作契約與完成條件
├── CLAUDE.md          # Claude Code 載入 AGENTS.md 的薄入口
├── package.json       # 驗證、文件生成與統一 check 指令
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
├── tools/              # Node.js 資料驗證、匯入與渲染腳本
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
  "accent": "violet",          // 全站強調色
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
      "enchants": [
        null,                                          // 空槽佔位
        null,
        { "text": "精靈傷害+30%", "color": "紅" },     // color: 紅 | 黃
        { "text": "精靈暴擊傷害+30%", "color": "紅" }
      ]
    }
  ]
}
```

**`enchants` 索引即槽位**：中間空槽填 `null` 佔位不可壓縮，否則後段詞條會位移；
尾端空槽直接省略。`color` 是**詞條本身的品階**（紅 > 黃），與選手無關——
驗證器會檢查同一詞條在各選手間顏色一致。完整對照表、欄位語意與
「空值 vs 未知」的區別見
[docs/super-star-cup/super-star-cup.md](docs/super-star-cup/super-star-cup.md)。

### `data/star-cup/{id}.json` — 明星盃單屆（schema: season）

頂層欄位：

```json
{
  "id": "2026-07-03",        // = knockout_period[0]，屆次識別碼（非該屆起始日）
  "round": 2,                // 屆次序號，2026 年起累計
  "date": "2026/7/3",
  "theme": "獲得飛劍和流星流派技能",  // 該屆流派主題，可為 null
  "season": null,            // 跨屆季主題（如「精靈季」），可為 null
  "qualifier_period": ["2026-06-29", "2026-07-02"],  // 預選賽 4 天
  "knockout_period": ["2026-07-03", "2026-07-10"],   // 淘汰賽 8 天
  "status": "in_progress",   // upcoming | in_progress | finished
  "champion": null,          // 總決賽冠軍，未產生為 null
  "qualifier": [...],
  "groups": [...],
  "grand_finals": null
}
```

**一屆 = 預選賽 4 天 + 其後淘汰賽 8 天**（共 12 天跨兩個週期）。`id` 取淘汰賽
首日當識別碼，所以 **`id` 不是該屆起始日**——該屆真正起始日在 `qualifier_period[0]`，
勿從 `id` 推論。驗證器強制 `id === knockout_period[0]`。

`theme`（該屆流派主題）與 `season`（跨屆季主題）是兩層不同概念，兩者皆可為
`null`，但**欄位必須存在**——這樣「尚未公布」（明確寫 `null`）與「漏填」
（欄位不存在，會報錯）才能區分。完整定義見
[docs/star-cup/star-cup.md](docs/star-cup/star-cup.md) 的「屆次定義」。

`status` 為 `upcoming` 時 `qualifier` 與 `groups` 皆為空陣列（賽事還沒開始），
驗證器會放寬「groups 應為 8 組」的檢查，但反過來會擋下「upcoming 卻已有分組資料」。

- `qualifier`：資格賽排名 `[{ rank, name, time, title? }]`（`title` = 流派/稱號，選填）
- `groups`：淘汰賽分組 `[{ id, champion?, runner_up?, players: [...] }]`
- `grand_finals`：總決賽 `{ results: [{ rank, name, power }], bracket: [{ round, p1, p2, winner }] }`，未開賽時為 `null`

#### `groups[].players` 的排序約定（重要）

**對陣關係的唯一真實來源是 `groups[].matches`**，不是 `players` 的陣列位置。
`bracket.html` 自 2026-08-13 起改由 `js/bracket-view-model.js` 依 `matches[].round` /
`matches[].slot` 決定對陣結構，`players` 只用來補顯示屬性（`prev_best`、`qualifier_rank`、`flag`）。

`groups[].players` 的順序仍**不可排序**（它是籤位，不是名次），但不要用它推導「哪兩格對打」。

歷史上曾假設下列索引約定，**該假設已被證明不成立**，僅保留供理解舊資料：

```
players[0..3] = 對陣圖左側（上→下）、players[4..7] = 右側（上→下）
相鄰兩人為一場 R1：0,1 = A 場、2,3 = B 場、4,5 = C 場、6,7 = D 場
準決賽：A 勝者 vs C 勝者（上半）、B 勝者 vs D 勝者（下半）
```

⚠️ **已收錄資料並未一致遵守上述約定**，新增一屆前務必以該屆截圖為準，不要照本節推斷既有屆次。
2026-08-13 用 `groups[].matches` 反推各屆實際的「slot ↔ 籤位索引」對應，四屆各不相同：

| 屆次 | 符合本節（`A`=0,1） | `B`/`C` 互換（`A`=0,1 `B`=4,5） | 交錯（`A`=0,2 `B`=4,6） |
| --- | --- | --- | --- |
| 2026-06-19 | 8/32 | 17/32 | 0/32 |
| 2026-07-03 | **31/32** | 15/32 | 0/32 |
| 2026-07-17 | 14/32 | **29/32** | 0/32 |
| 2026-07-31 | 0/32 | 0/32 | **32/32** |

沒有任何一種對應能同時解釋四屆——2026-07-31 是交錯索引，其餘三屆偏向循序但都有例外。
成因未確認（可能是不同屆抽取時採用不同判讀，或截圖版面本身有變）。

**此問題已於 2026-08-13 修正**：`bracket.html` 不再依索引推導對戰，改讀 `matches`，
因此上表的差異不再影響畫面。`test/bracket-view-model.test.mjs` 對四屆實際資料回歸驗證
R1 配對與 `matches` 完全一致。歷史 `players` 順序本身尚未修正（需截圖佐證，見 PR 2 規劃）。

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

`grand_finals` 使用一張結果樹加七場詳細對戰，包含八名排名 `results` 與七場
`bracket`。名次採可由單淘汰結果證明的並列排名 `1,2,3,3,5,5,5,5`。它與分組
淘汰賽共用晉級驗證；八名參賽者必須是八組冠軍，決賽勝者必須等於頂層
`champion`。尚未收錄的歷史屆次維持 `null`。

四批截圖與三個取得時點見
[明星盃三階段截圖收集工作流](notes/workflows/star-cup-collection-workflow.md)。

## 新增一屆賽事的流程

**先確認是哪一種賽事**——兩者的 id 都是日期，但**取的日子不同**，檔案也放在不同目錄：

| 賽事       | id 取哪一天     | 理由                                     |
| ---------- | --------------- | ---------------------------------------- |
| 明星盃     | **淘汰賽首日**  | 排名／對陣／戰報都產生自淘汰賽           |
| 超級明星盃 | **該輪首日**    | 一輪只有一段期間，無預選賽／淘汰賽之分   |

明星盃的一屆橫跨預選賽與淘汰賽，`id` 落在該屆中段而非開頭——這是刻意的，
見上方 schema 說明與 [docs/star-cup/star-cup.md](docs/star-cup/star-cup.md)。

### 明星盃

1. 在 `data/star-cup/` 新增 `{id}.json`（複製上一屆改內容；`players` 保留截圖中的籤位順序，
   對陣關係一律填入 `groups[].matches`，不得由 `players` 陣列位置推導）
   - `id` 必須等於 `knockout_period[0]`，`round` 為上一屆 +1
   - 賽事還沒開始就先建檔時，`status` 用 `upcoming`、`qualifier` 與 `groups` 留空陣列
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
npm run check       # 所有 schema、players、淘汰賽邏輯與文件索引新鮮度
npm run docs:build  # 文件增刪或標題變更後，重生 docs/README.md
```

`npm run check` 是本 repo 對人與 AI agents 的統一完成門檻。它會走訪 `cups.json`
登記的每個賽事目錄、檢查 `seasons.json` 與實際檔案對應、驗證玩家登記簿、逐屆檢查
明星盃晉級邏輯，並確認生成的 `docs/README.md` 沒有過期。GitHub Actions 也執行同一指令。

基本欄位契約位於 `schemas/`；跨檔案 `player_id`、明星盃 id／期間、淘汰賽晉級與同詞條
顏色等規則由 domain validator 負責。修改正式資料的 import/backfill 工具應先加
`--dry-run` 預覽；候選資料通過驗證後才會以原子替換寫入，失敗不會截斷原檔。

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

### 跨屆選手資料正在轉換為穩定 ID

`prev_best` / `prev_power` 等「上屆」欄位是**冗餘複製**——同一位選手的成績同時
存在於本屆的 `prev_*` 與上屆的 `qualifier`/`matches`，兩邊仍可能不一致。

目前已有 `data/players.json` 以遊戲內 `player_id` 作為跨賽事主鍵，新取得的名片資料會由
`import-top64-profiles.mjs` 入庫，再用 `backfill-from-players.mjs` 回填賽季檔。尚未完成的是：
舊屆仍有部分資料只靠名稱與 `⚠` / `≈` 人工標註，且 `prev_*` 尚未全部改由前一屆推導。

### 歷史總決賽可能尚未收錄

舊屆次沒有總決賽原始截圖時，`grand_finals` 與 `champion` 維持 `null`，不得推測補值。

### 驗證與 fixtures

`npm run check` 已整合 JSON Schema、domain validator、合法／非法 fixtures 與既有驗證器。
新增重要資料規則時，必須同步加入合法與非法測試案例。
