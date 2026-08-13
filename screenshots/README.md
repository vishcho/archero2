# 截圖目錄結構

> 這份 README 進 git，`screenshots/` 底下的圖不進（見 `.gitignore`）。
> 沒有截圖的 clone 靠這份 README 知道規範、靠 [`docs/sources.md`](../docs/sources.md) 知道每批的實際內容。

## 路徑格式（新批次）

```text
screenshots/star-cup/<淘汰賽首日>-<roundN>/
├── manifest.json
├── qualifier-rank/
├── knockout-matchup/
├── knockout-results/
└── grand-finals-results/
```

- 日期是該屆 `id`，也就是淘汰賽首日，不是各批拍攝日。
- `manifest.json` 記錄各批的拍攝時間與 `original` / `missing` / `placeholder` 證據狀態；範例見
  [`screenshot-manifest.example.json`](../notes/workflows/screenshot-manifest.example.json)。
- **新屆次的 manifest 一律從 `missing` 起**，批次目錄先不要建；落地後才改 `original`
  並補該批實際檔名時間戳的 `captured_at`。預先標 `original` 是**假宣告**——斷言一份
  不存在的證據，`check-screenshots.mjs` 會列為 `⚠️`。
- `missing` 的顯示分兩種，依批次目錄是否存在判定：目錄不存在＝`⏳ 待拍`（還沒到拍攝時機），
  目錄存在卻空＝`❌ 缺件`（該拍而未取得）。
- 舊式 `YYYY-MM-DD-roundN-{rank,matchup,results,top64}` 平面目錄仍可由盤點工具讀取，
  但新一屆應使用 manifest。

一批（同一次拍的一組圖）＝一個資料夾。分析完成後在 `docs/sources.md` 登記一行。

## 手機端來源：一屆兩個目錄

Syncthing 來源 `shared/archero2/` 的目錄**一屆兩個**，依賽程階段切分，落地時併成一個屆次目錄：

```text
shared/archero2/<淘汰賽首日>/    淘汰賽對陣圖/(8)、資排賽排名/(排行榜＋名片混裝)   → checkpoint A ＋名片
shared/archero2/<賽後回收日>/    淘汰賽結果/(64)、總決賽結果/(8)                  → checkpoint B、C
                                          ↓ 併入
                    screenshots/star-cup/<淘汰賽首日>-<roundN>/
```

round4 實例：`2026-07-31/`（8＋80）＋ `2026-08-07/`（64＋8）→ `2026-07-31-round4/`。

**目錄名是賽程階段，不是拍攝日**：round4 的三批 `Screenshot_*` 全部拍於 2026-08-09
同一次連拍（21:58–22:31），卻分屬兩個目錄名；只有 matchup 那批（Telegram 轉存的
`photo_*.jpg`）真的來自 07-31。`manifest.json` 的 `captured_at` 依**各批實際檔名時間戳**填，
不要照抄來源目錄名。拿到其中一個目錄時，先 `ls` 母目錄確認同屆另一半在不在。

## 四種賽事批次與玩家名片

賽事資料分三個 checkpoint；玩家名片是獨立的跨賽事資料：

| checkpoint | type | 內容 | 張數 | 拍攝時機 | 消費者 |
| - | ---- | ---- | ---- | -------- | ------ |
| A | `qualifier-rank` | 資格賽排行榜連拍 | 以涵蓋 1–64 為準 | 淘汰賽首日 | `qualifier[]` |
| A | `knockout-matchup` | 8 組賽前對陣樹 | 8 | 淘汰賽首日 | `groups[].players[]`、賽前文件 |
| B | `knockout-results` | 8 組結果樹＋逐場彈窗 | 64 | 淘汰賽結束 | `groups[].matches`、戰報 |
| C | `grand-finals-results` | 總決賽結果樹＋逐場彈窗 | 8 | 總決賽結束 | `grand_finals`、`champion` |
| — | `top64-profile` | 64 位晉級者個人資訊名片 | ≥64 | 名單確定後 | `data/players.json` |

完整契約見[三階段收集工作流](../notes/workflows/star-cup-collection-workflow.md)。代圖必須標成
`placeholder`，只能測試版面，盤點不視為正式證據，也不得寫入 `data/`。

### 各批的細節

**`knockout-matchup`（舊名 `matchup`）** — 檔名排序後對應第 1 到第 8 組。場次版面：A＝左上、B＝左下、C＝右上、D＝右下。

