# 天水圍人車隊 T-AWAY

## 網頁
- `index.html`：客人外賣前台
- `admin.html`：餐廳、菜單及訂單管理後台
- `supabase-config.js`：瀏覽器用 Supabase Project URL 及 Publishable key（不可放 secret/service role key）

## 雲端版本使用方法
1. 在 Supabase Authentication → Users → Add user 建立後台管理員 Email／密碼。
2. 打開 `admin.html`，用該 Email／密碼按「登入雲端後台」。
3. 第一次登入時，如果餐廳表仍是空白，系統會把示範餐廳及菜單初始化到 Supabase；之後你可直接新增、修改、刪除及上下架資料。
4. 客人前台會讀取 Supabase 的上架餐廳及菜單。
5. 客人訂單會寫入 Supabase；後台可即時看到新訂單，並按「確認接單 → 開始製作 → 出發配送 → 標記已完成」更新狀態。

## 示範模式
- 未設定或未使用雲端管理員帳戶時，可在 `admin.html` 輸入示範 PIN：`8888`。
- 示範模式資料只儲存在目前手機／瀏覽器的 localStorage，不會與其他客人或裝置同步。

## 訂單及權限
- 公開前台可以讀取上架餐廳／菜單及建立訂單，但不能讀取其他訂單。
- 只有 Supabase Auth 登入後台的帳戶可以讀取及更新雲端訂單、餐廳及菜單。
- 正式使用前，建議在 Supabase 再收緊 RLS，限制只有指定管理員帳戶可以管理餐廳及訂單。

## 付款功能狀態
前台已加入支付寶、微信支付、轉數快三種付款選項，以及送餐地址、電話、備註和訂單確認流程。現階段是可操作流程示範，未會真正扣款。

要正式收款，需要：
1. 申請相應支付商戶帳戶。
2. 由安全後端／Supabase Edge Function 保存商戶密鑰，不能直接放在前台 HTML。
3. 接入支付平台 API、付款回調及訂單核對。

## 本地測試
用瀏覽器開啟 `index.html` 看客人前台；用瀏覽器開啟 `admin.html` 管理餐廳資料。正式網址請使用 GitHub Pages 版本，因為部分瀏覽器對 `file://` 的跨來源及模組載入限制較多。
