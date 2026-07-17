# 明星杯賽前對陣與競猜 Guide 工作流

本工作流用於從明星杯賽前截圖產生兩份正式文件：

1. `docs/star-cup/YYYY-MM-DD-roundN-matchup.md`：淘汰賽賽前對陣表，整合本屆對陣、本屆資格賽時間與上屆淘汰賽表現。
2. `docs/star-cup/YYYY-MM-DD-roundN-betting-guide.md`：依對陣表產生的競猜下注建議。

以第二輪為例，目標產物是：

- `projects/archero2/docs/star-cup/2026-07-03-round2-matchup.md`
- `projects/archero2/docs/star-cup/2026-07-03-round2-betting-guide.md`

## 輸入

### 截圖批次

賽前需要兩批截圖。**流程開始前先盤點兩批是否都已到位**（目錄存在且張數合理），缺任何一批就先停下向使用者確認，不要直接開跑：

**1. 對陣批次**（必要）：

```text
screenshots/star-cup/<YYYY-MM-DD-roundN-matchup>/Screenshot_*.png
```

每批應有 8 張（8 組 × 1 張賽前對陣圖）。檔名排序後對應第 1 到第 8 組。若張數不是 8，流程必須中止並列出缺漏或多出的檔案，不得產生正式 Markdown。

**2. 資格賽排行榜批次**（必要，提供主題與資格賽時間）：

```text
screenshots/star-cup/<YYYY-MM-DD-roundN-rank>/Screenshot_*.png
```

約 10 張連拍捲動截圖，涵蓋排行榜前 70 名左右。讀圖注意（2026-07-17 實測）：

- **本期主題**只出現在此畫面頂部（對陣圖上沒有），是 `theme` 欄位唯一來源。
- 畫面底部固定釘著「自己的名次列」，會遮住每張截圖最下面一列，也使第 71 名以後讀不到；相鄰截圖有 1–2 列重疊，靠重疊補回被遮的列。
- 稱號可能被頭像遮住首字（例：吐司夾蛋「?放戰線」）——照可見字形記錄並加 note，不得腦補。

**例外：rank 批次確定晚到**——僅在使用者明確同意先出文件時，才走「無資格賽資料」流程（資格賽欄全記 `—`、主題記未知），rank 到位後回填對陣表、修訂下注 Guide 的判讀（資格賽資料可能翻案，見下注階段註記）。預設行為是等兩批到齊再一次跑完。

### 結構化資料

本屆資料來源：

```text
data/{season}.json
```

賽前階段至少需要：

- `id`
- `date`
- `theme`
- `qualifier[]`
- `groups[].id`
- `groups[].players[]`

上屆參考資料來源：

```text
data/{previous_season}.json
```

上屆資料至少需要：

- `groups[].players[]`
- `groups[].matches[]`
- `groups[].champion`
- `groups[].runner_up`

如果本屆 `data/{season}.json` 尚未有完整 `groups[].players[]`，應由賽前截圖先抽取並寫入暫存 JSON，經人工核對後再合併到正式資料。

本屆 `data/{season}.json` 若不存在，由 rank 批次建立（`id`、`date`、`theme`、`status: "in_progress"`、`champion: null`、`qualifier[]`），並同步把 season id 加入 `data/seasons.json`。資格賽排行榜屬客觀資料，可直接入正式檔，不需等人工核對；`groups` 的併入才需要人工核可。

## 自動化階段

### 0. 前置確認

確認兩批截圖都已到位：

```text
screenshots/star-cup/<YYYY-MM-DD-roundN-matchup>/   → 恰 8 張
screenshots/star-cup/<YYYY-MM-DD-roundN-rank>/      → 約 10 張（能覆蓋榜上前 64 名）
```

任一批缺漏或張數異常：中止並回報使用者，列出缺什麼；除非使用者同意走例外流程，否則不產出任何正式檔案。

### 1. 盤點與分組

依檔名排序截圖，建立 8 個 group package：

```text
group 1 = files[0]
group 2 = files[1]
...
group 8 = files[7]
```

每組保留原始檔名，最後更新 `docs/sources.md`。

