# 截圖批次索引

> 原始截圖放在 `screenshots/`（**gitignored，只留本地**，供 AI agent 分析用）。
> 這份索引進 git：記錄每批截圖的位置、內容、與由它產出的檔案，
> 讓沒有截圖的 clone（或另一台機器上的 agent）知道資料從哪來、缺了什麼。

## 命名規則

```
screenshots/<主題>/<YYYY-MM-DD>-<roundN>-<type>/Screenshot_*.png
```

舊式 `<type>` 為 `matchup`、`rank`、`top64`、`results`。新一屆改用屆次目錄與
`manifest.json`，正式批次為 `qualifier-rank`、`knockout-matchup`、
`knockout-results`、`grand-finals-results`；`top64-profile` 是選填的玩家身分批次。
完整規範見 [`screenshots/README.md`](../screenshots/README.md) 與
[三階段收集工作流](../notes/workflows/star-cup-collection-workflow.md)。

一批（同一次拍的一組圖）＝一個資料夾。分析完成後在下表登記一行。

## Syncthing 來源：一屆兩個目錄

手機端來源 `shared/archero2/` **一個屆次會產生兩個目錄**，依賽程階段切分：

| 來源目錄 | 內容 | Checkpoint |
| --- | --- | --- |
| `<淘汰賽首日>/` | `淘汰賽對陣圖/`（8）、`資排賽排名/`（排行榜＋名片**混裝**） | A ＋名片 |
| `<賽後回收日>/` | `淘汰賽結果/`（64）、`總決賽結果/`（8） | B、C |

round4 實例：`2026-07-31/`（8＋80）與 `2026-08-07/`（64＋8），兩者併入同一個
`screenshots/star-cup/2026-07-31-round4/`。**目錄名是賽程階段而非拍攝日**——
round4 的三批 `Screenshot_*` 全部拍於 2026-08-09 同一次連拍（21:58–22:31），
卻分屬兩個目錄名；只有 matchup 那批（`photo_*.jpg`）真的來自 07-31。
拿到其中一個目錄時，先 `ls` 母目錄確認同屆的另一半在不在。

## 每輪齊全度

每輪賽事應有四批。本表為**手動維護**，缺件原因見下方批次清單；
即時齊全度請跑 `node tools/check-screenshots.mjs`（它只數本機實際檔案，不讀本表）。

| 輪次 | 對陣圖 | 排行榜 | 玩家資訊 | 賽事結果 | 備註 |
| ---- | ------ | ------ | -------- | -------- | ---- |
| round1（6/19） | ❌ | ❌ | ❌ | ✅ 64 | 當時流程只拍賽後結果 |
| round2（7/3） | ✅ 8 | ❌ | ❌ | ✅ 64 | `rank` 未納入流程；`top64` 尚未發明 |
| round3（7/17） | ✅ 8 | ✅ 10 | ❌ | ✅ 65 | `top64` 尚未發明 |
| round4（7/31） | ✅ 8 | ✅ 16 | ✅ 69張/64人 | ✅ 65 | matchup/rank 於 2026-08-13 自 Syncthing 來源找回並落入 `screenshots/star-cup/2026-07-31-round4/`（見下方批次清單）。top64 經兩次補拍已涵蓋 64/64 位 |
| round5（8/14） | — | — | — | — | 未開始 |

`top64` 自 round4 起納入流程，早期輪次沒有這批屬預期內。

## 批次清單

