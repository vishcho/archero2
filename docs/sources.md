# 截圖批次索引

> 原始截圖放在 `screenshots/`（**gitignored，只留本地**，供 AI agent 分析用）。
> 這份索引進 git：記錄每批截圖的位置、內容、與由它產出的檔案，
> 讓沒有截圖的 clone（或另一台機器上的 agent）知道資料從哪來、缺了什麼。

## 命名規則

```
screenshots/<主題>/<YYYY-MM-DD>-<roundN>-<type>/Screenshot_*.png
```

舊式 `<type>` 為 `matchup`、`rank`、`top64`、`results`。新一屆改用屆次目錄與
`manifest.json`，正式批次為 `qualifier-rank`、`knockout-matchup`、
`knockout-results`、`grand-finals-results`；`top64-profile` 是選填的玩家身分批次。
完整規範見 [`screenshots/README.md`](../screenshots/README.md) 與
[三階段收集工作流](../notes/workflows/star-cup-collection-workflow.md)。

一批（同一次拍的一組圖）＝一個資料夾。分析完成後在下表登記一行。

## Syncthing 來源：一屆兩個目錄

手機端來源 `shared/archero2/` **一個屆次會產生兩個目錄**，依賽程階段切分：

| 來源目錄 | 內容 | Checkpoint |
| --- | --- | --- |
| `<淘汰賽首日>/` | `淘汰賽對陣圖/`（8）、`資排賽排名/`（排行榜＋名片**混裝**） | A ＋名片 |
| `<賽後回收日>/` | `淘汰賽結果/`（64）、`總決賽結果/`（8） | B、C |

round4 實例：`2026-07-31/`（8＋80）與 `2026-08-07/`（64＋8），兩者併入同一個
`screenshots/star-cup/2026-07-31-round4/`。**目錄名是賽程階段而非拍攝日**——
round4 的三批 `Screenshot_*` 全部拍於 2026-08-09 同一次連拍（21:58–22:31），
卻分屬兩個目錄名；只有 matchup 那批（`photo_*.jpg`）真的來自 07-31。
拿到其中一個目錄時，先 `ls` 母目錄確認同屆的另一半在不在。

## 每輪齊全度

每輪賽事應有四批。本表為**手動維護**，缺件原因見下方批次清單；
即時齊全度請跑 `node tools/check-screenshots.mjs`（它只數本機實際檔案，不讀本表）。

| 輪次 | 對陣圖 | 排行榜 | 玩家資訊 | 賽事結果 | 備註 |
| ---- | ------ | ------ | -------- | -------- | ---- |
| round1（6/19） | ❌ | ❌ | ❌ | ✅ 64 | 當時流程只拍賽後結果 |
| round2（7/3） | ✅ 8 | ❌ | ❌ | ✅ 64 | `rank` 未納入流程；`top64` 尚未發明 |
| round3（7/17） | ✅ 8 | ✅ 10 | ❌ | ✅ 65 | `top64` 尚未發明 |
| round4（7/31） | ✅ 8 | ✅ 16 | ✅ 69張/64人 | ✅ 65 | matchup/rank 於 2026-08-13 自 Syncthing 來源找回並落入 `screenshots/star-cup/2026-07-31-round4/`（見下方批次清單）。top64 經兩次補拍已涵蓋 64/64 位 |
| round5（8/14） | ✅ 8 | ✅ 16 | ✅ 65張/64人 | ✅ 64＋8 | 四批齊全。`top64` 為 08:28–08:40 的 64 張加 12:07 補拍 1 張，數值於 2026-08-24 雙盲重抽後入庫（見下方批次清單） |

`top64` 自 round4 起納入流程，早期輪次沒有這批屬預期內。

## 批次清單

