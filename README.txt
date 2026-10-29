# 天水圍人車隊 T-AWAY

## 網頁
- `index.html`：客人外賣前台
- `admin.html`：餐廳、菜單、付款及訂單管理後台
- `courier.html`：送遞員登入、接單及完成配送後台
- `supabase-config.js`：瀏覽器用 Supabase Project URL 及 Publishable key（不可放 secret/service role key）

## 雲端版本使用方法
1. 在 Supabase Authentication → Users → Add user 建立管理員 Email／密碼。
2. 在 Supabase SQL Editor 執行目前版本的 `supabase-schema.sql`。
3. 執行以下 SQL，把你的管理員 Auth User 設定為管理員。把 Email 換成你實際的管理員 Email：

```sql
insert into public.staff_profiles(user_id, role, display_name, active)
select id, 'admin', '主要管理員', true
from auth.users
where email = '你的管理員 Email';
```

4. 打開 `admin.html`，用該 Email／密碼按「登入雲端後台」。
5. 第一次登入時，如果餐廳表仍是空白，系統會把示範餐廳及菜單初始化到 Supabase；之後你可直接新增、修改、刪除及上下架資料。
6. 客人前台會讀取 Supabase 的上架餐廳及菜單。
7. 客人訂單會寫入 Supabase；管理員可即時看到新訂單。

## 送遞員後台
送遞員網址：`courier.html`

每位送遞員都需要一個獨立的 Supabase Auth 帳戶：

1. 管理員進入 Supabase Authentication → Users → Add user，建立送遞員 Email／密碼。
2. 複製該使用者的 User UID。
3. 在 Supabase SQL Editor 執行以下 SQL，替換每個人的 User UID、姓名及電話：

```sql
insert into public.staff_profiles(user_id, role, display_name, phone, active)
values
  ('送遞員 User UID 1', 'courier', '阿明', '61234567', true),
  ('送遞員 User UID 2', 'courier', '阿強', '62345678', true)
on conflict (user_id) do update set
  role = excluded.role,
  display_name = excluded.display_name,
  phone = excluded.phone,
  active = excluded.active;
```

4. 將 `courier.html` 網址及個人登入資料交給該送遞員。
5. 送遞員登入後，只會看到：
   - 尚未被接走、而餐廳已確認或正在準備中的訂單；
   - 自己已接的配送訂單；
   - 自己完成過的訂單。
6. 按「接單配送」後，資料庫會用原子操作鎖定該訂單。即使兩位送遞員同時按下，也只會有一位成功接單。
7. 送到客人後，送遞員按「已送到，完成訂單」，客人會收到完成狀態。

如要停用送遞員，將該筆 `staff_profiles.active` 改為 `false`；停用後不能再登入接單，但已接的訂單資料仍會保留。

## 餐廳及菜式分類
前台支援飯類、麵食、飲品、小食、甜品等分類。每間餐廳的菜式可以有自己的分類，客人打開餐廳菜單後可以按分類篩選；後台管理員在編輯餐廳時，可以修改餐廳分類，以及逐項修改每款菜式的分類，也可以輸入自訂分類。

如果已經使用舊版資料庫，需要再次執行目前版本的 `supabase-schema.sql`，讓 `menu_items` 增加 `category` 欄位；舊菜式會先按名稱自動分配初始分類，之後可在後台修正。

## 客人訂單狀態即時更新
目前訂單流程是：

```text
客人落單 → 管理員確認接單 → 開始製作 → 送遞員接單配送 → 送遞員完成配送
```

`order_tracking` 只保存訂單 UUID、公開訂單編號、狀態及時間，不公開客人地址、電話或付款資料。客人前台會即時收到接單、製作、配送及完成狀態。

## 客人送餐資料
付款頁面會提供「記住地址及電話，下次自動填寫」選項。資料只保存在客人目前手機／瀏覽器的 localStorage，不會用作公開訂單追蹤資料；客人可以取消勾選，或按「清除」刪除已記住資料。

如要讓同一位客人在不同手機登入後仍然同步地址，需要另外加入客人帳戶及受 RLS 保護的 customer profile 表，現版本尚未啟用。

