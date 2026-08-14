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
5. **先確認這批還沒入庫，再讀圖。** 來源目錄名不代表屆次，也不代表是新資料。跳過 Step 0 就會抽一批早就在 `data/` 裡的圖。

## Step 0 · 屆次歸屬與重複入庫檢查

**這一步是硬性門檻，未通過不得進入 Step 1，不得 `cp` 任何檔案。**

來源目錄的名稱與屆次無關——它可能是拍攝日、匯出日或任意日期。
實例：2026-08-13 拿到來源目錄 `2026-08-07`，內含檔名時間戳 `20260809` 的圖，
實際屬於 **2026-07-31（round4）**，且 56 場淘汰賽結果早已入庫。三個日期互不相同。

### 0-pre · 一屆＝兩個來源目錄

Syncthing 來源 `shared/archero2/` 的目錄**一個屆次會有兩個**，依**賽程階段**切分
（不是依拍攝日切分）。round4（精靈季＋旋轉球）的實況：

| 來源目錄 | 內容 | 張數 | Checkpoint |
| --- | --- | --- | --- |
| `2026-07-31/` | `淘汰賽對陣圖/` | 8 | **A**（賽前） |
| | `資排賽排名/` | 80 ＝ 16 排行榜 ＋ 64 名片（**混裝**） | **A** ＋ 名片 |
| `2026-08-07/` | `淘汰賽結果/` | 64 | **B** |
| | `總決賽結果/` | 8 | **C** |

所以拿到其中一個目錄時，**另外三批很可能在隔壁那個目錄裡**。開工前先 `ls` 母目錄
（`ls /mnt/c/Users/vishp/shared/archero2/`）看看同屆是否有第二個目錄，
不要抽完一批才發現另一半在別處——round4 的 matchup/rank 就是這樣一度被當成遺失。

⚠️ **目錄名是賽程階段，不是拍攝日。** round4 的三批 `Screenshot_*` 全部拍於
**2026-08-09 21:58–22:31 同一次連拍**，卻分屬 `2026-07-31/` 與 `2026-08-07/` 兩個目錄；
只有 matchup 那批（Telegram 轉存的 `photo_*.jpg`）真的來自 07-31。
兩個目錄名（07-31／08-07）與實際拍攝日（08-09）**三者互不相同**。

對應關係：第一個目錄名≈淘汰賽首日（＝季別 id），第二個目錄名≈賽後回收日。
但這只是慣例，**一律用 0a 的方法驗證，不要靠目錄名推斷**。

### 0a · 判斷屆次歸屬

依序用這三個證據對齊，**不要用來源目錄名**：

| 證據 | 怎麼用 |
| --- | --- |
| 圖內畫面 | 對陣圖／排行榜上的選手名，比對各屆 `data/star-cup/*.json` 的 `groups[].players` 與 `qualifier[]` |
| 張數指紋 | 64＝knockout-results、8＝matchup 或 grand-finals-results、16 左右＝qualifier-rank、64＝top64-profile |
| 檔名時間戳 | 只當**下界**參考：拍攝日必然晚於該屆淘汰賽首日，不能反推屆次 |

季別 id 是**淘汰賽首日**（`knockout_period[0]`），不是拍攝日、不是賽季首日。
張數指紋會撞號（8 張可能是 matchup 也可能是 grand-finals），**一定要看圖分辨**。

### 0b · 查該屆是否已入庫

**先看 `collection`**——這是各 checkpoint 的收錄狀態宣告（`complete` / `pending` / `missing`），
自 2026-08-13 起五屆皆已填寫，是最省事的第一手判據：

```bash
node -e "
const d=require('./data/star-cup/<季別>.json');
console.log('status:',d.status,'champion:',JSON.stringify(d.champion));
console.log('collection:',JSON.stringify(d.collection));
console.log('matches:',d.groups.map(g=>(g.matches||[]).length).join(','));
console.log('grand_finals:',d.grand_finals?'已收錄':'null');
"
node tools/check-screenshots.mjs --round round<N>
```

`collection` 是**宣告**，仍要跟實際內容對帳（宣告可能過期）。對照下表：

