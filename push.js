/* T-AWAY Web Push client helper. The VAPID public key is safe to expose. */
(function () {
  const publicKey = window.TAWAY_VAPID_PUBLIC_KEY || '';
  let registrationPromise = null;
  let pushDb = null;
  let staffUserId = null;
  let staffRole = null;

  function supported() {
    return Boolean(publicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  }

  function urlBase64ToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
  }

  async function register() {
    if (!('serviceWorker' in navigator)) return null;
    if (!registrationPromise) registrationPromise = navigator.serviceWorker.register('./sw.js', { scope: './' });
    return registrationPromise;
  }

  async function getClient() {
    if (pushDb) return pushDb;
    if (!window.supabase?.createClient || !window.TAWAY_SUPABASE_URL || !window.TAWAY_SUPABASE_PUBLISHABLE_KEY) return null;
    pushDb = window.supabase.createClient(window.TAWAY_SUPABASE_URL, window.TAWAY_SUPABASE_PUBLISHABLE_KEY);
    return pushDb;
  }

  async function subscribe(role, userId, orderId) {
    if (!supported()) return { ok: false, reason: 'unsupported' };
    const db = await getClient();
    if (!db) return { ok: false, reason: 'database' };
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'permission' };
    const registration = await register();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
    const json = subscription.toJSON();
    const row = {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      role,
      user_id: userId || null,
      order_id: orderId || null,
      active: true
    };
    const { error } = await db.from('push_subscriptions').insert(row);
    if (error) {
      console.error('push subscription save failed', error);
      return { ok: false, reason: 'save', error };
    }
    return { ok: true };
  }

  function removePrompt() {
    document.getElementById('tawayPushPrompt')?.remove();
  }

  function addPrompt(message, buttonText, handler) {
    removePrompt();
    const box = document.createElement('div');
    box.id = 'tawayPushPrompt';
    box.style.cssText = 'position:fixed;z-index:9999;left:50%;top:14px;transform:translateX(-50%);width:min(440px,calc(100% - 24px));padding:12px 14px;border-radius:14px;background:#10231d;color:#fff;box-shadow:0 12px 30px #10231d44;display:flex;align-items:center;gap:10px;font:12px -apple-system,BlinkMacSystemFont,"PingFang HK","Microsoft JhengHei",sans-serif';
    box.innerHTML = `<span style="flex:1;line-height:1.45">${message}</span><button id="tawayPushEnable" style="padding:8px 10px;border:0;border-radius:9px;background:#bbf05d;color:#10231d;font-weight:900;white-space:nowrap">${buttonText}</button><button id="tawayPushClose" aria-label="關閉" style="padding:4px 7px;border:0;background:transparent;color:#b8d0bd;font-size:16px">×</button>`;
    document.body.appendChild(box);
    box.querySelector('#tawayPushClose').onclick = removePrompt;
    box.querySelector('#tawayPushEnable').onclick = async () => {
      const button = box.querySelector('#tawayPushEnable');
      button.disabled = true;
      button.textContent = '設定中…';
      try { await handler(); } finally { removePrompt(); }
    };
  }

  async function syncStaff() {
    const db = await getClient();
    if (!db) return;
    const { data } = await db.auth.getUser();
    const user = data?.user;
    if (!user || user.id === staffUserId) return;
    staffUserId = user.id;
    const { data: profile } = await db.from('staff_profiles').select('role,active').eq('user_id', user.id).maybeSingle();
    if (!profile?.active || !['admin', 'courier'].includes(profile.role)) return;
    staffRole = profile.role;
    addPrompt(profile.role === 'admin' ? '開啟通知，客人落單時即時提醒你。' : '開啟通知，有可接配送時即時提醒你。', '開啟通知', () => subscribe(staffRole, user.id, null));
  }

  function showCustomerPrompt(orderId) {
    if (!supported()) return;
    addPrompt('開啟訂單通知，餐廳確認及配送狀態更新時提醒你。', '開啟訂單通知', () => subscribe('customer', null, orderId));
  }

  window.TAWAY_PUSH = { supported, register, subscribe, showCustomerPrompt, syncStaff };
  register().catch(console.error);
  getClient().then(db => {
    if (!db) return;
    db.auth.onAuthStateChange(() => setTimeout(syncStaff, 0));
    setTimeout(syncStaff, 500);
  });
})();
