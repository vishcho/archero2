# 截圖批次索引

> 原始截圖放在 `screenshots/`（**gitignored，只留本地**，供 AI agent 分析用）。
> 這份索引進 git：記錄每批截圖的位置、內容、與由它產出的檔案，
> 讓沒有截圖的 clone（或另一台機器上的 agent）知道資料從哪來、缺了什麼。

## 命名規則

```
screenshots/<主題>/<YYYY-MM-DD-用途>/Screenshot_*.png
```

一批（同一次拍的一組圖）＝一個資料夾。分析完成後在下表登記一行。

## 批次清單

| 批次路徑 | 日期 | 張數 | 內容 | 產出 |
| -------- | ---- | ---- | ---- | ---- |
| `screenshots/star-cup/2026-06-23-round1-results/` | 2026-06-23 | 64 | 6/19 明星杯淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-06-23-tournament-results.md](./star-cup/2026-06-23-tournament-results.md)、`data/2026-06-19.json`（逐場結果、各組冠亞軍） |
| `screenshots/star-cup/2026-07-03-round2-matchup/` | 2026-07-03 | 8 | 7/3 明星杯淘汰賽賽前對陣（102237＝第1組，104147–104241＝第2–8組） | [2026-07-03-round2-matchup.md](./star-cup/2026-07-03-round2-matchup.md)、`data/2026-07-03.json` |
| `screenshots/star-cup/2026-07-07-round2-results/` | 2026-07-07 | 64 | 7/4 明星杯淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-07-07-tournament-results.md](./star-cup/2026-07-07-tournament-results.md)、`data/2026-07-03.json`（逐場結果、各組冠亞軍） |
| `screenshots/star-cup/2026-07-17-round3-matchup/` | 2026-07-17 | 8 | 7/17 明星杯淘汰賽賽前對陣（101651＝第1組，101748–101833＝第2–8組）；本批**無資格賽排行榜** | [2026-07-17-round3-matchup.md](./star-cup/2026-07-17-round3-matchup.md)、[2026-07-17-round3-betting-guide.md](./star-cup/2026-07-17-round3-betting-guide.md)、`data/2026-07-17.json`（groups 已併入） |
| `screenshots/star-cup/2026-07-17-round3-rank/` | 2026-07-17 | 10 | 7/17 明星杯資格賽排行榜前 70 名＋本期主題（明星盃-精靈季）；第 71 名起被自己名次列遮擋 | `data/2026-07-17.json`（主題、qualifier 前70名）、回填 [2026-07-17-round3-matchup.md](./star-cup/2026-07-17-round3-matchup.md) 資格賽欄與 [2026-07-17-round3-betting-guide.md](./star-cup/2026-07-17-round3-betting-guide.md) |
| `screenshots/star-cup/2026-07-23-round3-results/` | 2026-07-23 | 64 | 7/23 明星杯淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-07-23-tournament-results.md](./star-cup/2026-07-23-tournament-results.md)、`data/2026-07-17.json`（逐場結果、各組冠亞軍已併入） |
| `screenshots/star-cup/2026-07-23-round3-results/Screenshot_20260724-000015.png` | 2026-07-24 | 1 | 補件：第4組 R2 上半（koeee vs I매I우연）對戰彈窗，原批次遺漏此張 | 回填 `data/2026-07-17.json`、[2026-07-23-tournament-results.md](./star-cup/2026-07-23-tournament-results.md) |
| `screenshots/rune-ruins/2026-06-24/` | 2026-06-24 | 22 | 符文廢墟符文一覽（顏色×形狀） | [rune-ruins-stats.md](./analysis/rune-ruins-stats.md) |
| `screenshots/skills/` | 2026-07-03 | 1+ | 蓄能流技能組合木樁 60 秒 DPS 測試（10 組合；部分截圖僅貼在對話中未存檔） | [skill-dps-analysis.md](./analysis/skill-dps-analysis.md) |

## 備份提醒

截圖不在 git 裡，GitHub 上沒有副本。若原始圖需要保存，
請將 `screenshots/` 加入雲端硬碟／NAS 同步；若分析產出已足夠，遺失僅損失重驗能力。