| 批次 | `collection` 鍵 | 已入庫的實據 | 未入庫的實據 |
| --- | --- | --- | --- |
| `knockout-results` | `knockout_results` | 8 組 `matches` 皆為 7（共 56 場） | `matches` 缺漏或為空 |
| `grand-finals-results` | `grand_finals` | `grand_finals` 為物件、`champion` 非空 | `grand_finals` 為 `null` |
| `qualifier-rank` | `qualifier` | `qualifier[]` 有 64 筆以上 | `qualifier[]` 短少或空 |
| `knockout-matchup` | `knockout_matchup` | `groups[].players` 每組 8 人 | 組別缺漏 |
| `top64-profile` | （無，非 checkpoint） | 該屆 roster 的 `player_id` 在 `players.json` 有名片紀錄 | 尚無紀錄 |

⚠️ 別把某個欄位是 `null` 讀成「我手上這批是新的」。2026-08-13 就踩過：
四屆 finished 的 `grand_finals` **全都是 `null`**，那代表「總決賽普遍未收錄」，
而不代表手上任何一批圖屬於哪一屆。判斷新舊要靠 0a 的屆次歸屬 + 該屆該批次的落地實況。

三個值的語意要分清楚，**`missing` 是結案、`pending` 是待辦**：

| 值 | 意思 | 該做什麼 |
| --- | --- | --- |
| `complete` | 已入庫 | 不要重抽（見 0c） |
| `pending` | 尚未收集或尚未入庫 | 找得到圖就抽 |
| `missing` | **已確認取不到** | 不要再去找、不要補值 |

現況：round1–3 的 `grand_finals` 為 `missing`（2026-08-13 使用者確認截圖不存在），
round4 為 `complete`。所以 `npm run check` 那三條 `champion 為空` 警告是**永久狀態**。

`collection` 的值一經入庫必須同步更新（`import-grand-finals.mjs` 會自動改 `grand_finals` 為
`complete`）；schema 要求四個鍵同時存在，validator 也會擋「已有 `grand_finals` 卻不是 `complete`」。

### 0c · 判定與去向

- **完全未入庫** → 進入 Step 1 正常抽取。
- **已入庫** → **中止抽取**。這批圖是既有資料的原始佐證，不是新資料。
  該做的是把證據補齊而非重抽：確認落地路徑、修正 manifest 的 `evidence_status`、
  在 `docs/sources.md` 補登記。要不要為了驗證既有資料而重讀圖，**交由使用者裁決**，
  不要自行展開雙盲比對——那是有第二來源時的做法，不是重複入庫的預設動作。
- **部分入庫**（例如 results 有、grand finals 沒有）→ 只抽缺的那幾個批次，
  已入庫的批次照「已入庫」處理。

## Step 1 · 落地與分類

**所有批次一律先落到 `screenshots/` 再分析**（round4 的 matchup/rank 就是沒走這步而一度遺失）。

**兩個來源目錄併入同一個屆次目錄**，目錄名一律用**淘汰賽首日**（＝季別 id），
不用第二個來源目錄的日期：

```text
shared/archero2/2026-07-31/  ┐
shared/archero2/2026-08-07/  ┘→ screenshots/star-cup/2026-07-31-round4/
```

```text
screenshots/star-cup/<淘汰賽首日>-round<N>/
├── manifest.json
├── qualifier-rank/        排行榜連拍          ← 來源目錄 1（混裝，需拆）
├── knockout-matchup/      8 組賽前對陣樹      ← 來源目錄 1
├── knockout-results/      8 組 ×（結果樹＋7 場）= 64  ← 來源目錄 2
├── grand-finals-results/  結果樹＋7 場 = 8    ← 來源目錄 2
└── top64-profile/         個人資訊名片（跨屆選手身分，非賽事 checkpoint）← 來源目錄 1（混裝，需拆）
```

`captured_at` 依**各批實際檔名時間戳**填，不要照抄來源目錄名——同屆五批可能同日連拍，
也可能像 round4 一樣 matchup 是 07-31、其餘四批全是 08-09。

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

- `original` — 本屆原始截圖，可作正式證據；**必須同時有圖與 `captured_at`**
- `missing` — 未取得，資料維持缺失。顯示分兩種：批次目錄不存在＝`⏳ 待拍`（還沒到拍攝時機），
  目錄存在卻空＝`❌ 缺件`（該拍而未取得）。**新屆次一律從這個值起**
- `placeholder` — 別屆代圖，**只能測版面，不得寫入 `data/`**，必須填 `purpose`