### 2. 視覺抽取賽前對陣

從每張截圖抽出：

- group id
- 對陣順序中的 8 位玩家
- 玩家名稱
- 本屆戰力
- 場次位置：A/B/C/D，每場兩人
- 競猜期資訊，例如「距淘汰賽開始約 21 小時」與每組下注狀態

**場次位置與版面對應（已由上屆實際 R2 配對驗證，2026-07-17 確認）**：

```text
A ＝ 左上配對（左欄第 1、2 人）
B ＝ 左下配對（左欄第 3、4 人）
C ＝ 右上配對（右欄第 1、2 人）
D ＝ 右下配對（右欄第 3、4 人）
```

注意：R2 是 **A勝×C勝（上半）、B勝×D勝（下半）**，即左上配左右「跨欄」相接，不是視覺上左欄兩場自行合併。判讀新一輪版面時，若對版面有疑慮，用上屆 results 的實際 R2 配對回推驗證，不要憑樹狀線目測。

抽取結果先寫入暫存 JSON，不直接覆蓋正式資料。暫存放在 `projects/archero2/tmp/`（已被 `.gitignore` 的 `tmp/` 規則排除，安全）。

建議暫存結構：

```json
{
  "season": "2026-07-03",
  "round": "round2",
  "groups": [
    {
      "id": 1,
      "source": "Screenshot_102237.png",
      "players": [
        { "slot": "A", "name": "玩家A", "power": "12.25M" },
        { "slot": "A", "name": "玩家B", "power": "11.73M" }
      ]
    }
  ]
}
```

players 一律依 `A,A,B,B,C,C,D,D` 排序，與 `js/common.js` 對 `groups[].players` 的約定（0,1=A、2,3=B、4,5=C、6,7=D）一致，之後可原序併入正式資料。

### 3. 合併資格賽排行榜

使用 `data/{season}.json` 的 `qualifier[]` 比對玩家名稱，補上：

- 本屆資格賽通關時間
- 流派/稱號，如果有 `title`
- 排名，可選

比對規則：

1. 完全同名直接採用。
2. 已知截圖顯示變體可用人工 alias 對應，但必須在註記中保留。
3. 同名多筆不得自動猜測，標記 `⚠`，資格賽時間寫 `—⚠`（暫存 JSON 中該玩家的 `qualifier_rank`/`qualifier_time` 設 null）。
4. 找不到對應者寫 `—`。

交叉驗證（2026-07-17 發現，建議每屆檢查）：**淘汰賽 64 人通常恰為資格賽前 64 名**。合併後檢查「榜上前 64 名是否與對陣名單一一對應、65 名以後皆不在對陣表中」——這同時是名單完整性檢查與兩批截圖 OCR 的雙向核對（同一名字在兩處獨立讀到一次）；上一輪存疑的字形（如 `戰營養腦七拍`）可藉此確認或翻案。若不成立，列出差異並在註記說明。

### 4. 合併上屆淘汰賽表現

從 `data/{previous_season}.json` 對每位本屆玩家建立上屆摘要：

- 上屆賽時戰力：取上屆玩家資料或最佳場次中的戰力。
- 上屆淘汰賽最佳進度：優先取達到的最高 `progress`。
- 上屆淘汰賽最佳通關時間：只在 `progress = 10` 時比較最短時間。
- 上屆組冠軍/亞軍身分：用於投注理由。

比對規則：

1. 完全同名優先。
2. 明顯改名或 OCR 差異只可列為 `≈ 疑同一人`，不得當成完全確認。
3. 同名多人用戰力與歷史資料推測時，必須標 `⚠ 同名多人` 並在文件註記說明。
4. 找不到可信對應者，上屆欄位寫 `—`。

### 5. 驗證賽前資料

正式渲染前必須檢查：

- 共 8 組。
- 每組剛好 8 位玩家。
- 每組剛好 4 個 R1 場次：A、B、C、D。
- 同一組內玩家名稱不得重複；若截圖確實同名，必須加 `flag: "⚠"` 或註記。
- 每位玩家都要有本屆戰力；無法辨識時標 `—⚠`，不得留空。
- 資格賽與上屆資料的模糊對應必須出現在註記區。

