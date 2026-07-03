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
| `screenshots/star-cup/2026-06-23-round1-results/` | 2026-06-23 | 50 | 6/19 明星杯淘汰賽逐場成績（8 組 R1/R2/決賽） | [round1-tournament-results.md](./round1-tournament-results.md)、`data/2026-06-19.json`（各組冠亞軍） |
| `screenshots/star-cup/2026-07-03-round2-matchup/` | 2026-07-03 | 8 | 7/3 明星杯淘汰賽賽前對陣（102237＝第1組，104147–104241＝第2–8組） | [round2-matchup.md](./round2-matchup.md)、`data/2026-07-03.json` |
| `screenshots/rune-ruins/2026-06-24/` | 2026-06-24 | 22 | 符文廢墟符文一覽（顏色×形狀） | [rune-ruins-stats.md](./rune-ruins-stats.md) |
| `screenshots/skills/` | 2026-07-03 | 1+ | 蓄能流技能組合木樁 60 秒 DPS 測試（10 組合；部分截圖僅貼在對話中未存檔） | [skill-dps-analysis.md](./skill-dps-analysis.md) |

## 備份提醒

截圖不在 git 裡，GitHub 上沒有副本。若原始圖需要保存，
請將 `screenshots/` 加入雲端硬碟／NAS 同步；若分析產出已足夠，遺失僅損失重驗能力。
