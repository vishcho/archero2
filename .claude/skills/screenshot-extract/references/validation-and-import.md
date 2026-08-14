# 驗證、抽樣與入庫

## 差異紀錄

逐筆記錄 `data path / current value / evidence value / screenshot / confidence / reason`，分類為 confirmed、suspected、expected variance。

## 分層抽樣

至少涵蓋序列前中後段、每種畫面、不同語系與特殊符號、重複名稱、缺值／遮擋、極端數值及可跨批驗證者。明確報告分母，例如 5/8 組、40/64 籤位；不得以樣本外推全量保證。

## 雙盲分類

| 差異                      | 處理                                    |
| ------------------------- | --------------------------------------- |
| 幾乎每個位置都不符        | 先疑排序約定，見下節；不要逐位置報錯    |
| 累積值單向增加            | 拍攝較晚時通常正常                      |
| 累積值下降                | 異常訊號，回看原圖；不可當成正常波動    |
| 名稱命中 OCR variant      | 用 identity evidence 裁決並保留來源字形 |
| 分隔符不同                | 比對 code point 與清楚原圖              |
| 數值雙向散亂              | 回看原圖                                |
| 比賽彈窗快照不同          | 回看；快照不應隨重拍改變                |
| 結果樹 current power 增加 | 可能正常，不與快照互比                  |

第二份抽取不要先看到第一份答案；差異裁決時才同看兩份與原圖。

## 順序無關比對（對陣圖必做）

`groups[].players` 是籤位而非顯示順序，各屆的 slot↔索引對應並不一致。
逐位置比對會把排序約定差異放大成大量假陽性——2026-08-14 複核 round4 時，
初版逐位置比對報出 54 筆姓名、48 筆戰力「不符」，實際錯誤為 0。

對陣圖差異先做順序無關檢查，依序：

1. **比對每組戰力多重集**（排序後逐值比）。相符即代表兩份讀到同一組人，
   差異純屬排序，不是抽取錯誤。
2. 以戰力反推 blind→data 的**索引置換**；置換在各組一致即為該屆的排序約定。
3. 套用置換後才比對姓名，剩下的差異才是真正待裁決的字形問題。
4. 連線配對同樣先轉成 data 索引再與 `matches[]` 比，不要比原始位置。

戰力是本批最可靠的軸（數字誤讀率遠低於 CJK 字形），適合當作對齊鍵；
同名多人時它也是唯一能區分的欄位。多重集全相符即可宣告該組籤位正確。

## 完整性

- qualifier：rank 連續唯一、時間合理、排除固定本人列。
- season matchup：8 組×8 人、順序保留、power 合法。
- prediction matchup：8 組×4 場、A/B/C/D 唯一、每組 8 個 identity 與賽季名單完全一致。
- top64：64 個唯一 ID、欄位完整、名單差異有決議。出現 `[DUPE]` 時**必須點名誰被漏拍**：
  重複拍攝代表等量的人沒拍到。`import-top64-profiles.mjs` 的補拍清單以**名稱**比對
  `qualifier[]`，同名多人時會漏報（round4 即為實例：聖心被拍兩次、橙色楓葉漏拍，
  但 64 個名稱都在，補拍清單為空）。因此另以 `player_id` 集合對 `data/players.json`
  該 season 的 ID 取差集，才是可靠的漏拍名單。
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