| 批次路徑 | 日期 | 張數 | 內容 | 產出 |
| -------- | ---- | ---- | ---- | ---- |
| `screenshots/star-cup/2026-06-23-round1-results/` | 2026-06-23 | 64 | 6/19 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-06-23-tournament-results.md](./star-cup/2026-06-23-tournament-results.md)、`data/2026-06-19.json`（逐場結果、各組冠亞軍） |
| `screenshots/star-cup/2026-07-03-round2-matchup/` | 2026-07-03 | 8 | 7/3 明星盃淘汰賽賽前對陣（102237＝第1組，104147–104241＝第2–8組） | [2026-07-03-round2-matchup.md](./star-cup/2026-07-03-round2-matchup.md)、`data/2026-07-03.json` |
| `screenshots/star-cup/2026-07-07-round2-results/` | 2026-07-07 | 64 | 7/4 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-07-07-tournament-results.md](./star-cup/2026-07-07-tournament-results.md)、`data/2026-07-03.json`（逐場結果、各組冠亞軍） |
| `screenshots/star-cup/2026-07-17-round3-matchup/` | 2026-07-17 | 8 | 7/17 明星盃淘汰賽賽前對陣（101651＝第1組，101748–101833＝第2–8組）；本批**無資格賽排行榜** | [2026-07-17-round3-matchup.md](./star-cup/2026-07-17-round3-matchup.md)、[2026-07-17-round3-betting-guide.md](./star-cup/2026-07-17-round3-betting-guide.md)、`data/2026-07-17.json`（groups 已併入） |
| `screenshots/star-cup/2026-07-17-round3-rank/` | 2026-07-17 | 10 | 7/17 明星盃資格賽排行榜前 70 名＋本期主題（明星盃-精靈季）；第 71 名起被自己名次列遮擋 | `data/2026-07-17.json`（主題、qualifier 前70名）、回填 [2026-07-17-round3-matchup.md](./star-cup/2026-07-17-round3-matchup.md) 資格賽欄與 [2026-07-17-round3-betting-guide.md](./star-cup/2026-07-17-round3-betting-guide.md) |
| `screenshots/star-cup/2026-07-23-round3-results/` | 2026-07-23 | 64 | 7/23 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽） | [2026-07-23-tournament-results.md](./star-cup/2026-07-23-tournament-results.md)、`data/2026-07-17.json`（逐場結果、各組冠亞軍已併入） |
| `screenshots/star-cup/2026-07-23-round3-results/Screenshot_20260724-000015.png` | 2026-07-24 | 1 | 補件：第4組 R2 上半（koeee vs I매I우연）對戰彈窗，原批次遺漏此張 | 回填 `data/2026-07-17.json`、[2026-07-23-tournament-results.md](./star-cup/2026-07-23-tournament-results.md) |
| `screenshots/star-cup/2026-07-31-round4/knockout-matchup/` | 2026-07-31 | 8 | 7/31 明星盃淘汰賽賽前對陣（10-21-55＝第1組，10-21-57–10-22-11＝第2–8組）。原為 Telegram 轉存的 `photo_*.jpg`，2026-08-13 自 Syncthing 來源找回並落入本目錄 | [2026-07-31-round4-matchup.md](./star-cup/2026-07-31-round4-matchup.md)、[2026-07-31-round4-betting-guide.md](./star-cup/2026-07-31-round4-betting-guide.md)、`data/star-cup/2026-07-31.json`（groups 已於 2026-08-06 連同結果併入）。2026-08-13 二次盲抽比對：64 格戰力 **0 個不符**；本屆 slot↔籤位為**交錯索引**（`A`=[0],[2]、`B`=[4],[6]、`C`=[1],[3]、`D`=[5],[7]），與其他三屆不同，見 README「排序約定」 |
| `screenshots/star-cup/2026-07-31-round4/qualifier-rank/` | 2026-08-09 | 16 | 7/31 明星盃資格賽排行榜連拍（21:58–22:08 補拍，涵蓋 1–67 名；第 68 名起被自己名次列遮擋）＋本期主題（明星盃-精靈季） | `data/2026-07-31.json`（主題、qualifier 已於 2026-08-06 併入，本批為事後補拍證據）、[2026-07-31-round4-matchup.md](./star-cup/2026-07-31-round4-matchup.md) 資格賽欄 |
| `screenshots/star-cup/2026-07-31-round4/top64-profile/` | 2026-08-09 | 64 | 7/31 前 64 名個人資訊名片**第二輪**拍攝（21:58–22:08）。與凌晨 01:10–02:33 那批為獨立兩次拍攝，時間戳無重疊 | 數值未入庫（同屆同 key 無法並存）。2026-08-13 雙盲比對：504 次欄位比對 27 個差異，**全部為累積型欄位單向增長**（相隔約 20 小時的真實進度），非抽取誤差；`player_id` 63/63 一致。本批的字形判讀差異已作為 **12 筆 `ocr_variants`** 寫入 `data/players.json`（`names` 未動——既有真名有名片 ID 佐證，第二次判讀僅列為變體） |
| `screenshots/star-cup/2026-07-31-round4/knockout-results/` | 2026-08-09 | 64 | 7/31 明星盃淘汰賽逐場成績**第二次拍攝**（22:13–22:20）。2026-08-13 自 Syncthing 來源 `2026-08-07/淘汰賽結果/` 補齊落地；`data/` 的逐場結果原抽自 2026-08-06 舊式目錄（見下列） **2026-08-14 全量重抽複核後已修正 25 個戰力欄位**（見下段）。2026-08-13 抽樣核對第 1 組：結果樹冠亞軍（LD丨힘／牛大力）、R1-A 全欄位（牛大力 42.72M/10/01:02.48 vs LD丨도하 13.97M/1/00:03.36）與既有 `data/` 相符。<br>**2026-08-14 全量重抽複核**（64/64 張盲讀，Sonnet 每組一代理只讀 power；56/56 場、8/8 樹狀圖全部比對）：確認 **6 位選手、20 個彈窗 `power`／`champion_power` 欄位**與 **4 組 `champion_current_power`**（合計 25 欄）與截圖不符，已以 `tools/apply-power-corrections.mjs` 修正並重生戰報。修正內容：G1 LD丨힘 34.75→**27.41M**、G3 送你離開 39.66→**41.08M**、G5 Cashasy 22.65→**19.06M**、G6 koeee 60.93→**60.95M**、G6 紅桃A 14.96→**15.05M**、G8 RV297 23.87→**26.53M**；樹狀圖 G1 36.65→**36.76M**、G2 22.30→**22.56M**、G6 62.46→**62.93M**、G7 16.56→**17.76M**。<br>**前次抽樣的結論已被推翻**：2026-08-13 把 `champion_current_power` 36.65→36.76M 判為「累積型欄位的正常增長、非抽取誤差」是**錯的**——樹狀圖與彈窗同屬本批同一次連拍，無增長空間；回看原圖確認樹上 4 處皆顯示 36.76M，屬數字轉置誤讀。成因為原匯入把單一戰力值複製到同組所有場次（8 組晉級者的 power 皆為組內常數），已將此偵測法寫入 `screenshot-extract` skill |
| `screenshots/star-cup/2026-07-31-round4/grand-finals-results/` | 2026-08-09 | 8 | 7/31 明星盃**總決賽**結果（22:30–22:31）：1 張結果樹＋7 場對戰彈窗。2026-08-13 自 Syncthing 來源 `2026-08-07/總決賽結果/` 補齊落地。本屆首度取得總決賽原圖 | 已入庫 `data/star-cup/2026-07-31.json` 的 `grand_finals`（`results` 8 筆＋`bracket` 7 場）、`champion: koeee`、`collection.grand_finals: complete`，並渲染進 [2026-08-06-tournament-results.md](./star-cup/2026-08-06-tournament-results.md)「總決賽」節。冠軍 **koeee**、亞軍 **LD丨힘**、並列 3 RV297／送你離開、並列 5 藍寶基尼／LD丨팡대ɔɔ／LD丨팡대／Cashasy。交叉驗證：總決賽 8 人與 8 組冠軍**完全一致**；賽時戰力跨場快照一致。結果樹最下排 RV297 勝 送你離開 為三四名戰，依 `domain.mjs` 規則**不用於拆分並列 3**（不猜測同輪淘汰者內部順序） |
| `screenshots/star-cup/2026-08-06-round4-results/` | 2026-08-06 | 64 | 8/6 明星盃淘汰賽逐場成績（8 組 R1/R2/決賽）；資料夾原名 `2026-08-06-round3-results`，實為第四輪。**本機已無此目錄**（另一台機器的舊式平面目錄），同批內容的第二次拍攝見上列 `2026-07-31-round4/knockout-results/` | [2026-08-06-tournament-results.md](./star-cup/2026-08-06-tournament-results.md)、`data/2026-07-31.json`（逐場結果、各組冠亞軍已併入） |
| `screenshots/star-cup/2026-08-06-round4-results/Screenshot_20260806-175247.png` | 2026-08-06 | 1 | 補件：第2組 R1-B（仔仔團宗宗 vs 戰神蕉蕉）對戰彈窗，原批次該張為連線載入畫面（`Screenshot_20260806-154744.png`，未納入抽取） | 回填 `data/2026-07-31.json`、[2026-08-06-tournament-results.md](./star-cup/2026-08-06-tournament-results.md) |
| `screenshots/star-cup/2026-08-09-round4-top64/` | 2026-08-09 | 69（涵蓋 **64 位**） | 8/9 明星盃資格賽前 64 名的個人資訊名片（用戶ID、公會、普通/困難關卡、通天塔、戰力、魅力值、徽記、稱號）；本專案**首批 `top64`**。01:10–01:24 拍 64 張但 5 位被重複點開（龍×이뮤、Yööᶠˣ、coco幻、橙色楓葉、秘運行者Kai）；**02:17 補拍 4 張**（第 48、57、60、64 名）、**02:33 補拍 1 張**（第 46 名）。合計涵蓋全部 64 位 | `data/players.json`（新建，64 位跨賽事選手登記簿）、回填 `data/star-cup/2026-07-31.json`（**64/64 位掛上 `player_id`，`⚠` flag 清零**：兩位「牛大力」、兩位「龍×똥꼬」皆以用戶ID 區分並補齊資格賽名次）。確認改名 `o月亮惹的禍o`→`送你離開`；確認第 64 名「牛大办」實為**牛大刃**（`101821232`）。見 [top64-profile-workflow.md](../notes/workflows/top64-profile-workflow.md) |
| `screenshots/star-cup/2026-08-14-round5/qualifier-rank/` | 2026-08-14 | 16 | 8/14 明星盃資格賽排行榜連拍（08:28–08:40，涵蓋 1–68 名）＋本期主題（獲得精靈和飛劍流派技能）。來源 `shared/archero2/star-cup/round5/1.top64/` 為 **16 排行榜＋64 名片混裝 80 張**，依 5 張一循環（第 1 張為排行榜）拆分落地 | `data/star-cup/2026-08-14.json`（`season`、`theme`、`qualifier` 前 64 名、`status: in_progress`、`collection.qualifier: complete`）。第 32 名 LCFFKU 無公會／稱號（名片證實「公會:無」），`title` 記 null |
| `screenshots/star-cup/2026-08-14-round5/knockout-matchup/` | 2026-08-14 | 8 | 8/14 明星盃淘汰賽賽前對陣（08:46:45＝第1組，08:46:54–08:47:52＝第2–8組）。來源 `shared/archero2/star-cup/round5/2.matchup/` | `data/star-cup/2026-08-14.json`（`groups` 8 組 × 8 人、`collection.knockout_matchup: complete`）。**交叉驗證：對陣 64 人與資格賽前 64 名多重集完全一致**（兩批獨立抽取雙向核對通過）。顯示名稱「龍×똥꼬」本屆有 **3 位不同選手**（資格賽第 16／47／54 名，分屬第 2 組 2 位與第 8 組 1 位），已標 `⚠` 並留空資格賽對應，待 top64 名片以 `player_id` 區分。`players` 依截圖籤位順序記錄且不可排序；對陣關係一律以 `groups[].matches` 為準（見 README「排序約定」），本批為賽前批次故 `matches` 省略，待淘汰賽結果入庫時自結果樹填入——**不由 `players` 索引推導** |
| `screenshots/star-cup/2026-08-14-round5/top64-profile/` | 2026-08-14 | 65（涵蓋 **64 位**） | 8/14 前 64 名個人資訊名片，自上列混裝批次拆出。08:28–08:40 拍 64 張，其中第 41 名 龍×이노40 被重複點開兩張（`083418`／`083424`）、第 42 名 夜凜月 因而漏拍，**12:07 補拍 1 張**（`120711`，UI 顯示「我的營地」與改名鉛筆，證實拍攝者本人即第 42 名） | `data/players.json`（64 位的 `seasons["2026-08-14"]` 由 3 欄補成完整 10 欄，另 `guild` 11 位由 null 補值、9 位變更，新增 11 筆 `ocr_variants`；`names[]` **0 變動**）。**2026-08-24 雙盲重抽**：8/14 首次抽取經抽樣複驗發現數值大量不符已作廢，本次以 16 個子代理盲讀 65 張（8 Sonnet 讀 `name`／`guild`／`title`，8 Haiku 讀 `player_id` 與全部數字；`player_id` 兩邊都讀互為交叉驗證）。**`player_id` 65/65 兩模型完全一致，且與既有映射 64/64 相符**——既有 `source`→`player_id`→`qualifier_rank` 映射（出自被作廢那次的 `--identity-only` 匯入）由此獨立確認正確。名稱對 `qualifier[]` 64/64 相符（13 筆字形差異經放大裁決後全數收斂）、稱號 64/64 相符、累積型欄位對 7/31 名片 54 張 × 5 欄 **0 倒退**；名片平時戰力對季檔賽時戰力 64/65 為賽時較高（唯一例外 짱구ᶻZ 30.71M→30.60M，回看確認名片值無誤，屬換裝）。**`rank_hint`／`time_hint` 全批不可得**：名片彈窗完全遮住背後排行榜列，畫面底部固定那列是拍攝者本人（第 42 名，65 張全同）；Haiku 在此欄無中生有 16 筆數字（224／2013／1019…）而 Sonnet 全記 null，由雙讀交叉驗證擋下，該欄未進抽取檔。**放大裁決 28 項**（3×／5×／8×，純 Node zlib 解 PNG 自製裁切，本機無 PIL／ImageMagick）：`ᴬᴷ` 前綴在名片上確實是上標（盲讀成 `AK` 為誤讀，4 筆）、`쿨쿨`（非 쿵쿵）、`龍×이뮤`、`龍×교슘`（盲讀的「2」是名稱下方裝飾字非字元）、`龍×똥꼬`、`ARKΛ`、`FLΞX`、`Zënith`、`姒神`（非 奴神）；**名片上的藍色橫幅就是稱號欄**——子代理「藍旗＝公會旗」的推測不成立，5 筆 `title` 由 null 補回，其中第 62 名首字被盾牌圖示遮住、完整字串由 `qualifier[]` 獨立佐證。**兩項仍無法斷定**：`荃雉瓏`／`荃雄瓏` 中間字在 8× 下兩者皆合理，`ᶻZ` 尾字高度介於上標與大寫之間、字形無法區分大小寫（`z`／`Z` 同形）——兩者皆沿用 `names[]` 既有值，名片字形記入 `ocr_variants`。第 47／54 名兩位同名 `龍×똥꼬` 稱號皆為洞察先機，**以本批已驗證的「檔名時間序＝名次序」推得**（其餘 62 位由唯一名稱釘死、第 16 名由稱號 용기사 釘死），屬推論非獨立證據。第 32 名 LCFFKU 名片顯示「公會:無」且無稱號橫幅，`guild`／`title` 記 null；importer 把「確認無此欄位」視為「未讀出」而報 `[UNSURE]`，故以 `--allow-partial` 明示放行（該批 `[MISSING]` 為空、涵蓋 64/64）。`[DUPE]` 1 筆即上述重複張 |
| `screenshots/star-cup/2026-08-14-round5/knockout-results/` | 2026-08-20 | 64 | 8/14 明星盃淘汰賽逐場成績（8 組 × 8 張：1 張結果樹＋7 場對戰彈窗），23:38–23:45 單次連拍。來源 `shared/archero2/star-cup/round5/3.knokout-result/` | `data/star-cup/2026-08-14.json`（`groups[].matches` 56 場、各組 `champion`／`runner_up`／`champion_power`／`champion_current_power`、`collection.knockout_results: complete`）、[2026-08-20-tournament-results.md](./star-cup/2026-08-20-tournament-results.md)。**抽取法**：8 組各派 2 個子代理盲讀不同欄位（Sonnet 讀樹狀圖結構＋名稱＋WIN/LOSE＋全欄位、Haiku 只讀彈窗數字），互為獨立雙讀；448 欄逐欄比對僅 **2 欄差異**（同一張的 WIN/LOSE 左右對調，回看橫幅原圖確認 Sonnet 正確）。**slot 歸位**：依結果樹狀圖版面（左上=A、左下=B、右上=C、右下=D），並與已發布下注快照的 R1 配對逐組核對一致；本屆 `players` 陣列恰為連續配對，與 round4 的交錯索引不同，再次證明**不可由索引推導**。**彈窗中央「決賽」是固定 UI 字串**（56 張全同），不是回合名。**改名 7 筆**（8/14→8/20）：욕정→열망、龍×똥꼬→파티똥꼬／퀵하똥꼬、泰融→準備換帳囉、龍×이노40→龍×이노테라、LCFFKU→拎刀蹦氣、龍×똥꼬→똥꼬조이；身分以集合減法＋slot 錨點＋戰力比對三重確認（三位同名者戰力 9.97M／17.77M／13.21M 與 8/14 完全相等）。已依 round4 慣例把 `groups[].players[].name` 改為現行名稱、賽前名存 `matchup_name`，並把 7 個新名稱 append 進 `data/players.json` 的 `names[]`（舊名在前、不刪）——第 2 組兩位同名 `龍×똥꼬` 因各自改名而自然區分，該屆重複顯示名稱警告消除。`qualifier[]` 與已發布的下注快照維持 8/14 舊名不動 |
| `screenshots/star-cup/2026-08-14-round5/grand-finals-results/` | 2026-08-22 | 8 | 8/14 明星盃**總決賽**結果（23:28–23:29）：1 張結果樹＋7 場對戰彈窗。來源 `shared/archero2/star-cup/round5/4.finals-results/` | `data/star-cup/2026-08-14.json`（`grand_finals` 的 `results` 8 筆＋`bracket` 7 場、`champion: ZᶻZ`、`status: finished`、`collection.grand_finals: complete`），並渲染進 [2026-08-20-tournament-results.md](./star-cup/2026-08-20-tournament-results.md)「總決賽」節。冠軍 **ZᶻZ**、亞軍 **koeee**、並列 3 RV297／AK메투스、並列 5 牛大力／쿨쿨ᶻZ／팡대ᶻZ／Cashasy。**決賽為 koeee 進度 0、時間 10:00.00**（疑未出賽），ZᶻZ 以 10／00:51.32 奪冠，已入 `notes`。交叉驗證：八強 8 人與 8 組冠軍多重集**完全一致**；賽時戰力 6/8 與各組 `champion_power` 相同，ZᶻZ（35.28→37.49M）與 RV297（22.99→23.07M）兩筆為 8/20→8/22 的跨批成長，已回看原圖確認——**round4 那次 8/8 相等不是不變量**，成立的是排序 分組賽時 ≤ 總決賽賽時 ≤ 結果樹目前戰力。雙模型逐欄比對 56 欄 0 差異。本批彈窗中央字串為「展示期」（7 張全同），與淘汰賽批的「決賽」不同——證實它是階段標籤而非回合名 |
| `screenshots/rune-ruins/2026-06-24/` | 2026-06-24 | 22 | 符文廢墟符文一覽（顏色×形狀） | ⚠️ 產出檔 `analysis/rune-ruins-stats.md` 已不存在（截圖仍在本機，可重新分析） |
| `screenshots/skills/` | 2026-07-03 | 1+ | 蓄能流技能組合木樁 60 秒 DPS 測試（10 組合；部分截圖僅貼在對話中未存檔） | ⚠️ 產出檔 `analysis/skill-dps-analysis.md` 已不存在（截圖僅剩 1 張，重驗能力有限） |

## 備份提醒

截圖不在 git 裡，GitHub 上沒有副本。若原始圖需要保存，
請將 `screenshots/` 加入雲端硬碟／NAS 同步；若分析產出已足夠，遺失僅損失重驗能力。