| 批次路徑 | 日期 | 張數 | 內容 | 產出 |
| -------- | ---- | ---- | ---- | ---- |
| `screenshots/star-cup/2026-06-23-round1-results/` | 2026-06-23 | 64 | 6/19 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-06-23-tournament-results.md](./star-cup/2026-06-23-tournament-results.md)、`data/2026-06-19.json`（逐場結果、各組冠亞軍） |
| `screenshots/star-cup/2026-07-03-round2-matchup/` | 2026-07-03 | 8 | 7/3 明星盃淘汰賽賽前對陣（102237＝第1組，104147–104241＝第2–8組） | [2026-07-03-round2-matchup.md](./star-cup/2026-07-03-round2-matchup.md)、`data/2026-07-03.json` |
| `screenshots/star-cup/2026-07-07-round2-results/` | 2026-07-07 | 64 | 7/4 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-07-07-tournament-results.md](./star-cup/2026-07-07-tournament-results.md)、`data/2026-07-03.json`（逐場結果、各組冠亞軍） |
| `screenshots/star-cup/2026-07-17-round3-matchup/` | 2026-07-17 | 8 | 7/17 明星盃淘汰賽賽前對陣（101651＝第1組，101748–101833＝第2–8組）；本批**無資格賽排行榜** | [2026-07-17-round3-matchup.md](./star-cup/2026-07-17-round3-matchup.md)、[2026-07-17-round3-betting-guide.md](./star-cup/2026-07-17-round3-betting-guide.md)、`data/2026-07-17.json`（groups 已併入） |
| `screenshots/star-cup/2026-07-17-round3-rank/` | 2026-07-17 | 10 | 7/17 明星盃資格賽排行榜前 70 名＋本期主題（明星盃-精靈季）；第 71 名起被自己名次列遮擋 | `data/2026-07-17.json`（主題、qualifier 前70名）、回填 [2026-07-17-round3-matchup.md](./star-cup/2026-07-17-round3-matchup.md) 資格賽欄與 [2026-07-17-round3-betting-guide.md](./star-cup/2026-07-17-round3-betting-guide.md) |
| `screenshots/star-cup/2026-07-23-round3-results/` | 2026-07-23 | 64 | 7/23 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-07-23-tournament-results.md](./star-cup/2026-07-23-tournament-results.md)、`data/2026-07-17.json`（逐場結果、各組冠亞軍已併入） |
| `screenshots/star-cup/2026-07-23-round3-results/Screenshot_20260724-000015.png` | 2026-07-24 | 1 | 補件：第4組 R2 上半（koeee vs I매I우연）對戰彈窗，原批次遺漏此張 | 回填 `data/2026-07-17.json`、[2026-07-23-tournament-results.md](./star-cup/2026-07-23-tournament-results.md) |
| `screenshots/star-cup/2026-07-31-round4/knockout-matchup/` | 2026-07-31 | 8 | 7/31 明星盃淘汰賽賽前對陣（10-21-55＝第1組，10-21-57–10-22-11＝第2–8組）。原為 Telegram 轉存的 `photo_*.jpg`，2026-08-13 自 Syncthing 來源找回並落入本目錄 | [2026-07-31-round4-matchup.md](./star-cup/2026-07-31-round4-matchup.md)、[2026-07-31-round4-betting-guide.md](./star-cup/2026-07-31-round4-betting-guide.md)、`data/star-cup/2026-07-31.json`（groups 已於 2026-08-06 連同結果併入）。2026-08-13 二次盲抽比對：64 格戰力 **0 個不符**；本屆 slot↔籤位為**交錯索引**（`A`=[0],[2]、`B`=[4],[6]、`C`=[1],[3]、`D`=[5],[7]），與其他三屆不同，見 README「排序約定」 |
| `screenshots/star-cup/2026-07-31-round4/qualifier-rank/` | 2026-08-09 | 16 | 7/31 明星盃資格賽排行榜連拍（21:58–22:08 補拍，涵蓋 1–67 名；第 68 名起被自己名次列遮擋）＋本期主題（明星盃-精靈季） | `data/2026-07-31.json`（主題、qualifier 已於 2026-08-06 併入，本批為事後補拍證據）、[2026-07-31-round4-matchup.md](./star-cup/2026-07-31-round4-matchup.md) 資格賽欄 |
| `screenshots/star-cup/2026-07-31-round4/top64-profile/` | 2026-08-09 | 64 | 7/31 前 64 名個人資訊名片**第二輪**拍攝（21:58–22:08）。與凌晨 01:10–02:33 那批為獨立兩次拍攝，時間戳無重疊 | 數值未入庫（同屆同 key 無法並存）。2026-08-13 雙盲比對：504 次欄位比對 27 個差異，**全部為累積型欄位單向增長**（相隔約 20 小時的真實進度），非抽取誤差；`player_id` 63/63 一致。本批的字形判讀差異已作為 **12 筆 `ocr_variants`** 寫入 `data/players.json`（`names` 未動——既有真名有名片 ID 佐證，第二次判讀僅列為變體） |
| `screenshots/star-cup/2026-07-31-round4/knockout-results/` | 2026-08-09 | 64 | 7/31 明星盃淘汰賽逐場成績**第二次拍攝**（22:13–22:20）。2026-08-13 自 Syncthing 來源 `2026-08-07/淘汰賽結果/` 補齊落地；`data/` 的逐場結果原抽自 2026-08-06 舊式目錄（見下列） | 數值未重新入庫（已入庫且抽樣比對一致）。抽樣核對第 1 組：結果樹冠亞軍（LD丨힘／牛大力）、R1-A 全欄位（牛大力 42.72M/10/01:02.48 vs LD丨도하 13.97M/1/00:03.36）與既有 `data/` 完全相符。唯一差異：`champion_current_power` 本批顯示 **36.76M**、既有值 36.65M——樹狀圖「目前戰力」為累積型欄位，相隔 3 天的正常增長，**不是抽取誤差，未覆蓋既有值** |
| `screenshots/star-cup/2026-07-31-round4/grand-finals-results/` | 2026-08-09 | 8 | 7/31 明星盃**總決賽**結果（22:30–22:31）：1 張結果樹＋7 場對戰彈窗。2026-08-13 自 Syncthing 來源 `2026-08-07/總決賽結果/` 補齊落地。本屆首度取得總決賽原圖 | 已入庫 `data/star-cup/2026-07-31.json` 的 `grand_finals`（`results` 8 筆＋`bracket` 7 場）、`champion: koeee`、`collection.grand_finals: complete`，並渲染進 [2026-08-06-tournament-results.md](./star-cup/2026-08-06-tournament-results.md)「總決賽」節。冠軍 **koeee**、亞軍 **LD丨힘**、並列 3 RV297／送你離開、並列 5 藍寶基尼／LD丨팡대ɔɔ／LD丨팡대／Cashasy。交叉驗證：總決賽 8 人與 8 組冠軍**完全一致**；賽時戰力跨場快照一致。結果樹最下排 RV297 勝 送你離開 為三四名戰，依 `domain.mjs` 規則**不用於拆分並列 3**（不猜測同輪淘汰者內部順序） |
| `screenshots/star-cup/2026-08-06-round4-results/` | 2026-08-06 | 64 | 8/6 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽）；資料夾原名 `2026-08-06-round3-results`，實為第四輪。**本機已無此目錄**（另一台機器的舊式平面目錄），同批內容的第二次拍攝見上列 `2026-07-31-round4/knockout-results/` | [2026-08-06-tournament-results.md](./star-cup/2026-08-06-tournament-results.md)、`data/2026-07-31.json`（逐場結果、各組冠亞軍已併入） |
| `screenshots/star-cup/2026-08-06-round4-results/Screenshot_20260806-175247.png` | 2026-08-06 | 1 | 補件：第2組 R1-B（仔仔團宗宗 vs 戰神蕉蕉）對戰彈窗，原批次該張為連線載入畫面（`Screenshot_20260806-154744.png`，未納入抽取） | 回填 `data/2026-07-31.json`、[2026-08-06-tournament-results.md](./star-cup/2026-08-06-tournament-results.md) |
| `screenshots/star-cup/2026-08-09-round4-top64/` | 2026-08-09 | 69（涵蓋 **64 位**） | 8/9 明星盃資格賽前 64 名的個人資訊名片（用戶ID、公會、普通/困難關卡、通天塔、戰力、魅力值、徽記、稱號）；本專案**首批 `top64`**。01:10–01:24 拍 64 張但 5 位被重複點開（龍×이뮤、Yööᶠˣ、coco幻、橙色楓葉、秘運行者Kai）；**02:17 補拍 4 張**（第 48、57、60、64 名）、**02:33 補拍 1 張**（第 46 名）。合計涵蓋全部 64 位 | `data/players.json`（新建，64 位跨賽事選手登記簿）、回填 `data/star-cup/2026-07-31.json`（**64/64 位掛上 `player_id`，`⚠` flag 清零**：兩位「牛大力」、兩位「龍×똥꼬」皆以用戶ID 區分並補齊資格賽名次）。確認改名 `o月亮惹的禍o`→`送你離開`；確認第 64 名「牛大办」實為**牛大刃**（`101821232`）。見 [top64-profile-workflow.md](../notes/workflows/top64-profile-workflow.md) |
| `screenshots/star-cup/2026-08-14-round5/qualifier-rank/` | 2026-08-14 | 16 | 8/14 明星盃資格賽排行榜連拍（08:28–08:40，涵蓋 1–68 名）＋本期主題（獲得精靈和飛劍流派技能）。來源 `shared/archero2/star-cup/round5/1.top64/` 為 **16 排行榜＋64 名片混裝 80 張**，依 5 張一循環（第 1 張為排行榜）拆分落地 | `data/star-cup/2026-08-14.json`（`season`、`theme`、`qualifier` 前 64 名、`status: in_progress`、`collection.qualifier: complete`）。第 32 名 LCFFKU 無公會／稱號（名片證實「公會:無」），`title` 記 null |
| `screenshots/star-cup/2026-08-14-round5/knockout-matchup/` | 2026-08-14 | 8 | 8/14 明星盃淘汰賽賽前對陣（08:46:45＝第1組，08:46:54–08:47:52＝第2–8組）。來源 `shared/archero2/star-cup/round5/2.matchup/` | `data/star-cup/2026-08-14.json`（`groups` 8 組 × 8 人、`collection.knockout_matchup: complete`）。**交叉驗證：對陣 64 人與資格賽前 64 名多重集完全一致**（兩批獨立抽取雙向核對通過）。顯示名稱「龍×똥꼬」本屆有 **3 位不同選手**（資格賽第 16／47／54 名，分屬第 2 組 2 位與第 8 組 1 位），已標 `⚠` 並留空資格賽對應，待 top64 名片以 `player_id` 區分。`players` 依截圖籤位順序記錄且不可排序；對陣關係一律以 `groups[].matches` 為準（見 README「排序約定」），本批為賽前批次故 `matches` 省略，待淘汰賽結果入庫時自結果樹填入——**不由 `players` 索引推導** |
| `screenshots/star-cup/2026-08-14-round5/top64-profile/` | 2026-08-14 | 64 | 8/14 前 64 名個人資訊名片，自上列混裝批次拆出 | **尚未入庫**。2026-08-14 首次視覺抽取經抽樣複驗發現 `player_id` 與數值欄位大量不符（3 張複驗卡 21/21 欄位全錯），該次抽取結果已作廢刪除，未寫入 `data/`。本批需重抽並以雙盲比對驗證後才可併入 `players.json` |
| `screenshots/rune-ruins/2026-06-24/` | 2026-06-24 | 22 | 符文廢墟符文一覽（顏色×形狀） | ⚠️ 產出檔 `analysis/rune-ruins-stats.md` 已不存在（截圖仍在本機，可重新分析） |
| `screenshots/skills/` | 2026-07-03 | 1+ | 蓄能流技能組合木樁 60 秒 DPS 測試（10 組合；部分截圖僅貼在對話中未存檔） | ⚠️ 產出檔 `analysis/skill-dps-analysis.md` 已不存在（截圖僅剩 1 張，重驗能力有限） |

## 備份提醒

截圖不在 git 裡，GitHub 上沒有副本。若原始圖需要保存，
請將 `screenshots/` 加入雲端硬碟／NAS 同步；若分析產出已足夠，遺失僅損失重驗能力。
