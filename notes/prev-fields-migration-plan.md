# `prev_*` 相容遷移計畫

本階段不改寫歷史賽季。既有 `prev_best`、`prev_power`、`prev_progress`、`prev_time` 視為
legacy snapshot，前端繼續照原格式讀取。

新屆資料應優先填 `player_id`。`tools/lib/domain.mjs` 的 `derivePreviousSummary()` 只以
`player_id` 從前一屆推導摘要，不以顯示名稱合併玩家；找不到可靠 ID 時回傳 `null`。

後續獨立 migration 任務應：

1. 先為所有歷史屆建立渲染與資料回歸快照。
2. 列出缺少或衝突的 `player_id`，只依來源證據處理，不用名稱猜測。
3. 以 dry-run 產生逐檔變更報告，經人工審查後才分批回填。
4. 每批跑 `npm run check` 並確認網站輸出不變；確認涵蓋完整後，才考慮移除冗餘欄位。
