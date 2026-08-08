# Top64 選手檔案工作流

本工作流把資格賽前 64 名的「個人資訊」名片截圖，轉成跨屆累積的選手檔案庫：

```text
data/star-cup/players.json
```

這是四類批次中唯一**跨屆累積**的一批：matchup / rank / results 都只描述單一屆，
`top64` 則是把同一個人在不同屆的身分綁在一起。

## 為什麼需要這批

其他三批只有**顯示名稱**可比對，於是長年有三個對不起來的問題：

1. **同名多人** — 賽前工作流遇到同名只能標 `⚠ 同名多筆`、資格賽時間寫 `—⚠`（2026-07-31 的「牛大力」即是實例）。
2. **改名** — 上屆對應只能寫 `≈ 疑同一人`，不得當成確認。
3. **OCR 字形存疑** — 稱號被頭像遮住首字時只能照可見字形記錄。

名片裡的**用戶 ID 是唯一穩定識別碼**，可以直接把上述猜測變成確認。
這是本批的主要價值，不是為了多存幾個數字。

## 輸入

```text
screenshots/star-cup/<YYYY-MM-DD-roundN-top64>/Screenshot_*.png
```

應為 64 張，每位晉級選手 1 張。張數不是 64 時中止並列出缺漏，不得產生正式資料。

**檔名排序不保證等於排名順序**（拍攝時是逐一點開排行榜的列，可能跳著點、可能重拍）。
排名要從名片背後透出的排行榜列、或與 `data/{season}.json` 的 `qualifier[]` 比對取得，
不得用檔名順序推定。

前置需求：同屆的 `rank` 批次已處理完，`data/{season}.json` 的 `qualifier[]` 已存在——
本流程用它交叉驗證 64 人名單。

## 可抽取欄位

每張名片（名片 tab）可讀出：

| 欄位 | 說明 | 穩定性 |
| ---- | ---- | ------ |
| `user_id` | 用戶ID，例：`101874870` | **唯一且永久**，跨屆識別的鍵 |
| `name` | 顯示名稱 | 可改 |
| `guild` | 公會 | 可改 |
| `power` | 戰力 | 每屆變動 |
| `title` | 稱號，例：`魅力之星` | 每屆變動 |
| `normal` | 普通關卡進度 | 累積遞增 |
| `hard` | 困難關卡進度 | 累積遞增 |
| `tower` | 通天塔層數 | 累積遞增 |
| `charm` | 魅力值 | 累積遞增 |
| `emblem` | 徽記 | 累積遞增 |

名片上另有「切磋 / 前往營地 / 解除好友關係」等按鈕與按讚數，皆非資料，忽略。

## 自動化階段

### 1. 盤點

依檔名排序，確認 64 張。每張保留原始檔名，供 `docs/sources.md` 追溯。

### 2. 視覺抽取

逐張抽出上表欄位，寫入暫存 JSON（`tmp/`，已被 gitignore）：

```json
{
  "season": "2026-07-31",
  "captured": "2026-08-09",
  "players": [
    {
      "source": "Screenshot_20260809-011011.png",
      "user_id": "101874870",
      "name": "koeee",
      "guild": "課金",
      "power": "60.95M",
      "title": "魅力之星",
      "normal": 191, "hard": 176, "tower": 3500,
      "charm": 31580, "emblem": 6310
    }
  ]
}
```

`user_id` 是純數字字串，**不要轉成 number**（前導零與長度都可能變）。

### 2b. 抽取完整性檢查點

進入後續階段前必須通過，未通過一律中止：

- **張數對齊**：64 張全部有抽取結果，與 §1 檔名清單一一對應。
- **`user_id` 必填且唯一**：任一張讀不出 ID 即中止（沒有 ID 這批就失去意義）；
  出現重複 ID 表示同一人被拍兩次、有人漏拍，須回頭補拍。
- **欄位齊全**：上表十個欄位皆有值；模糊不清者標 `[UNSURE]`，不得猜數字。
- **與資格賽榜交叉比對**：64 個名稱應與 `data/{season}.json` 的 `qualifier[]` 前 64 名一一對應。
  對不上者逐筆列出——這正是本批要解決的問題，差異要進入 §3 的對應決議，不是直接中止。

