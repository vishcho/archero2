---
name: screenshot-extract
description: 從 Archero 2 明星盃／超級明星盃手機截圖建立、核對、修正及發布結構化資料。適用於新截圖入庫、混裝批次分類、既有 JSON 抽樣或完整複核、OCR 差異裁決、名片身分回填、賽前 R1 配對與下注預覽／正式發布、LINE 社群預覽更新、淘汰賽與總決賽結果抽取，以及重新產生來源紀錄或戰報；涵蓋證據歸屬、視覺抽取、交叉驗證、dry-run 匯入與完成門檻。
---

# 截圖抽取與核對

把截圖視為證據，把 `tmp/` 視為未驗證中繼區，把 `data/` 視為唯一正式資料源：

```text
screenshots/ → 人工／AI 視覺判讀 → tmp/*.json → importer → data/ → docs/／網站
```

Validator 能抓結構錯誤，抓不到看錯的字或數字。每次都要加入獨立的視覺或關聯檢查，不能只以 `npm run check` 證明正確。

## 強制原則

1. 讀不清就保留未知並記錄不確定性；不得猜值、補字或靜默正規化。
2. 以 `player_id` 識別玩家；不得只因名稱相同而合併。
3. 新證據與正式資料衝突時先產出逐欄 diff；未確認前不得覆寫。
4. 不讓網站、文件或 committed data 依賴 `tmp/`。
5. 先判斷證據屆次、批次與是否已入庫，再複製、抽取或修改檔案。
6. 保留畫面順序；除非 workflow 明定可推導，否則不得從版面位置猜資料關係。
7. 修改正式資料前先 dry-run；修改後執行專案完成門檻。

## 選擇工作模式

| 模式         | 預設動作                                     |
| ------------ | -------------------------------------------- |
| 新批次入庫   | 完整執行 Step 0–5                            |
| 既有資料核對 | 只讀證據，建立抽樣或逐筆比對；未受要求不修改 |
| 補缺／回填   | 只處理缺少的批次或欄位，保留既有證據         |
| 下注預覽     | 查看全部 8 張對陣圖、建立 R1 matchup、跑預覽 |
| 雙來源複核   | 逐欄 diff，依欄位是否可變分類差異            |
| 戰報重生     | 先 render 到暫存檔並 diff，避免蓋掉人工內容  |

核對時不要因發現錯誤就自行修正；先回報資料路徑、原值、證據值、來源與信心程度。

## Step 0：讀規則與相關 workflow

先讀 repository `AGENTS.md`，再依批次完整讀取：

- `qualifier-rank`、`knockout-matchup`：[`star-cup-pre-match-workflow.md`](../../../notes/workflows/star-cup-pre-match-workflow.md)
- `knockout-results`、`grand-finals-results`：[`tournament-results-workflow.md`](../../../notes/workflows/tournament-results-workflow.md)
- `top64-profile`：[`top64-profile-workflow.md`](../../../notes/workflows/top64-profile-workflow.md)
- 跨 checkpoint 狀態：[`star-cup-collection-workflow.md`](../../../notes/workflows/star-cup-collection-workflow.md)

按任務載入 references：

- 屆次、分類、manifest、重複入庫：[`references/evidence-and-batches.md`](references/evidence-and-batches.md)
- 排行榜、名片、對陣或結果判讀：[`references/visual-extraction.md`](references/visual-extraction.md)
- 抽樣、雙盲、匯入與驗收：[`references/validation-and-import.md`](references/validation-and-import.md)
- R1 配對與下注預覽：[`references/prediction-matchup.md`](references/prediction-matchup.md)

## Step 1：建立證據盤點

讀大量圖片前先確認：season/round/series、batch type、來源與張數、拍攝時間範圍、manifest／磁碟／data 狀態、是否已入庫及不確定性。

以圖內賽事與選手交叉判斷屆次。目錄名、時間戳和張數只能輔助。manifest、磁碟與 `data/` 任兩方不一致時先列為待裁決。

## Step 2：建立抽取契約

開始讀圖前定義：

