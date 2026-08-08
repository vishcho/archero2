# 截圖目錄結構

> 這份 README 進 git，`screenshots/` 底下的圖不進（見 `.gitignore`）。
> 沒有截圖的 clone 靠這份 README 知道規範、靠 [`docs/sources.md`](../docs/sources.md) 知道每批的實際內容。

## 路徑格式

```text
screenshots/<主題>/<YYYY-MM-DD>-<roundN>-<type>/Screenshot_*.png
```

- `<主題>`：對應 `data/cups.json` 的 `slug`，例如 `star-cup`。
- `<YYYY-MM-DD>`：**拍攝日**，不是賽事日。同一輪的賽前與賽後批次日期本來就不同。
- `<roundN>`：賽事輪次，全小寫無補零（`round4`，不是 `Round04`）。這是把四類批次綁成同一輪的鍵。
- `<type>`：**只能是下面四種**，見「四類批次」。

一批（同一次拍的一組圖）＝一個資料夾。分析完成後在 `docs/sources.md` 登記一行。

## 四類批次

每輪賽事完整應有四批。順序即賽事時序：

| # | type | 內容 | 張數 | 拍攝時機 | 消費者 |
| - | ---- | ---- | ---- | -------- | ------ |
| 1 | `matchup` | 對陣圖：8 組賽前對陣樹 | 8 | 淘汰賽開打前（競猜期） | [賽前工作流](../notes/workflows/star-cup-pre-match-workflow.md) → matchup + betting guide |
| 2 | `rank` | 排行榜：資格賽排行榜連拍 | ~10 | 同上，與 matchup 同時 | 同上（主題、`qualifier[]` 的唯一來源） |
| 3 | `top64` | 玩家資訊：64 位晉級選手個人資訊名片 | 64 | 資格賽結束後、名單確定時 | [選手檔案工作流](../notes/workflows/top64-profile-workflow.md) |
| 4 | `results` | 賽事結果：逐組樹狀圖＋逐場對戰彈窗 | 64 | 淘汰賽結束後 | [賽後工作流](../notes/workflows/tournament-results-workflow.md) → results 戰報 |

張數不符時流程要中止，不得硬跑（各工作流有各自的檢查點）。合理的例外只有補件：
`results` 常見 65 張（某張拍壞後補拍），此時在 `docs/sources.md` 額外登記補件那一行。

### 各批的細節

**`matchup`** — 檔名排序後對應第 1 到第 8 組。場次版面：A＝左上、B＝左下、C＝右上、D＝右下。

**`rank`** — 連拍捲動，相鄰截圖需有 1–2 列重疊。畫面底部固定釘著「自己的名次列」會遮住最下一列，
靠重疊補回；被遮住的尾段名次（約 65 名以後）讀不到是正常的，只要覆蓋到前 64 名即可。
**本期主題只出現在這批的頂部**，對陣圖上沒有。

**`top64`** — 從資格賽排行榜逐一點開選手的「個人資訊」彈窗（名片 tab）。每張可讀出：
用戶 ID、公會、普通/困難關卡進度、通天塔層數、戰力、魅力值、徽記、稱號。
用戶 ID 是唯一穩定識別碼——這批的主要價值就是**解決同名與改名的對應問題**，
其他批次只有名字可比對。檔名排序**不保證**等於排名順序，以圖中內容為準。

**`results`** — 每組 8 張：第 1 張樹狀圖（讀組冠軍、目前戰力），第 2–8 張為 7 場對戰彈窗
（R1 四場、R2 兩場、決賽）。拍攝順序不一定是 A/B/C/D，寫入 `data/` 前必須依對陣表歸位。

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
| round1 | matchup / rank / top64 | 當時流程只拍賽後結果，賽前批次不存在 |
| round2 | rank / top64 | `rank` 批次當時未納入流程；`top64` 尚未發明 |
| round3 | top64 | `top64` 尚未發明 |
| round4 | matchup / rank | **圖已遺失**：原為 Telegram 轉存的 `photo_*.jpg`，未落到本目錄。資料已完整抽取進 `data/star-cup/2026-07-31.json`，僅損失重驗能力 |

`top64` 自 round4（2026-08-09）起納入流程，之前的輪次沒有這批是預期內的。

## 備份

截圖不在 git 裡，GitHub 上沒有副本。本目錄由 Syncthing 同步（見 `.stfolder/`）。
若原始圖需長期保存，請確認 Syncthing 對端有留存；若分析產出已足夠，遺失僅損失重驗能力。
round4 的 matchup/rank 就是沒走本目錄而遺失的實例——**所有批次一律先落到本目錄再分析**。