驗證失敗時不得更新正式 Markdown。

驗證建議用 node 腳本跑而不是人眼掃（一次檢查：8 組、每組 8 人、每組 A–D 各 2 人、組內無同名、戰力非空；qualifier 部分另檢查名次連續、時間遞增排序）。

### 5b. 併入正式資料（需人工核可）

groups 併入 `data/{season}.json` 時，轉成與 `data/2026-07-03.json` 一致的正式格式：

```json
{
  "id": 1,
  "players": [
    { "name": "…", "power": "12.25M", "qualifier_rank": 43, "qualifier_time": "04:22.4",
      "prev_power": "8.38M", "prev_progress": "10/10", "prev_time": "10:00.02" }
  ],
  "champion": null,
  "runner_up": null,
  "matches": []
}
```

- `players` 保持 `A,A,B,B,C,C,D,D` 順序（網站依索引推場次）。
- `prev_progress` 是 `"10/10"` 字串，不是數字；未通關者省略 `prev_time`（網站顯示「未通關」）。
- 同名無法對應者省略 `qualifier_rank`/`qualifier_time`，保留 `flag: "⚠"` 與 `note`。
- 頂層補 `grand_finals: null`；賽後 results 流程再回填 `champion`、`matches`。

### 6. 渲染對陣表

產生：

```text
docs/star-cup/YYYY-MM-DD-roundN-matchup.md
```

文件格式：

1. 標題：`# YYYY/M/D 淘汰賽對陣表`
2. 賽事資訊：主題、競猜期、下注狀態。
3. 說明區：資料來源與「上屆」欄位定義。
4. 8 組對陣表，每組欄位固定為：
   - 場次
   - 選手
   - 本屆戰力
   - 本屆資格賽通關時間
   - 上屆戰力
   - 上屆淘汰賽最佳進度
   - 上屆淘汰賽最佳通關時間
5. 資格賽排行榜完整區，保留本屆 `qualifier[]` 可讀版本。
6. 註記區，包含同名、疑似同一人、未採計疑似對象與欄位說明。
7. 來源尾註，連到 `docs/sources.md` 與上屆結果文件。

## 下注 Guide 產生階段

下注 Guide 不應直接從截圖產生，必須以已驗證的 matchup 文件或同一份結構化暫存 JSON 為唯一輸入。

若資格賽資料是後補的，回填後必須**逐場重審 Guide**，不能只改數字：2026-07-17 實例中資格賽資料讓四處判讀翻案（零紀錄高戰力選手拿資格賽第 1 → 升檔；上屆冠軍資格賽墊底 → R1 改押對手；資格賽名次差 30 名以上 → 強強對決翻盤）。反差選手（上屆紀錄與本屆資格賽方向相反者）要寫進風險提醒。

### 1. 建立 R1 與 R2 對戰樹

每組對戰順序固定為：

```text
R1-A
R1-B
R1-C
R1-D
R2 upper = A 勝者 × C 勝者
R2 lower = B 勝者 × D 勝者
決賽 = upper 勝者 × lower 勝者
```

若截圖或遊戲規則改變 R2 配對，必須在 Guide 開頭明確寫出已確認的新規則。

### 2. 評分與判讀

投注判讀依可信度排序：

1. 上屆淘汰賽成績。
2. 本屆戰力。
3. 本屆資格賽通關時間。

建議將每位玩家轉成比較用特徵：

```text
previous_clear_time：上屆達 10/10 的最佳時間，越短越好
previous_best_progress：上屆最佳進度，越高越好
power：本屆戰力，越高越好
qualifier_time：本屆資格賽時間，越短越好
flags：⚠、≈、無資料、同名多人
```

下注信心建議：

| 標記 | 條件 | 建議注量 |
| ---- | ---- | -------- |
| ✅ | 淘汰賽紀錄與戰力都明顯優勢，或單一指標巨大優勢且對手無可靠紀錄 | 重壓 |
| ⚖ | 有主要依據但另一項指標衝突，或需要依賴疑似對應 | 中注 |
| 🎲 | 雙方資料不足、指標互相抵消、或主要依據只有資格賽時間 | 輕注或看賠率 |

