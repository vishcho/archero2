# 淘汰賽結果全自動工作流

本工作流用於把明星盃淘汰賽截圖批次轉成兩份正式產物：

1. `data/star-cup/{season}.json`：網站唯一結構化資料來源，包含分組、冠亞軍與逐場結果。
2. `docs/star-cup/YYYY-MM-DD-tournament-results.md`：由 JSON 渲染出的人工可讀戰報。

## 輸入

截圖批次放在：

```text
screenshots/star-cup/<YYYY-MM-DD-roundN-results>/Screenshot_*.png
```

檔名排序後，每批應為 64 張：

```text
8 組 × 8 張
每組第 1 張：晉級樹狀圖
每組第 2-8 張：7 場對戰詳情
```

若張數不是 64，流程必須中止並列出缺漏或多出的檔案，不得產生正式資料。

目錄命名與四類批次（`matchup` / `rank` / `top64` / `results`）的規範見
[`screenshots/README.md`](../../screenshots/README.md)；開跑前可先用
`node tools/check-screenshots.mjs` 確認本輪批次齊全度。

## 自動化階段

### 1. 盤點與分組

依檔名排序截圖，切成 8 個 group package：

```text
group 1 = files[0..7]
group 2 = files[8..15]
...
group 8 = files[56..63]
```

每組保留原始檔名清單，供 `docs/sources.md` 追溯。

### 2. 視覺抽取

對每組執行影像辨識：

- 樹狀圖：抽出組冠軍、樹狀圖顯示的目前戰力。
- 對戰彈窗：抽出雙方玩家、進度、時間、賽時戰力、WIN/LOSE 標示。

抽取結果先寫入暫存 JSON，不直接覆蓋正式資料。

### 2b. 抽取完整性檢查點（Checkpoint）

**視覺抽取完成後、進入任何後續階段前，必須先通過本檢查點。未通過一律中止，不得進入 3–7 階段。**

對暫存 JSON 逐項核對：

- **張數對齊**：暫存 JSON 涵蓋的截圖數 = 64，且與 §1 的 group package 檔名清單一一對應，無遺漏、無重複引用。
- **每組 8 張齊全**：每組 1 張樹狀圖 + 7 張對戰彈窗，皆已產出抽取結果。
- **每組 7 場齊全**：R1 四場、R2 兩場、決賽一場，共 56 場；缺任一場即中止。
- **每場欄位齊全**：`p1` / `p2` 各具 `name`、`progress`、`time`、`power`，且有明確 WIN/LOSE 標示可判定 `winner` / `loser`。任一欄位為空、模糊或無法辨識，均視為未齊全。
- **每組樹狀圖齊全**：可讀出組冠軍；`champion_current_power` 若截圖有顯示則必須抽出，確實未顯示才可省略。
- **選手集合自洽**：每組 8 位選手皆出現在 R1 四場中，無人重複、無人缺席；R2、決賽的選手皆來自上一輪勝者。
- **與賽前對陣表交叉比對**：選手名稱與 `docs/star-cup/YYYY-MM-DD-roundN-matchup.md`（或 `data/star-cup/YYYY-MM-DD.json` 的 `groups[]`）一致；不一致者逐筆列出，依 §異常處理規則判定是「截圖為準 + 註記」還是「抽取錯誤需重抽」。比對名稱前先查 `data/players.json` 的 `names[]` 與 `ocr_variants[]`——已知的 OCR 誤讀變體不算不一致，成因見 [top64-profile-workflow.md](./top64-profile-workflow.md) §OCR 誤讀通則。

檢查點輸出一份清單，明確標示：

```text
[OK]      64/64 張、8/8 組、56/56 場、欄位齊全
[MISSING] 缺漏項目（組別／場次／欄位／檔名）
[UNSURE]  辨識不確定、需人工確認的項目
```

只有在 `[MISSING]` 與 `[UNSURE]` 皆為空時才可繼續。任一項非空時：先重抽對應截圖；重抽後仍無法確認者，回報使用者裁決，**不得推測填值、不得先寫入 `data/`**。

### 3. 場次歸位

正式資料一律使用對陣位置順序：