**`qualifier-rank`（舊名 `rank`）** — 連拍捲動，相鄰截圖需有重疊。畫面底部固定釘著「自己的名次列」會遮住最下一列，
靠重疊補回；被遮住的尾段名次（約 65 名以後）讀不到是正常的，只要覆蓋到前 64 名即可。
**本期主題只出現在這批的頂部**，對陣圖上沒有。

**`top64-profile`（舊名 `top64`）** — 從資格賽排行榜逐一點開選手的「個人資訊」彈窗（名片 tab）。每張可讀出：
用戶 ID、公會、普通/困難關卡進度、通天塔層數、戰力、魅力值、徽記、稱號。
用戶 ID 是唯一穩定識別碼——這批的主要價值就是**解決同名與改名的對應問題**，
其他批次只有名字可比對。檔名排序**不保證**等於排名順序，以圖中內容為準。

拍攝時注意兩點（2026-08-09 首批的實際教訓）：

- **別重複點開同一位**。首批 64 張裡有 5 位被點了兩次，等量的人因此漏拍，
  最後只涵蓋 59/64 位。拍完可跑 `node tools/import-top64-profiles.mjs <抽取檔> --check`，
  它會列出重複的張數與「榜上前 64 名未拍到」的補拍清單。
- 畫面底部那列固定是**自己的名次**（非當前選手），任何一張都一樣，不是資料。

**`knockout-results`（舊名 `results`）** — 每組 8 張：第 1 張樹狀圖（讀組冠軍、目前戰力），第 2–8 張為 7 場對戰彈窗
（R1 四場、R2 兩場、決賽）。拍攝順序不一定是 A/B/C/D，寫入 `data/` 前必須依對陣表歸位。

**`grand-finals-results`** — 共 8 張：第 1 張結果樹、第 2–8 張為七場對戰彈窗。

## 盤點工具

```bash
node tools/check-screenshots.mjs                 # 各輪四類批次的齊全度總覽
node tools/check-screenshots.mjs --round round5  # 只看某一輪
node tools/check-screenshots.mjs --json          # 機器可讀
```

工具檢查目錄命名是否合規、張數是否落在預期範圍，並列出每輪缺哪一類。
**缺件不一定是問題**——早期輪次當時就沒有拍 `top64`，`docs/sources.md` 是判斷「該有卻沒有」
還是「本來就沒拍」的依據。

## 開新一輪

```bash
mkdir -p screenshots/star-cup/2026-08-14-round5-{matchup,rank,top64,results}
```

四個資料夾一次建好，拍到哪批就往哪批丟。
跑 `node tools/check-screenshots.mjs` 確認命名沒打錯，分析完再登記 `docs/sources.md`。

## 已知缺件

| 輪次 | 缺 | 說明 |
| ---- | -- | ---- |
| round1 | matchup / rank / top64 / **grand-finals** | 當時流程只拍賽後結果，賽前批次不存在 |
| round2 | rank / top64 / **grand-finals** | `rank` 批次當時未納入流程；`top64` 尚未發明 |
| round3 | top64 / **grand-finals** | `top64` 尚未發明 |
| round4 | （已補齊） | 五批皆有原圖。matchup/rank/top64 於 2026-08-13 自 Syncthing 找回；knockout-results（64）與 grand-finals-results（8）於 2026-08-13 自 Syncthing 來源 `2026-08-07/` 補齊，為 2026-08-09 的第二次拍攝（`data/` 逐場結果原抽自 2026-08-06 的 `2026-08-06-round4-results` 舊式目錄，兩批已比對一致） |

`top64` 自 round4（2026-08-09）起納入流程，之前的輪次沒有這批是預期內的。

**round1–3 的總決賽截圖已確認取不到**（2026-08-13 使用者確認），三屆的
`collection.grand_finals` 記為 `missing` 而非 `pending`。因此 `npm run check` 會固定出現三條
`status 為 finished 但 champion 為空` 警告——**這是永久狀態，不是待辦，不得為了消警告而補值**。
`grand-finals-results` 自 round4 起才納入流程。

## 備份

截圖不在 git 裡，GitHub 上沒有副本。本目錄由 Syncthing 同步（見 `.stfolder/`）。
若原始圖需長期保存，請確認 Syncthing 對端有留存；若分析產出已足夠，遺失僅損失重驗能力。
round4 的 matchup/rank 就是沒走本目錄而遺失的實例——**所有批次一律先落到本目錄再分析**。
