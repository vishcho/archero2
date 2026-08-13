---
name: screenshot-extract
description: 把明星盃／超級明星盃的手機截圖轉成 data/ 的結構化 JSON。使用時機：拿到一批新截圖要入庫、要驗證既有資料是否抽對、批次混裝要分類、或要重新產生戰報。涵蓋落地與盤點、視覺抽取的判讀規則、雙盲比對驗證法，以及寫入前的完成門檻。
---

# 截圖抽取

這是 pipeline **唯一沒有腳本的一段**：

```
截圖 ──[本 skill：人／AI 讀圖]──► tmp/*.json ──[腳本]──► data/ ──[腳本]──► docs/ + 網站
       ↑ 沒有驗證器能攔住這裡的錯                    └─ schema + domain + fixtures 守得很嚴
```

下游驗證只能抓「型別錯、值域錯、關聯錯」。**抽取讀錯一個數字，所有驗證都會放行。**
所以本 skill 的重點不是「怎麼讀圖」，而是**怎麼在寫入前知道自己讀對了**。

## 鐵則

1. **讀不出來就留空。** 不猜。schema 允許缺值，`docs/sources.md` 記錄不確定性。
2. **`player_id` 是唯一身分。** 名字會改、會同名、會被 OCR 讀錯，永遠不因為名字相同就合併選手。
3. **不為了讓驗證安靜而改證據。** 既有資料是當時有截圖佐證的；新抽取與它衝突時**產出 diff 給人看**，不要覆蓋。
4. **`tmp/` 是未驗證中繼區。** 已 gitignore，正式資料一律進 `data/`，不得讓網站或文件依賴 `tmp/`。

## Step 1 · 落地與分類

**所有批次一律先落到 `screenshots/` 再分析**（round4 的 matchup/rank 就是沒走這步而一度遺失）。

```text
screenshots/star-cup/<淘汰賽首日>-round<N>/
├── manifest.json
├── qualifier-rank/        排行榜連拍
├── knockout-matchup/      8 組賽前對陣樹
├── knockout-results/      8 組 ×（結果樹＋7 場）= 64
├── grand-finals-results/  結果樹＋7 場 = 8
└── top64-profile/         個人資訊名片（跨屆選手身分，非賽事 checkpoint）
```

⚠️ **來源目錄名稱不可信，一定要抽樣看圖確認類型。**
實例：2026-07-31 的來源目錄叫「資排賽排名」，實際是 **16 張排行榜 + 64 張名片混裝**。
直接整包丟進 `qualifier-rank/` 會讓盤點工具數出 80 張而誤判齊全。

分類靠**看圖**，不能靠檔案大小（兩類尺寸範圍完全重疊）。兩類的區別：

| | 畫面特徵 |
| --- | --- |
| 排行榜 | 垂直列表，每列＝名次＋頭像＋名稱＋稱號＋`7-3→100%`＋通關時間。無彈窗 |
| 名片 | 大彈窗標題「個人資訊」，含用戶ID／公會／普通・困難・通天塔／魅力值／徽記／戰力 |

分類完寫 `manifest.json`（範例：`notes/workflows/screenshot-manifest.example.json`）。
`evidence_status` 只能是：

- `original` — 本屆原始截圖，可作正式證據
- `missing` — 未取得，資料維持缺失
- `placeholder` — 別屆代圖，**只能測版面，不得寫入 `data/`**，必須填 `purpose`

**manifest 必須反映磁碟實況。** 標了 `original` 但目錄是空的，是假宣告——
`node tools/check-screenshots.mjs --round roundN` 會報 `⏳ 待拍`，以工具輸出為準。

## Step 2 · 視覺抽取

逐張讀進 `tmp/` 暫存 JSON。各批次的**欄位語意、陷阱與完整性檢查點**寫在對應 workflow，
抽取前先讀該批的那一份：

| 批次 | workflow |
| --- | --- |
| `knockout-matchup` + `qualifier-rank` | [star-cup-pre-match-workflow.md](../../../notes/workflows/star-cup-pre-match-workflow.md) |
| `knockout-results` + `grand-finals-results` | [tournament-results-workflow.md](../../../notes/workflows/tournament-results-workflow.md) |
| `top64-profile` | [top64-profile-workflow.md](../../../notes/workflows/top64-profile-workflow.md) |
| 三個 checkpoint 的批次契約 | [star-cup-collection-workflow.md](../../../notes/workflows/star-cup-collection-workflow.md) |

### 籤位順序：以本屆截圖為準，不要照文件推斷

`groups[].players` 的**陣列順序＝對陣圖籤位**（不是名次，永遠不可排序）。
但「哪兩格對打」**各屆並不一致**——2026-08-13 以 `matches` 反推四屆：

| 屆次 | `A`=0,1（README 寫的） | `A`=0,1 `B`=4,5 | `A`=0,2 `B`=4,6（交錯） |
| --- | --- | --- | --- |
| 2026-06-19 | 8/32 | 17/32 | 0/32 |
| 2026-07-03 | **31/32** | 15/32 | 0/32 |
| 2026-07-17 | 14/32 | **29/32** | 0/32 |
| 2026-07-31 | 0/32 | 0/32 | **32/32** |

