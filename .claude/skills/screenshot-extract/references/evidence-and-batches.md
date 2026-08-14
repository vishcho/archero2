# 證據歸屬、批次與 manifest

## 屆次歸屬

不要用來源目錄名判斷屆次；它可能是賽程階段、拍攝日或匯出日。依序使用：圖內賽事／選手與正式資料的對照、批次內容與張數、檔名時間戳。Star Cup season id 是 `knockout_period[0]`。

同一屆可能分散在相鄰來源目錄。盤點一個來源時也查看母目錄，避免把另一階段誤判為缺件。

## 批次指紋

| 批次                   |    常見張數 | 畫面                   |
| ---------------------- | ----------: | ---------------------- |
| `qualifier-rank`       |    約 10–16 | 排名列表               |
| `top64-profile`        | 64 或含補拍 | 個人資訊彈窗           |
| `knockout-matchup`     |           8 | 每組一張賽前籤表       |
| `knockout-results`     |          64 | 8 組 ×（結果樹＋7 場） |
| `grand-finals-results` |           8 | 結果樹＋7 場           |

張數會撞號，必須抽樣看圖。不要按檔案大小分類。排行榜與名片可能混裝，要以列表／個人資訊彈窗逐圖拆分。

## 重複入庫

先讀 `collection`，再與內容對帳：qualifier 應涵蓋排名；matchup 應為 8×8 玩家；knockout results 應為 8×7 場；grand finals 應有物件與 champion；top64 完整性看該 season 的 64 個唯一 `player_id`。

- `complete`：不要重抽；使用者要求時改做只讀複核。
- `pending`：找到原圖後可處理。
- `missing`：已確認取不到，不得猜值補齊。

部分入庫只處理缺少批次。某欄位為 `null` 不能證明手上圖片是新證據。

## 落地與 manifest

```text
screenshots/star-cup/<season-id>-round<N>/
├── manifest.json
├── qualifier-rank/
├── knockout-matchup/
├── knockout-results/
├── grand-finals-results/
└── top64-profile/
```

先落地再分析。`captured_at` 取圖片實際時間，不照抄資料夾日期。

同時比較 manifest、磁碟與 `data/`：

- `original`：有本屆原圖及 `captured_at`。
- `missing`：磁碟無圖且已確認缺失。
- `placeholder`：別屆代圖，只能測版面；須有 `purpose`，不得入庫。

工具可能抓不到「manifest 寫 missing 但磁碟有圖」，因此直接列檔計數。任兩方不一致時先回報或修證據狀態，不得匯入。
