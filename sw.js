const CACHE_NAME = 'taway-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'T-AWAY 訂單通知';
  const options = {
    body: data.body || '你有一則新的 T-AWAY 通知。',
    icon: './t-away-mobile-preview.png',
    badge: './t-away-mobile-preview.png',
    tag: data.tag || 'taway-notification',
    renotify: true,
    data: data.data || { url: './index.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || './index.html';
  event.waitUntil((async () => {
    const pages = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const page = pages.find(item => 'focus' in item);
    if (page) {
      await page.focus();
      if ('navigate' in page) await page.navigate(target);
    } else if (clients.openWindow) {
      await clients.openWindow(target);
    }
  })());
});