沒有一種對應能解釋全部四屆，成因未確認。所以：

- **抽取新一屆時，籤位順序一律照該屆對陣圖畫面記錄**，不要套用任何「約定」
- 抽完寫下該屆的 slot↔索引對應（放 `groups_note` 或 `docs/sources.md`），下次才有依據
- **驗證器完全不檢查位置語意**，抽錯不會被 `npm run check` 攔下，也不會被 domain validator 攔下

自我檢查：若該屆已有 `matches`，用它反推 A/B/C/D 各場兩人落在哪兩個索引，確認與你讀的畫面一致。

### 非資料的畫面元素

一律忽略：`名片`／`個人資訊`／`競技成就` 分頁、`切磋`／`添加好友`／`解除好友關係`／`前往營地` 按鈕、
讚數（頭像旁白色藥丸）、以及**畫面底部固定釘著的「自己的名次列」**（每張都一樣，不是當前選手）。

排行榜連拍時，被自己名次列遮住的尾段名次讀不到是正常的——只要覆蓋到前 64 名即可，
靠相鄰截圖的重疊名次合併，確認 1–64 每個名次恰出現一次（張數不是完整性的充分條件）。

### 字形陷阱

遊戲字體會讓這些難分辨，兩次抽取讀出不同結果很常見：

- 公會／稱號的裝飾字：`ARKΛ`（非 ARKA）、`FLΞX`（非 FLEX）
- 名稱前後綴：`ᴬᴷ` 上標、`ᶠˣ` 上標
- 分隔符：`丨`（U+4E28）vs `｜`（U+FF5C）vs `|`
- 公會前綴在排行榜被顯示成 `I매I`，名片上實為 `AK` — 已收錄於 `players.json` 的 `ocr_variants`
- 低解析度罕用字：`泰融`/`秦融`、`荃雉瓏`/`荃雄矓`、`賞`/`貴`

**遇到不確定：照可見字形記錄並標記不確定，不要正規化、不要音譯。**
既有 `players.json` 的 `ocr_variants` 已收錄一批已知變體，抽完可比對——命中就是已知情況，不是新錯誤。

## Step 3 · 寫入前驗證

### 雙盲比對（有第二來源時）

同一批圖若有兩次獨立抽取，逐欄位 diff。差異要**分類**而非全當錯誤：

| 差異型態 | 判讀 |
| --- | --- |
| 數值全部同方向增加 | **不是誤差**。`normal`/`hard`/`tower`/`charm`/`emblem` 是累積型欄位，兩批拍攝時間不同就會長 |
| 名字命中既有 `ocr_variants` | 已知字形變體，非新錯誤 |
| 僅分隔符字形不同 | 呈現差異，擇一並記錄 |
| 數值雙向散亂不一致 | **真的誤差**，回頭看圖重判 |
| 戰力（`power`）不符 | 賽時戰力是快照不會變，**不符就是有一邊讀錯** |

2026-08-13 對 round4 實測基準：對陣圖 64 格戰力 0 個不符、名片 `player_id` 63/63 一致、
504 次欄位比對 27 個差異全為累積型單向增長。**數值抽取可靠，名字字形才是風險所在。**

### 完成門檻

```bash
npm run check          # 唯一完成門檻，CI 跑同一條
npm run docs:build     # 文件增刪或標題變更後重生 docs/README.md
node tools/check-screenshots.mjs --round roundN
```

改 `data/` 的工具**先跑 `--dry-run`**（`import-top64-profiles.mjs`、`backfill-from-players.mjs`、
`import-tournament-results-from-doc.mjs` 都支援；`import-top64-profiles.mjs` 的 usage 沒列出但確實可用）。

`npm run check` 的既有 warning **不是失敗**，不要為了讓它安靜而動資料：

- 歷史屆 `status: finished` 但 `champion` 為空 → 總決賽未收錄，缺證據不得補值
- 顯示名稱對應多個 `player_id` → 這正是 `player_id` 存在的理由
- roster `player_id` 尚無名片紀錄 → 該屆 top64 還沒拍

### 抽取完成後

在 [`docs/sources.md`](../../../docs/sources.md) 登記一行：批次路徑、日期、張數、內容、產出。
沒有原圖的 clone 靠這份索引知道資料從哪來、缺了什麼。該檔是**手動維護**的
（即時齊全度看 `check-screenshots.mjs`，它只數本機檔案）。

## 不要做

- 不要把 `docs/` 的 Markdown 事實抄回 `data/`。`render-tournament-results.mjs` 是 data→md 的正向；
  反向的 `import-tournament-results-from-doc.mjs` **僅供舊資料遷移**，且會丟失 R2/決賽的 `power`
  與 `winner_power`（同名對戰靠它判勝負），不可用於日常往返。
- 不要手改 `docs/README.md`（由 `build-docs-index.mjs` 生成）。
- 不要 commit 截圖本體（`screenshots/**` 已 gitignore，只有 `manifest.json` 與 README 進 git）。
- 不要為了讓某屆「看起來完整」而用別屆代圖寫入 `data/`。