```text
R1：A、B、C、D
R2：upper、lower
決賽：final
```

如果截圖拍攝順序不是 A/B/C/D，例如第二輪曾出現 A→C→B→D，必須依對陣表或樹狀圖歸位後再寫入 `data/`。

### 4. 寫入 data

逐場結果寫進 `groups[].matches`：

```json
{
  "round": "R1",
  "slot": "A",
  "p1": { "name": "玩家A", "progress": 10, "time": "03:07.25", "power": "13.24M" },
  "p2": { "name": "玩家B", "progress": 10, "time": "03:52.27", "power": "6.64M" },
  "winner": "玩家A",
  "loser": "玩家B",
  "notes": ["雙方滿時，依遊戲標示判定勝負"]
}
```

同步更新同一個 group 的：

- `champion`
- `runner_up`
- `champion_power`：冠軍在賽時對戰彈窗中的戰力
- `champion_current_power`：樹狀圖目前戰力；沒有此資料時省略

### 5. 驗證

正式寫入後必須執行兩支驗證，兩支都通過才算過關：

```bash
node tools/validate-season.mjs data/star-cup/{season}.json            # 結構：欄位型別、值域、必填
node tools/validate-tournament-results.mjs data/star-cup/{season}.json # 邏輯：晉級自洽
```

`validate-season.mjs` 驗證條件：

- `status` 只能是 `in_progress` / `finished`。
- `flag` 只能是 `⚠` / `≈`；`prev_best` 須在允許值域內。
- 時間格式須為 `MM:SS.mm`（或 `未通關`）。
- `id` 須與檔名相符；`qualifier` 的 `rank` 須遞增。
- 每屆 8 組、每組 8 人。

`validate-tournament-results.mjs` 驗證條件：

- 每組 7 場：R1 四場、R2 兩場、決賽一場。
- 每場 `winner` / `loser` 必須是 `p1` 或 `p2`。
- R1 勝者必須出現在 R2。
- R2 勝者必須出現在決賽。
- `group.champion` 必須等於決賽勝者。
- `group.runner_up` 必須等於決賽敗者。

驗證失敗時不得更新 Markdown 戰報。

### 6. 渲染戰報

驗證通過後，由 JSON 產生 Markdown：

```bash
node tools/render-tournament-results.mjs data/star-cup/{season}.json docs/star-cup/YYYY-MM-DD-tournament-results.md
```

Markdown 只是呈現層；若和 JSON 不一致，以 JSON 為準並重新渲染。

### 7. 更新來源索引

更新 `docs/sources.md`：

- 批次路徑
- 截圖日期
- 張數
- 內容
- 產出檔案

### 8. 重生文件索引

`docs/README.md` 由腳本從目錄結構生成，新增戰報後執行：

```bash
node tools/build-docs-index.mjs
```

不要手動編輯 `docs/README.md`，改動會在下次生成時被覆蓋。

## 目前半自動遷移工具

既有戰報可用下列工具遷移成 `groups[].matches`：

```bash
node tools/import-tournament-results-from-doc.mjs docs/star-cup/2026-06-23-tournament-results.md data/star-cup/2026-06-19.json
node tools/import-tournament-results-from-doc.mjs docs/star-cup/2026-07-07-tournament-results.md data/star-cup/2026-07-03.json
```

這個工具只用於舊資料遷移；新批次應從截圖抽取，經驗證後再渲染 Markdown。
先加 `--dry-run` 預覽摘要；工具會先驗證完整候選資料，正式執行時採原子替換。

## 異常處理規則

- 雙方同進度同時間：以遊戲 WIN/LOSE 標示為準，並加 `notes`。
- `0` 進度且 `10:00.00` / `10:00.02`：記錄原始數字，註記「疑未出賽」或「判定依據不明」。
- 名稱與賽前對陣表不同：`p1.name` / `p2.name` 以截圖為準，差異寫入 `notes` 或文件註記。
- 同名玩家：保留 `groups[].players[].flag`，逐場結果只記截圖顯示名稱。
- 戰力異常：不得自行修正，照截圖記錄，差異放入 `notes` 或戰報註記。