- 每種畫面抽取及忽略的欄位。
- 穩定 ID、不可變快照、累積值與顯示名稱。
- 預期筆數、唯一鍵、順序語意與跨圖關聯。
- 未知值、`uncertain`、`flag`、note 的表示。
- 至少一條不依賴同一 OCR 結果的交叉驗證。

初次抽取寫到 `tmp/` 並保存每筆來源檔名，不直接編輯正式 JSON。

## Step 3：分批讀圖

1. 依檔名排序，但不假設檔名順序等於排名、組別或玩家順序。
2. 每批立即記錄來源、畫面類型與抽取範圍。
3. 排行榜保留重疊列，以 rank 去重並檢查連續性。
4. 名片優先讀 `player_id`；ID 不清時中止該筆身分匯入。
5. 對陣圖照畫面籤位記錄，禁止從 `players[]` 索引推導場次。
6. 結果批次同時讀樹狀圖與逐場彈窗，讓兩種證據互驗。

賽前對陣需同時支援兩個用途：

- 客觀賽季資料寫 `groups[].players[]`，保持畫面籤位順序。
- 下注預覽另寫 `tmp/<season>-matchup.json`，直接符合 `schemas/matchup.schema.json`。只有能從畫面連線逐場確認 R1-A～D 時才建立 `matches[]`；不得把 `players[]` 相鄰位置當作配對。

需要產生下注預覽時，完整讀取 [`references/prediction-matchup.md`](references/prediction-matchup.md)。不得先產生自訂 `players[].slot` 格式再留待日後轉換。

使用者要求查看、建立或確認下注預覽時，把「完整查看 8 張賽前對陣圖並建立合規 matchup」視為同一任務內的必要步驟。只要證據已在工作區，就應直接執行，不得只回報 matchup／preview 檔尚未建立。只有圖片缺失或連線確實不可辨識時才停止並列出精確缺口。

保留原始 Unicode。若清楚名片可裁決排行榜遮擋或 OCR 字形，以清楚證據為準並保留原始 variant。

## Step 4：驗證抽取

1. **畫面層**：抽樣回看原圖，逐欄比對。
2. **批次層**：檢查張數、涵蓋、唯一鍵、重複與缺漏。
3. **關聯層**：檢查排名、名單、晉級、冠亞軍與 identity。
4. **專案層**：執行 schema、domain、contract 與 docs 驗證。

抽樣要分層涵蓋前／中／後段、各畫面類型、不同語系與特殊字形、重複名稱和極端值。清楚區分已確認錯誤、疑似差異與未抽樣範圍。

## Step 5：dry-run、寫入與驗收

優先使用既有 importer 並先跑 `--dry-run`。只有來源、欄位語意與關聯均成立才寫入正式資料。完成後依影響執行。文件 membership 或標題改變時先重建文件索引，再跑完整檢查：

```bash
node tools/check-screenshots.mjs --round roundN
npm run docs:build   # 只有文件 membership 或標題改變時
npm run check
```

最新一屆下注建議經人工核對並獲准正式發布時，使用固定順序：

```bash
npm run predictions:publish -- <season> --matchup tmp/<season>-matchup.json
npm run social-preview
npm run check
```

`social-preview` 必須在正式發布完成後、`npm run check` 前執行；它會從
`data/star-cup/seasons.json` 的最後一屆讀取 `round`、`season`、`theme`，產生日期版
1200 × 630 PNG 並同步更新首頁 Open Graph 資訊。只做抽樣核對、dry-run、下注預覽或回填
非最新屆歷史資料時，不要因此重新產生社群預覽。若最新一屆的上述欄位或屆次索引有變，
即使未重發下注快照，也要執行 `npm run social-preview`；`npm run check` 會阻擋過期產物。

更新 `docs/sources.md` 的證據路徑、日期、張數、產出與不確定性。不要 commit 截圖。

## 回報格式

依序回報：結論、比對範圍與分母、confirmed 差異、suspected 差異、驗證命令與結果、未覆蓋風險、實際變更。不得以 validator 通過取代視覺正確性，也不得把抽樣描述成全量保證。
