# 盤面配線模擬器：工作規則

純 HTML／CSS／JS，網址 https://rayne-lrw.github.io/Circuit/ 。功能與檔案說明見 README.md。

## 溝通
- 一律用繁體中文回覆，進度說明也是。
- 使用者常說「先計畫」「先釐清」「先復盤，我說開始再開始」：這時只提方案，等使用者說開始才動手。
- 每次回報都要寫目前的版本號（index.html 標題旁的 v 號碼）。

## 每次修改後
1. `python3 scripts/bump-version.py`（更新 index.html 裡 css/js 的 ?v= 與版本號）
2. 跑測試（說明見 README「測試」）：
   - `node tests/route-check.js [使用者專案檔.json …]`
   - `node tests/layout-check.js`、`spec-check.js`、`fuzz-check.js`、`zone-check.js`、`review-check.js`、`sim-check.js`、`tpl-check.js`、`tpl-data-check.js`、`plc-sim-check.js`、`rack-check.js`、`place-check.js`、`adapter-check.js`、`chain-check.js`、`shihlin-check.js`、`label-check.js`
   - `node tests/smoke-check.js [使用者專案檔.json]`
   - 使用者專案檔只用最新的一份（使用者會上傳）；舊的不留。
3. 在工作分支 commit（中文訊息），fast-forward 合併到 main，兩個分支都推上去。不開 PR。

## 使用者資料
- 使用者上傳的專案檔（.json）只能在本機測試用，**不能 commit**（repo 是公開的）。
- 有密碼的 PDF 不查密碼、不繞過。

## 新增器具
- 依原廠手冊的「外形尺寸圖」和「端子排列圖」建立；接線示意圖不是實際腳位，只拿來判斷共點與輸入輸出。
- 接點只要相對位置正確，距離抓大概即可。
- 庫裡已有的型號略過。系列器具放在 js/devices-fx5.js、js/devices-fx3.js 這類分檔，用 `ser` 分組。
- 做完跑 tpl-data-check 與 plc-sim-check。