### 3. 逐場預測

對每組依賽程順序產生 7 個 pick：

```text
R1-A
R1-B
R1-C
R1-D
R2 A×C
R2 B×D
決賽
```

每個 pick 必須包含：

- 押注玩家
- 信心標記
- 一句依據，優先提淘汰賽紀錄與戰力

每組標題需包含預測組冠軍與信心，例如：

```text
### 第 6 組 — 冠軍：**koeee** ✅✅
```

### 4. 資金配置總結

依 8 組冠軍信心分成：

- 重壓
- 中注
- 輕注/對沖
- 純硬幣

這段只能整理已在各組逐場表中出現的結論，不應新增未解釋的下注建議。

### 5. 風險提醒

至少列出：

- 同名或疑似改名造成的對應風險。
- 無上屆紀錄但本屆戰力或資格賽很強的選手。
- 只靠資格賽時間做判斷的場次。

## 輸出

產生：

```text
docs/star-cup/YYYY-MM-DD-roundN-matchup.md
docs/star-cup/YYYY-MM-DD-roundN-betting-guide.md
```

並更新：

```text
data/YYYY-MM-DD.json（theme、qualifier；groups 經人工核可後）
data/seasons.json
docs/sources.md
```

## 輸出後更新

兩份文件與資料檔完成後，同步更新：

- `docs/sources.md`：對陣批次與 rank 批次各登記一行（含產出檔案）。
- `phi-repo/memory/active-context.md`：記錄本輪狀態與待辦（例如「賽後補淘汰賽結果」）。

## 異常處理規則

- 截圖中玩家名稱與資格賽榜不同：以截圖為主，資格賽對應寫註記。
- 截圖中出現同名玩家：保留同名，使用 `⚠` 區分，不得自行改名。
- 韓國字、特殊符號或 OCR 不確定：保留截圖可辨識字形，註記疑點。
- 戰力缺字或模糊：寫 `—⚠`，不得猜數字。
- 上屆資料一字之差：除非使用者確認，放入「疑似對象」而不採計。
- Guide 若遇到資料不足，不要硬給高信心；使用 `🎲` 並說明是純博或看賠率。

## 建議工具化拆分

未來可拆成三個工具：

```bash
node tools/import-star-cup-matchup-from-screenshots.mjs screenshots/star-cup/YYYY-MM-DD-roundN-matchup/ data/YYYY-MM-DD.json --previous data/YYYY-MM-DD.json --out tmp/YYYY-MM-DD-roundN-matchup.json
node tools/render-star-cup-matchup.mjs tmp/YYYY-MM-DD-roundN-matchup.json docs/star-cup/YYYY-MM-DD-roundN-matchup.md
node tools/render-star-cup-betting-guide.mjs tmp/YYYY-MM-DD-roundN-matchup.json docs/star-cup/YYYY-MM-DD-roundN-betting-guide.md
```

若暫時沒有影像抽取工具，也可由 agent 先人工抽取暫存 JSON，再走同一套驗證與渲染規則。

## 沿革

- 2026-07-03（第二輪）：初版流程。
- 2026-07-17（第三輪）：依實作經驗修訂——
  1. 新增 rank 批次規格（主題唯一來源、自己名次列遮擋、稱號遮字處理）。
  1b. 新增「步驟 0 前置確認」：**預設等對陣與 rank 兩批截圖都到齊才開跑**；「先出文件、後回填資格賽」降為需使用者同意的例外流程（第三輪實際經歷 rank 晚到、回填時四處判讀翻案，兩段式成本高）。
  2. 明確場次版面對應 A=左上、B=左下、C=右上、D=右下（初版誤以為左右欄各自合併，經上屆 R2 實際配對回推更正）。
  3. 新增「淘汰賽名單＝資格賽前 64 名」交叉驗證與 node 腳本驗證建議。
  4. 明確資料入庫分工：qualifier 直接入 `data/{season}.json` 並登記 `seasons.json`；groups 需人工核可後依正式格式併入（5b 節）。
  5. 下注 Guide 在資格賽資料後補時必須逐場重審。