## 付款功能狀態
前台已加入支付寶、微信支付、轉數快三種付款方式。管理員可以在後台付款設定輸入支付寶／微信 QR Code 圖片網址及 FPS 電話，客人選擇付款方式後會看到相應資料。

現階段是「客人自行付款＋管理員人工確認」流程，未會自動驗證款項，也不是正式付款 API。正式收款需要商戶帳戶、支付服務商及 Supabase Edge Function；個人支付寶不適合直接接入公開網站。

## 手機推送通知
本專案已加入 PWA 及 Web Push 基礎檔案：`manifest.json`、`sw.js`、`push.js`。管理員、送遞員及客人都可以在自己的手機開啟通知權限。

要真正發送背景推送，還需要部署 `supabase/functions/send-push/index.ts`。先在自己的安全環境產生一對 VAPID 金鑰：

```bash
pnpm dlx web-push generate-vapid-keys
```

將產生的 **公開金鑰** 放入 `supabase-config.js` 的 `TAWAY_VAPID_PUBLIC_KEY`，將 **私密金鑰** 只放入 Supabase Edge Function Secrets，並不要把私密金鑰提交到 GitHub。然後部署：

```bash
supabase functions deploy send-push --no-verify-jwt
supabase secrets set \\
  VAPID_PUBLIC_KEY='你的 VAPID 公開金鑰' \\
  VAPID_PRIVATE_KEY='你的 VAPID 私密金鑰' \\
  VAPID_SUBJECT='mailto:你的管理員 Email' \\
  PUSH_WEBHOOK_SECRET='自訂一段長隨機字串'
```

`SUPABASE_URL` 及 Supabase 內建的管理密鑰由 Edge Function 環境提供；目前程式同時支援舊的 `SUPABASE_SERVICE_ROLE_KEY`，以及新格式的 `SUPABASE_SECRET_KEYS`。不要把任何管理密鑰放入前台或 GitHub。

在 Supabase Dashboard → Database → Webhooks 建立兩個 Webhook，網址都是：

```text
https://dovqihtmjmkbjyilboiz.supabase.co/functions/v1/send-push
```

兩個 Webhook 都要加入 Header：

```text
x-push-secret: 與 PUSH_WEBHOOK_SECRET 相同的字串
```

觸發設定：
1. `public.orders` 的 `INSERT`
2. `public.orders` 的 `UPDATE`

推送流程：
- 新訂單 → 通知管理員
- 餐廳確認／開始製作 → 通知可接單送遞員
- 送遞員接單及訂單狀態變更 → 通知客人及相關工作人員

VAPID 公開金鑰可以放在 `supabase-config.js`；VAPID 私密金鑰只放在 Edge Function Secrets。iPhone 必須先用 Safari 將 T-AWAY 加到主畫面，再開啟通知權限；Android 可用 Chrome／PWA 開啟通知。

## 權限及安全
- 公開前台可以讀取上架餐廳／菜單及建立訂單，但不能讀取其他訂單的完整資料。
- 管理員只能由 `staff_profiles.role = 'admin'` 的已啟用 Auth 帳戶登入。
- 送遞員只能由 `staff_profiles.role = 'courier'` 且已啟用的帳戶登入。
- 送遞員不能修改餐廳、付款設定或其他送遞員資料。
- 送遞員透過資料庫函數接單，不能直接把訂單改成自己的配送單。
- 前端只能放 Supabase Publishable key；不要放 service-role key、支付密鑰、商戶密碼或私人金鑰。

## 示範模式
- `admin.html` 仍可輸入示範 PIN：`8888`。
- 示範模式資料只儲存在目前手機／瀏覽器的 localStorage，不會與其他客人、管理員或送遞員同步。
- 送遞員後台不支援 PIN，必須使用 Supabase Auth 帳戶。

## 本地測試
用瀏覽器開啟 `index.html` 看客人前台；用 `admin.html` 管理餐廳資料；用 `courier.html` 測試送遞員流程。正式網址請使用 GitHub Pages 版本，因為部分瀏覽器對 `file://` 的跨來源及模組載入限制較多。