**manifest 必須反映磁碟實況，而且工具只抓得到其中一個方向。**

- 標 `original` 但目錄是空的（或缺 `captured_at`）→ 假宣告，2026-08-13 起 `check-screenshots.mjs`
  會列為 `⚠️` 並指名該改成 `missing`，**工具抓得到**。
- 標 `missing` 但目錄有圖 → **工具仍抓不到**。`classify()` 一遇 `missing` 就直接回 `count: 0`，
  磁碟上的真實張數會被丟棄，看起來與「真的沒圖」完全一樣。

所以 `missing` 這個值只有在**磁碟確實是空的**時候才成立。落地任何檔案後，
必須同步把該批次改成 `original` 並補 `captured_at`，否則證據會被自己的宣告藏起來。
落地後用 `ls` 直接數一次，別只信工具輸出：

```bash
for d in screenshots/star-cup/<季別>-round<N>/*/; do echo "$(ls "$d" | wc -l) $d"; done
```

**manifest 也要跟 `data/` 對帳。** 三方（manifest、磁碟、`data/`）任兩方不一致都是待修狀態：
`data/` 有 56 場結果、磁碟有 64 張圖、manifest 卻寫 `missing`，就是 2026-08-13 的實況。
同樣地，`groups_note` 之類的敘述若指向**不存在的批次目錄**，也要一併更正到實際路徑。

## Step 2 · 視覺抽取

逐張讀進 `tmp/` 暫存 JSON。各批次的**欄位語意、陷阱與完整性檢查點**寫在對應 workflow，
抽取前先讀該批的那一份：

| 批次 | workflow |
| --- | --- |
| `knockout-matchup` + `qualifier-rank` | [star-cup-pre-match-workflow.md](../../../notes/workflows/star-cup-pre-match-workflow.md) |
| `knockout-results` + `grand-finals-results` | [tournament-results-workflow.md](../../../notes/workflows/tournament-results-workflow.md) |
| `top64-profile` | [top64-profile-workflow.md](../../../notes/workflows/top64-profile-workflow.md) |
| 三個 checkpoint 的批次契約 | [star-cup-collection-workflow.md](../../../notes/workflows/star-cup-collection-workflow.md) |

### 籤位順序：照畫面記錄，但**不要推導對戰關係**

`groups[].players` 的**陣列順序＝對陣圖籤位**（不是名次，永遠不可排序）。
照該屆畫面由上而下、先左欄後右欄記錄即可。

⚠️ **不要從 `players` 索引推導「哪兩格對打」，也不要記錄 slot↔索引對應。**
2026-08-13（commit `5c33e77`、`d9c7ada`）已確認：四屆各用不同排列，
沒有任何索引規則能解釋全部，該假設**已被證明不成立並作廢**。渲染層
（`js/bracket-view-model.js`）改由 `matches[].round` / `matches[].slot` 決定對陣結構，
`players` 只供顯示屬性（`qualifier_rank`、`prev_best`、`flag`）。

所以：

- **對陣關係的唯一真實來源是 `groups[].matches`**，由**結果批次**的樹狀圖與對戰彈窗填入
- **賽前批次（matchup）不填 `matches`**——schema 允許省略，不要寫成空陣列（會觸發
  「R1 應有 4 場，得到 0」錯誤）
- 賽前只需記錄 `players`（籤位順序）與各人戰力；**不必、也不該**在 `groups_note` 或
  `docs/sources.md` 宣告 A/B/C/D 落在哪些索引，那是在復活已作廢的約定並製造假待辦
- 同理，**不要留下「賽果到位後回頭核對索引對應」這類待辦**——沒有人會用索引推導配對，
  該核對工作不存在

自我檢查：寫完 `groups_note` 後確認裡面**沒有**出現 `A`=[0,1] 這類索引對應宣告。

### 總決賽結果樹：讀法與名次規則

結果樹是 8 人單淘汰，**由外往內讀**，不是由上往下：

```text
最外圈 8 格 = 八強（4 場）
往內 4 格   = 四強勝者
皇冠兩側    = 準決賽勝者（2 位）
正中央加冠  = 冠軍
最下排 3 格 = 三四名戰（獨立一場，常常沒有對應彈窗）
```

