# 淘汰賽結果全自動工作流

本工作流用於把明星杯淘汰賽截圖批次轉成兩份正式產物：

1. `data/{season}.json`：網站唯一結構化資料來源，包含分組、冠亞軍與逐場結果。
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

正式寫入後必須執行：

```bash
node tools/validate-tournament-results.mjs data/{season}.json
```

驗證條件：

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
node tools/render-tournament-results.mjs data/{season}.json docs/star-cup/YYYY-MM-DD-tournament-results.md
```

Markdown 只是呈現層；若和 JSON 不一致，以 JSON 為準並重新渲染。

### 7. 更新來源索引

最後更新 `docs/sources.md`：

- 批次路徑
- 截圖日期
- 張數
- 內容
- 產出檔案

## 目前半自動遷移工具

既有戰報可用下列工具遷移成 `groups[].matches`：

```bash
node tools/import-tournament-results-from-doc.mjs docs/star-cup/2026-06-23-tournament-results.md data/2026-06-19.json
node tools/import-tournament-results-from-doc.mjs docs/star-cup/2026-07-07-tournament-results.md data/2026-07-03.json
```

這個工具只用於舊資料遷移；新批次應從截圖抽取，經驗證後再渲染 Markdown。

## 異常處理規則

- 雙方同進度同時間：以遊戲 WIN/LOSE 標示為準，並加 `notes`。
- `0` 進度且 `10:00.00` / `10:00.02`：記錄原始數字，註記「疑未出賽」或「判定依據不明」。
- 名稱與賽前對陣表不同：`p1.name` / `p2.name` 以截圖為準，差異寫入 `notes` 或文件註記。
- 同名玩家：保留 `groups[].players[].flag`，逐場結果只記截圖顯示名稱。
- 戰力異常：不得自行修正，照截圖記錄，差異放入 `notes` 或戰報註記。
