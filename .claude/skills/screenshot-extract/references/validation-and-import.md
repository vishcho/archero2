# 驗證、抽樣與入庫

## 差異紀錄

逐筆記錄 `data path / current value / evidence value / screenshot / confidence / reason`，分類為 confirmed、suspected、expected variance。

## 分層抽樣

至少涵蓋序列前中後段、每種畫面、不同語系與特殊符號、重複名稱、缺值／遮擋、極端數值及可跨批驗證者。明確報告分母，例如 5/8 組、40/64 籤位；不得以樣本外推全量保證。

## 雙盲分類

| 差異                      | 處理                                    |
| ------------------------- | --------------------------------------- |
| 累積值單向增加            | 拍攝較晚時通常正常                      |
| 名稱命中 OCR variant      | 用 identity evidence 裁決並保留來源字形 |
| 分隔符不同                | 比對 code point 與清楚原圖              |
| 數值雙向散亂              | 回看原圖                                |
| 比賽彈窗快照不同          | 回看；快照不應隨重拍改變                |
| 結果樹 current power 增加 | 可能正常，不與快照互比                  |

第二份抽取不要先看到第一份答案；差異裁決時才同看兩份與原圖。

## 完整性

- qualifier：rank 連續唯一、時間合理、排除固定本人列。
- season matchup：8 組×8 人、順序保留、power 合法。
- prediction matchup：8 組×4 場、A/B/C/D 唯一、每組 8 個 identity 與賽季名單完全一致。
- top64：64 個唯一 ID、欄位完整、名單差異有決議。
- knockout：8 組×7 場，round/slot、勝負與晉級自洽。
- grand finals：7 場、8 位組冠軍、名次與 champion 一致。

## dry-run 與完成門檻

優先使用既有 importer：

```bash
node tools/import-top64-profiles.mjs <extract.json> --dry-run
node tools/backfill-from-players.mjs data/star-cup/<season>.json --dry-run
node tools/import-grand-finals.mjs <extract.json> data/star-cup/<season>.json --dry-run
node tools/check-screenshots.mjs --round roundN
npm run predictions:preview -- <season> --matchup tmp/<season>-matchup.json
npm run check
```

戰報先 render 到 `/tmp` 再 `diff -u`，只覆蓋預期差異。文件 membership 或標題改變後才執行 `npm run docs:build`，再跑 `npm run check`。

既有 warning 不等於失敗或修復授權。更新 `docs/sources.md`，不要手改生成的 `docs/README.md`，不要 commit screenshots。
