# 截圖批次索引

> 原始截圖放在 `screenshots/`（**gitignored，只留本地**，供 AI agent 分析用）。
> 這份索引進 git：記錄每批截圖的位置、內容、與由它產出的檔案，
> 讓沒有截圖的 clone（或另一台機器上的 agent）知道資料從哪來、缺了什麼。

## 命名規則

```
screenshots/<主題>/<YYYY-MM-DD>-<roundN>-<type>/Screenshot_*.png
```

`<type>` 只能是 `matchup`（對陣圖）、`rank`（排行榜）、`top64`（玩家資訊）、`results`（賽事結果）四種。
完整規範見 [`screenshots/README.md`](../screenshots/README.md)。

一批（同一次拍的一組圖）＝一個資料夾。分析完成後在下表登記一行。

## 每輪齊全度

每輪賽事應有四批。本表由 `node tools/check-screenshots.mjs` 產出，缺件原因見下方批次清單。

| 輪次 | 對陣圖 | 排行榜 | 玩家資訊 | 賽事結果 | 備註 |
| ---- | ------ | ------ | -------- | -------- | ---- |
| round1（6/19） | ❌ | ❌ | ❌ | ✅ 64 | 當時流程只拍賽後結果 |
| round2（7/3） | ✅ 8 | ❌ | ❌ | ✅ 64 | `rank` 未納入流程；`top64` 尚未發明 |
| round3（7/17） | ✅ 8 | ✅ 10 | ❌ | ✅ 65 | `top64` 尚未發明 |
| round4（7/31） | ⚠️ 遺失 | ⚠️ 遺失 | ✅ 69張/64人 | ✅ 65 | matchup/rank 原為 Telegram `photo_*.jpg`，未落到 `screenshots/` 而遺失；資料已完整抽取進 `data/star-cup/2026-07-31.json`。top64 經兩次補拍已涵蓋 64/64 位 |
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
| `screenshots/star-cup/2026-07-31-round4-matchup/` ⚠️ **圖已遺失** | 2026-07-31 | 8 | 7/31 明星盃淘汰賽賽前對陣（10-21-55＝第1組，10-21-57–10-22-11＝第2–8組）。原檔為 Telegram 轉存的 `photo_*.jpg`，未落到 `screenshots/`，目錄現已不存在 | [2026-07-31-round4-matchup.md](./star-cup/2026-07-31-round4-matchup.md)、[2026-07-31-round4-betting-guide.md](./star-cup/2026-07-31-round4-betting-guide.md)、`data/star-cup/2026-07-31.json`（groups 已於 2026-08-06 連同結果併入；抽取暫存檔已於 2026-08-09 清除）。資料完整，僅損失重驗能力 |
| `screenshots/star-cup/2026-07-31-round4-rank/` ⚠️ **圖已遺失** | 2026-07-31 | 8 | 7/31 明星盃資格賽排行榜前 65 名＋本期主題（明星盃-精靈季）；第 66 名起被自己名次列遮擋。原檔同上未落到 `screenshots/` | `data/2026-07-31.json`（主題、qualifier 前65名已併入）、[2026-07-31-round4-matchup.md](./star-cup/2026-07-31-round4-matchup.md) 資格賽欄與 [2026-07-31-round4-betting-guide.md](./star-cup/2026-07-31-round4-betting-guide.md)。資料完整，僅損失重驗能力 |
| `screenshots/star-cup/2026-08-06-round4-results/` | 2026-08-06 | 64 | 8/6 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽）；資料夾原名 `2026-08-06-round3-results`，實為第四輪 | [2026-08-06-tournament-results.md](./star-cup/2026-08-06-tournament-results.md)、`data/2026-07-31.json`（逐場結果、各組冠亞軍已併入） |
| `screenshots/star-cup/2026-08-06-round4-results/Screenshot_20260806-175247.png` | 2026-08-06 | 1 | 補件：第2組 R1-B（仔仔團宗宗 vs 戰神蕉蕉）對戰彈窗，原批次該張為連線載入畫面（`Screenshot_20260806-154744.png`，未納入抽取） | 回填 `data/2026-07-31.json`、[2026-08-06-tournament-results.md](./star-cup/2026-08-06-tournament-results.md) |
| `screenshots/star-cup/2026-08-09-round4-top64/` | 2026-08-09 | 69（涵蓋 **64 位**） | 8/9 明星盃資格賽前 64 名的個人資訊名片（用戶ID、公會、普通/困難關卡、通天塔、戰力、魅力值、徽記、稱號）；本專案**首批 `top64`**。01:10–01:24 拍 64 張但 5 位被重複點開（龍×이뮤、Yööᶠˣ、coco幻、橙色楓葉、秘運行者Kai）；**02:17 補拍 4 張**（第 48、57、60、64 名）、**02:33 補拍 1 張**（第 46 名）。合計涵蓋全部 64 位 | `data/players.json`（新建，64 位跨賽事選手登記簿）、回填 `data/star-cup/2026-07-31.json`（**64/64 位掛上 `player_id`，`⚠` flag 清零**：兩位「牛大力」、兩位「龍×똥꼬」皆以用戶ID 區分並補齊資格賽名次）。確認改名 `o月亮惹的禍o`→`送你離開`；確認第 64 名「牛大办」實為**牛大刃**（`101821232`）。見 [top64-profile-workflow.md](../notes/workflows/top64-profile-workflow.md) |
| `screenshots/rune-ruins/2026-06-24/` | 2026-06-24 | 22 | 符文廢墟符文一覽（顏色×形狀） | ⚠️ 產出檔 `analysis/rune-ruins-stats.md` 已不存在（截圖仍在本機，可重新分析） |
| `screenshots/skills/` | 2026-07-03 | 1+ | 蓄能流技能組合木樁 60 秒 DPS 測試（10 組合；部分截圖僅貼在對話中未存檔） | ⚠️ 產出檔 `analysis/skill-dps-analysis.md` 已不存在（截圖僅剩 1 張，重驗能力有限） |

## 備份提醒

截圖不在 git 裡，GitHub 上沒有副本。若原始圖需要保存，
請將 `screenshots/` 加入雲端硬碟／NAS 同步；若分析產出已足夠，遺失僅損失重驗能力。
