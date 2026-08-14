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
| 結果樹 current power 與彈窗不同 | 正常，兩者是不同快照，不得互比            |
| 結果樹 current power 與 `data/` 不同 | **回看原圖**；同批同次拍攝，差異不是增長 |
| 同一選手多場 power 全等   | 匯入可疑，見「常數欄位偵測」            |

第二份抽取不要先看到第一份答案；差異裁決時才同看兩份與原圖。

## 常數欄位偵測（不需重讀原圖的交叉驗證）

賽時戰力是**每場獨立的快照**。同一選手在同組 R1→R2→決賽的 power
本來就可能因臨場調裝而不同。若 `data/` 中某選手多場 power **完全相同**，
那通常不是巧合，而是匯入時把單一值複製到所有場次的痕跡。

這條規則只讀 `data/`，不需重讀截圖，成本近乎零，卻能在抽取前就圈出可疑範圍：

```bash
# 列出各組中「所有出賽場次 power 皆相同」的選手
node -e '
const s=require("./data/star-cup/2026-07-31.json");
for(const g of s.groups){
  const m=new Map();
  for(const mt of g.matches??[]) for(const p of [mt.p1,mt.p2]){
    if(!m.has(p.name)) m.set(p.name,[]);
    m.get(p.name).push(p.power);
  }
  for(const [n,v] of m) if(v.length>1 && new Set(v).size===1)
    console.log(`${g.group??"?"} ${n} ${v.length}場全部 ${v[0]}`);
}'
```

判讀（**這是圈選範圍的訊號，不是錯誤判定**）：

- **全屆每組都常數** → 整批匯入方式可疑，該批必須全量重讀 power 才能放心。
  round4 即為此況：8 組的所有晉級者 power 皆為組內常數。重讀後發現 6 位選手有誤，
  其餘常數值經截圖確認**確實是對的**（選手真的沒換裝）。
  所以常數本身不證明錯誤，它證明的是「這批沒有逐張讀，任何一格都可能沒被看過」。
- **少數選手常數、其餘有變動** → 通常正常，優先度低。
- **樹狀圖 `champion_current_power` 與樹狀圖對得上、但同組彈窗 power 互相常數**
  → 兩種證據來自不同次判讀，彈窗那次沒有逐張讀。

2026-08-14 round4 複核實測：8 組的所有晉級者 power 皆為組內常數，全量重讀後
確認 6 位選手、20 個彈窗欄位與截圖不符（另有 5 個樹狀圖 `champion_current_power`
有誤）。這是**系統性匯入缺陷**而非零星誤讀——validator 與 `npm run check` 全數
通過，是這條規則圈出範圍後逐張重讀才抓到的。

`champion_current_power` 適用同一邏輯的變體：樹狀圖上同一位冠軍會在多個節點
重複出現同一數值（round4 各組皆為 4 處），彼此互為驗證。反過來說，
**不要預設 `champion_current_power` 與 `data/` 的差異是「拍攝較晚的自然增長」**
——它和彈窗來自同一次拍攝。round4 前次抽樣把 G1／G2 的差異誤判為增長，
本次回看原圖才確認是數字轉置誤讀（36.65↔36.76、22.30↔22.56）。

同類推廣：任何「應該逐場獨立」的欄位（時間、進度、賽時快照）都適用
「常數 = 可疑」。反之累積型欄位（top64 名片的等級、通天塔）本來就可能持平，
不適用本規則。

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
