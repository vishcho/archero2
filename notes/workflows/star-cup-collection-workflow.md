# 明星盃三階段截圖收集工作流

本文件定義一屆明星盃從資格賽到總決賽的批次契約。欄位抽取細節仍分別遵循
`star-cup-pre-match-workflow.md`、`tournament-results-workflow.md` 與
`top64-profile-workflow.md`。

## 三個 checkpoint

| checkpoint | 取得時間 | 正式批次 | 可更新資料 |
| --- | --- | --- | --- |
| A | 淘汰賽首日 | `qualifier-rank`、`knockout-matchup` | `qualifier[]`、`groups[].players[]`；`status: in_progress` |
| B | 淘汰賽結束 | `knockout-results` | `groups[].matches`、各組冠亞軍；狀態仍為 `in_progress` |
| C | 總決賽結束 | `grand-finals-results` | `grand_finals`、頂層 `champion`；`status: finished` |

`top64-profile` 是跨賽事玩家身分資料，不是賽事 checkpoint。它可以在任何時間補拍，
且只由 `top64-profile-workflow.md` 寫入 `data/players.json`。

## 新目錄與 manifest

新批次建議一屆一個目錄：

```text
screenshots/star-cup/<淘汰賽首日>-roundN/
├── manifest.json
├── qualifier-rank/
├── knockout-matchup/
├── knockout-results/
└── grand-finals-results/
```

將 [`screenshot-manifest.example.json`](./screenshot-manifest.example.json) 複製成該屆的
`manifest.json` 後再填寫。`season_id` 必須是淘汰賽首日，與 season JSON 的 `id` 相同。
舊式 `YYYY-MM-DD-roundN-rank` 等平面目錄仍受盤點工具支援，但新一屆應使用 manifest。

每個批次的 `evidence_status` 只能是：

- `original`：本屆原始截圖，可以成為正式資料證據。
- `missing`：本屆未取得，資料維持缺失；賽後可以用新的正式結果截圖回復可證明的欄位。
- `placeholder`：別屆代圖，只可開發版面辨識，不得寫入 `data/`。必須填 `purpose`。

執行 `node tools/check-screenshots.mjs --round roundN`。只有 `original` 會顯示為齊全；
`placeholder` 永遠不算正式證據。

## 四種正式批次

### qualifier-rank

排行榜連拍須涵蓋 1–64 名。張數不是完整性的充分條件：先去除固定在底部的本人名次列，
再以相鄰畫面的重疊排名合併，確認 1–64 每個名次恰出現一次。它不是玩家個人名片，
不可交給 `import-top64-profiles.mjs`。

### knockout-matchup

預期 8 張，每組一張。玩家順序是籤位，不得排序。缺少本屆截圖時，不可由資格賽排名
推測分組或以代圖補入；可以在 checkpoint B 從本屆結果樹恢復名單與籤位，並註明來源。

### knockout-results

預期 64 張：8 組，每組一張結果樹與七場詳細對戰。沿用
`tournament-results-workflow.md` 的完整性 checkpoint 與異常處理規則。

### grand-finals-results

預期 8 張：一張結果樹與七場詳細對戰。抽取為：

```json
{
  "results": [{ "rank": 1, "name": "選手", "power": "62.93M" }],
  "bracket": [{ "round": "R1", "slot": "A", "p1": {}, "p2": {}, "winner": "選手", "loser": "對手" }]
}
```

`results` 必須恰為八名分組冠軍，名次為 `1, 2, 3, 3, 5, 5, 5, 5`：同輪淘汰者
並列，不從結果樹猜測其內部順序。`bracket` 與分組賽共用四場 R1、兩場 R2、一場
決賽的晉級驗證。第一名、決賽勝者與頂層 `champion` 必須一致。

## Season 收錄狀態

可在 season JSON 加上選填的 `collection`，明確分開「比賽狀態」和「證據是否收齊」：

```json
"collection": {
  "qualifier": "complete",
  "knockout_matchup": "missing",
  "knockout_results": "complete",
  "grand_finals": "pending"
}
```

值只能是 `pending`、`complete`、`missing`。若已寫入 `grand_finals`，其值必須為
`complete`，且 season `status` 必須為 `finished`。

每個 checkpoint 寫入正式資料前先預覽／人工核對，寫入後一律執行 `npm run check`。
