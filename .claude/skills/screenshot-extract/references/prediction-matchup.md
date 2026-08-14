# 下注預覽 R1 對陣契約

需要從賽前截圖產生下注建議時，直接建立 `tmp/<season>-matchup.json`，不要建立自訂 `players[].slot` 中繼格式。

## 證據門檻

- 對每組逐一沿畫面連線確認四場 R1；不可套用跨屆固定位置規則。
- 看不清任一場的兩端時，列出組別與缺口並停止預覽，不得用 `groups[].players` 索引補配。
- 同名多人必須帶 `player_id`；名稱唯一者也應在已取得名片資料時帶入 ID。
- `draw_index` 只記已從畫面確認的籤位，不用來推導配對。

## 必做的 8 圖檢查

下注預覽不是另一次人工前置工作；它是本 skill 在收到預覽要求時必須完成的 checkpoint：

1. 先確認賽前對陣目錄恰有 8 張，依畫面中的組別確認第 1–8 組，不只依檔名猜測。
2. 逐張以原尺寸查看，沿每一條 R1 連線的兩端讀出玩家；一張完成四場才移到下一張。
3. A、B、C、D 依該畫面實際賽程語意記錄；不得套用「相鄰兩格」「左上到右下」等跨屆固定公式。
4. 每張立即建立核對列：`group / source / A / B / C / D / 8 位是否各出現一次`。核對列可放暫存工作檔，不得混入 matchup schema。
5. 完成第一遍後反向由第 8 組回看到第 1 組，確認每條連線與兩端名稱。
6. 用賽季 `groups[].players[]` 核對每組八人多重集；再用 `player_id` 解決同名，不得改造顯示名稱區分玩家。
7. 只有 8/8 張、32/32 場與 64/64 個籤位都確認後，才寫出 `tmp/<season>-matchup.json` 並執行預覽。

若工作區已有 8 張證據，直接查看並完成上述流程；不要把「建立 matchup」留成使用者的後續待辦。若單張截圖無法看出賽程語意，回報該檔名、組別及不可辨識的連線，且不得產生部分 web preview。

## 唯一輸出格式

輸出必須通過 `schemas/matchup.schema.json`：

```json
{
  "season_id": "2026-08-14",
  "groups": [
    {
      "id": 1,
      "matches": [
        {
          "slot": "A",
          "p1": { "name": "玩家 A", "player_id": "101000001" },
          "p2": { "name": "玩家 B", "player_id": "101000002" }
        }
      ]
    }
  ]
}
```

每組必須恰有 A、B、C、D 四場，同一玩家在組內恰好出現一次。`matchup.json` 只描述 R1 客觀配對，不放 power、預測勝者、信心、來源註記或賽果。

## 三向核對

1. 截圖：每場兩端與連線一致。
2. 賽季：每組八個 `name + player_id` 與 `data/star-cup/<season>.json` 完全一致。
3. 結構：執行預覽，由 schema 與 prediction domain validator 檢查 8 組、56 場及晉級依賴。

完成報告必須列出 `圖片 8/8、R1 32/32、玩家 64/64`，不能只寫「schema 通過」。

```bash
npm run predictions:preview -- <season> --matchup tmp/<season>-matchup.json
```

需要瀏覽器預覽時才執行：

```bash
npm run predictions:web-preview -- <season> --matchup tmp/<season>-matchup.json
npm run dev
```

正式發布必須在人工核對四場 R1、56 個建議、覆蓋率與強制選擇後另行執行；不得由截圖抽取流程自動發布。