⚠️ **不要把「皇冠旁的節點」當成亞軍**，那是準決賽勝者；亞軍＝決賽敗者，要看決賽彈窗。
2026-08-13 抽 round4 時就把最下排三四名戰的勝者 RV297 誤記為亞軍，
被「決賽敗者≠樹上亞軍」的自我檢查攔下——實際亞軍是 LD丨힘。

**名次是推導出來的，不是抽取出來的。** `tools/lib/domain.mjs` 強制名次多重集為
`1,2,3,3,5,5,5,5`：兩位準決賽敗者**並列 3**、四位八強敗者**並列 5**，沒有 4 也沒有 6/7/8。

- **三四名戰的結果不用來拆分並列 3**，即使畫面上打了而且看得出勝負。
  規則明寫「不得猜測同輪淘汰者的內部順序」。
- 八強敗者之間同理，一律 `5`。
- 入庫用 `node tools/import-grand-finals.mjs <tmp/*.json> <data/star-cup/*.json> --dry-run`，
  名次由工具從 `bracket` 推導並自帶交叉比對（樹上冠亞軍 vs 決賽勝敗、賽時戰力跨場快照一致性）。

自我檢查（總決賽最強的一條）：**8 位選手必須恰好等於該屆 8 組的 `groups[].champion`**。
少一個或多一個就是讀錯，而且這條完全獨立於結果樹，抓錯率很高。

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
| 對戰彈窗戰力（`p1.power`／`p2.power`／`champion_power`）不符 | 賽時戰力是**快照**不會變，**不符就是有一邊讀錯** |
| 樹狀圖戰力（`champion_current_power`）不符 | 「目前戰力」是**累積型**，兩批拍攝日不同就會長。差異小且單向增長屬正常，不是讀錯 |

⚠️ 兩種戰力**不同性質，不可混為一談**：彈窗內的是賽時快照（永久固定），
樹狀圖節點上的是選手當下戰力（會隨時間長）。同一張結果樹上兩者常常不相等。
實例：round4 第 1 組 08-06 批次抽到 `champion_current_power: 36.65M`，
08-09 批次的同一張樹顯示 **36.76M**——相隔 3 天的正常增長，不是誤差。

2026-08-13 對 round4 實測基準：對陣圖 64 格戰力 0 個不符、名片 `player_id` 63/63 一致、
504 次欄位比對 27 個差異全為累積型單向增長。**數值抽取可靠，名字字形才是風險所在。**

### 完成門檻

```bash
npm run check          # 唯一完成門檻，CI 跑同一條
npm run docs:build     # 文件增刪或標題變更後重生 docs/README.md
node tools/check-screenshots.mjs --round roundN
```

改 `data/` 的工具**先跑 `--dry-run`**（`import-grand-finals.mjs`、`import-top64-profiles.mjs`、
`backfill-from-players.mjs`、`import-tournament-results-from-doc.mjs` 都支援；
`import-top64-profiles.mjs` 的 usage 沒列出但確實可用）。

戰報要重生時**先 diff 再覆蓋**——`2026-06-19` 與 `2026-07-03` 兩份戰報有渲染器重現不出的
手工排版（欄寬、`⚠` 標記），直接渲染會**抹掉人工內容**：

```bash
node tools/render-tournament-results.mjs data/star-cup/<季別>.json /tmp/r.md
diff docs/star-cup/<戰報>.md /tmp/r.md   # 只有預期的新增段落才可覆蓋
```

`npm run check` 的既有 warning **不是失敗**，不要為了讓它安靜而動資料：

- 歷史屆 `status: finished` 但 `champion` 為空 → 總決賽未收錄，缺證據不得補值。
  round4 已於 2026-08-13 憑 8 張原圖入庫並消掉這條；**round1–3 已確認截圖取不到**
  （`collection.grand_finals: missing`），那三條是**永久警告**，不是待辦
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
- 不要在還沒拍的屆次先把 manifest 標成 `original`——**預先宣告等於假宣告**（斷言一份不存在的證據）。
  新屆次一律從 `missing` 起、批次目錄先不要建，落地後才改 `original` 並補 `captured_at`。
  2026-08-13 起 `check-screenshots.mjs` 會把「標 `original` 但目錄無圖」與「標 `original` 但缺
  `captured_at`」列為 `⚠️`，不必再靠人注意。