輸出 `[OK] / [MISSING] / [UNSURE]` 清單。`[MISSING]` 與 `[UNSURE]` 皆空才可繼續。

### 3. 併入選手檔案庫

`data/star-cup/players.json` 以 `user_id` 為主鍵：

```json
{
  "101874870": {
    "user_id": "101874870",
    "names": ["koeee"],
    "guild": "課金",
    "seasons": {
      "2026-07-31": {
        "power": "60.95M", "title": "魅力之星", "qualifier_rank": 1,
        "normal": 191, "hard": 176, "tower": 3500, "charm": 31580, "emblem": 6310,
        "captured": "2026-08-09"
      }
    }
  }
}
```

合併規則：

1. `user_id` 已存在 → 新增 `seasons[{season}]`；歷史屆不得覆寫。
2. 顯示名稱與 `names[]` 皆不同 → **push 進 `names[]`**（改名，保留歷史名）並在報告中列出。
3. `user_id` 不存在 → 新建，`names` 為單元素陣列。
4. 累積型欄位（`normal`/`hard`/`tower`/`charm`/`emblem`）若比前屆**減少**，
   標 `[UNSURE]` 回報人工確認——正常只會遞增，減少通常是 OCR 讀錯。

### 4. 回填既有資料的懸案

這是本流程的**主要產出**。比對新的 `user_id` 對應後，回頭修正：

- `data/{season}.json` 中 `flag: "⚠ 同名多筆"` 的選手 → 用 ID 確定是誰，補上正確的
  `qualifier_rank` / `qualifier_time`，移除 flag，並在 `note` 保留「經 top64 用戶ID 確認」。
- 上屆對應標 `≈ 疑同一人` 者 → ID 相同即升級為確認；ID 不同則**刪除該對應**（是不同人）。
- 稱號 OCR 存疑者 → 名片上的稱號未被頭像遮擋，可直接更正。

每筆回填都要能回答「依據哪張截圖的哪個 ID」，並記入 `docs/sources.md` 該批的產出欄。

### 5. 驗證

```bash
node tools/validate-players.mjs data/star-cup/players.json   # 待建
node tools/validate-season.mjs data/star-cup/{season}.json   # 回填後重跑
```

`validate-players.mjs` 應檢查：`user_id` 為主鍵且與物件內 `user_id` 相符、`names[]` 非空、
`seasons` 的 key 都在 `data/star-cup/seasons.json` 內、累積型欄位跨屆遞增。

回填 `data/{season}.json` 後**必須重跑既有的兩支驗證**，確認沒有破壞既有結構與晉級自洽。

### 6. 更新來源索引

```bash
node tools/build-docs-index.mjs
```

並在 `docs/sources.md` 該批登記產出檔案與回填了哪些懸案。

## 異常處理規則

- 用戶 ID 讀不出來：該張必須重拍，不得只靠名字併入（違背本批存在的目的）。
- 同一 ID 出現兩次：表示有人漏拍，比對 `qualifier[]` 找出缺的是誰並補拍。
- 名字變了但 ID 相同：這是改名，`names[]` 保留全部歷史名，不得刪舊名。
- 名字相同但 ID 不同：這是同名兩人，必須建兩筆，且回頭檢查歷史屆是否曾誤併。
- 累積型欄位倒退：照截圖記錄並標 `[UNSURE]`，交人工裁決，不得自行「修正」。
- 64 人與資格賽榜對不上：以名片的 ID 為準，差異寫進註記；資格賽榜是 OCR 名字，可信度較低。

## 現況

- **2026-08-09（round4）**：首批 `top64`，64 張已就位，**尚未分析**。
  `data/star-cup/players.json` 與 `tools/validate-players.mjs` 都還沒建立。
  這批可回填的已知懸案：`data/star-cup/2026-07-31.json` 中「牛大力」的 `⚠ 同名多筆`。
- round1–round3 沒有這批（`top64` 自 round4 才納入流程），
  歷史屆的同名/改名懸案只能靠往後累積的 ID 逐步回推。

## 沿革

- 2026-08-09：初版。`top64` 批次首次拍攝，流程先於分析寫下。
