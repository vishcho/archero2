# 架構優化第二、三階段執行計畫

本計畫接續 2026-08-09 完成的第一階段：agent 共用契約、`npm run check`、GitHub
Actions，以及 README／workflow 路徑校正。

建議將第二、第三階段分成兩個獨立 session 執行。每個階段都應從乾淨或已知狀態的
worktree 開始，先閱讀 `AGENTS.md`，完成後以獨立 commit／PR 交付，避免資料模型與前端
重構混在同一份 diff。

## 第二階段：資料契約與工具可靠性

### 目標

讓賽事資料的格式、跨檔案關聯與寫入流程成為可測試的正式契約；降低人或 AI agent
匯入資料時寫壞正式 JSON、錯認同名玩家或產生難以審查 diff 的風險。

### 範圍

1. 建立 `schemas/`：
   - `cups.schema.json`
   - `season.schema.json`
   - `roster.schema.json`
   - `players.schema.json`
2. 明確劃分驗證責任：
   - JSON Schema：必填欄位、型別、enum、字串與陣列基本格式。
   - domain validator：淘汰賽晉級、跨檔案 `player_id`、同詞條顏色、期間與 id 關係。
3. 抽出 `tools/lib/` 共用能力：
   - repo/data 路徑解析
   - UTF-8 JSON 讀取
   - stable JSON serialization
   - atomic write
   - 一致的 error／warning diagnostics
   - player id／alias 查詢
4. 盤點會修改正式資料的工具：
   - 預設或明確支援 `--dry-run`
   - 寫入前完整驗證
   - 寫入採原子替換
   - dry-run 輸出摘要及預計變更，不產生正式檔案
5. 補驗證器 fixtures 與測試：
   - 每條重要規則至少一個合法與一個非法案例
   - 驗證錯誤應包含檔案及資料位置
   - `npm run check` 納入測試
6. 規劃 `prev_*` 遷移，但不在沒有可靠回歸測試時大量重寫歷史資料：
   - 新屆優先用 `player_id`
   - 建立從前一屆推導摘要的純函式與測試
   - 舊屆先保留為 legacy snapshot
   - 另開資料 migration 任務處理歷史回填
7. 更新 `AGENTS.md`、README 與 workflows，使實際命令和新契約一致。

### 建議決策

- 可引入一個維護良好的 JSON Schema validator 作為 dev dependency，但先比較 Node 版本支援、
  錯誤訊息品質與 lockfile 成本；不要自行實作半套 JSON Schema 引擎。
- Schema 不應承擔難以閱讀的跨物件賽制邏輯。
- 不要在本階段順便改前端資料格式；若 schema 揭露必須遷移的問題，先以相容層處理。

### 驗收條件

- `npm ci` 與 `npm run check` 通過。
- schema 與 domain validation 都有自動測試，且刻意損壞 fixture 會被攔下。
- 任何正式資料寫入失敗時，原檔保持完整。
- import/backfill 的 dry-run 不改動 git worktree。
- 現有 6 個賽事資料檔及 `players.json` 全部通過新契約。
- 不產生未說明的大量歷史 JSON formatting diff。

### 不在本階段處理

- React/Vue 等前端框架
- Tailwind CSS 建置
- 大量歷史資料自動改寫
- 資料庫或後端服務

## 第三階段：前端安全與可維護性

### 目標

在保留純靜態部署的前提下，消除不可信文字直接進入 `innerHTML`、缺少 fetch 錯誤處理，
以及三個頁面 inline script 難以測試與共享的問題。

### 範圍

1. 建立統一資料存取層：
   - `fetchJson()` 檢查 `response.ok`
   - 錯誤包含 URL 與 HTTP status
   - cup、season id 以已載入清單白名單驗證
   - 缺少 query parameter 時顯示明確錯誤
2. 建立安全呈現邊界：
   - 一般文字改用 `textContent`
   - 確需字串模板的位置使用單一 `escapeHtml()`
   - URL／attribute 值分開處理，不把 HTML escaping 當 URL validation
   - 玩家名稱、主題、備註與來源文字納入測試
3. 將 inline JavaScript 拆出：
   - `js/api.js`
   - `js/domain.js`
   - `js/render.js` 或小型 DOM helper
   - `js/pages/index.js`
   - `js/pages/season.js`
   - `js/pages/bracket.js`
4. 保持頁面與網址相容：
   - `season.html?id=` 舊連結仍預設 `star-cup`
   - `?cup=` 行為不變
   - bracket 的 players 陣列位置語意不變
5. 加入無瀏覽器或輕量 DOM 單元測試：
   - HTML 特殊字元不會被解讀為 markup
   - 404／壞 JSON 會顯示錯誤狀態
   - 各 schema 選擇正確 renderer
6. 加入瀏覽器 smoke test，至少覆蓋：
   - 首頁載入兩種賽事
   - 明星盃三個 tabs
   - 超級明星盃 roster
   - bracket 切組
   - 無效 cup／id 的錯誤畫面
7. 最後再評估 Tailwind CDN：
   - 若網站需要離線或穩定公開部署，改為鎖版 CSS build artifact。
   - 若仍是個人本機檢視，可保留 CDN 並記錄風險，不讓 CSS 工具鏈擴大本階段 diff。

### 建議實作順序

1. 先寫安全輸出與 fetch error 的測試。
2. 抽資料存取層，保持現有 renderer 不動。
3. 抽頁面 scripts，每次只搬一頁並跑 smoke test。
4. 將資料插值改成安全 DOM 操作／escaping。
5. 驗證舊網址與三個頁面視覺結果。
6. 獨立決定是否納入 Tailwind build；不要和核心安全修正綁死。

### 驗收條件

- `npm run check` 通過，並包含新增的前端測試。
- JSON 內的 `<`, `>`, `&`, quotes 或類似 `<img onerror=...>` 的字串不會建立可執行 DOM。
- fetch 失敗與無效網址不再只留下空白頁或未處理 Promise rejection。
- 三個 HTML 不再包含主要頁面邏輯的 inline script。
- 現有資料在首頁、season、bracket 的內容與排序保持一致。
- 至少保留 smoke test 截圖或測試報告作為視覺／行為驗證證據。

### 不在本階段處理

- 全面改寫成 SPA
- 引入後端 API 或資料庫
- 改變賽事資料 schema
- 重設視覺設計

## Session 交接提示

第二階段新 session 可直接使用：

> 請閱讀 AGENTS.md 與 notes/architecture-roadmap.md，執行「第二階段：資料契約與工具可靠性」。
> 先盤點再實作，避免大量歷史資料 diff；完成所有驗收條件後回報。

第三階段新 session 可直接使用：

> 請閱讀 AGENTS.md 與 notes/architecture-roadmap.md，執行「第三階段：前端安全與可維護性」。
> 保持既有網址、資料格式與視覺行為相容；完成所有驗收條件後回報。
