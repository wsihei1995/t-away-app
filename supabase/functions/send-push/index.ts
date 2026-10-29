import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const cleanBase64Secret = (name: string) => {
  const raw = Deno.env.get(name) || '';
  return raw
    .replace(/\s+/g, '')
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(new RegExp(`^${name}=`, 'i'), '')
    .replace(/=+$/g, '');
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const configuredSecretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  (configuredSecretKeys ? JSON.parse(configuredSecretKeys).default : '');
const webhookSecret = (Deno.env.get('PUSH_WEBHOOK_SECRET') || '').trim();
const vapidPublicKey = cleanBase64Secret('VAPID_PUBLIC_KEY');
const vapidPrivateKey = cleanBase64Secret('VAPID_PRIVATE_KEY');
const vapidSubject = (Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com')
  .trim()
  .replace(/^['"`]+|['"`]+$/g, '');
const admin = createClient(supabaseUrl, serviceRoleKey);

let vapidConfigured = false;
try {
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    vapidConfigured = true;
  }
} catch (error) {
  console.error('VAPID configuration error:', error instanceof Error ? error.message : String(error));
}

console.info('VAPID configuration loaded', {
  publicKeyConfigured: Boolean(vapidPublicKey),
  publicKeyLength: vapidPublicKey.length,
  privateKeyConfigured: Boolean(vapidPrivateKey),
  privateKeyLength: vapidPrivateKey.length,
  subjectConfigured: Boolean(vapidSubject)
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const label = (status: string) => ({
  pending: '待確認', confirmed: '已確認', preparing: '準備中',
  delivering: '配送中', completed: '已完成', cancelled: '已取消'
} as Record<string, string>)[status] || status;

async function activeSubscriptions(role: string, userIds?: string[], orderId?: string) {
  let query = admin.from('push_subscriptions').select('*').eq('role', role).eq('active', true);
  if (userIds?.length) query = query.in('user_id', userIds);
  if (orderId) query = query.eq('order_id', orderId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function sendTo(subscriptions: any[], notification: any) {
  const unique = new Map<string, any>();
  for (const item of subscriptions) unique.set(item.endpoint, item);
  let sent = 0;
  for (const item of unique.values()) {
    try {
      await webpush.sendNotification({
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth }
      }, JSON.stringify(notification));
      sent += 1;
    } catch (error: any) {
      const code = error?.statusCode;
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').update({ active: false }).eq('id', item.id);
      } else {
        console.error('push delivery failed', code, error?.message || error);
      }
    }
  }
  return sent;
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const receivedPushSecret = (request.headers.get('x-push-secret') || '').trim();
  console.info('Webhook auth check', {
    receivedHeader: Boolean(receivedPushSecret),
    receivedHeaderLength: receivedPushSecret.length,
    configuredSecret: Boolean(webhookSecret),
    configuredSecretLength: webhookSecret.length,
    authorizationHeader: Boolean(request.headers.get('authorization'))
  });
  if (!webhookSecret || receivedPushSecret !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!vapidConfigured) return json({ error: 'VAPID secrets are not configured or invalid' }, 500);

  try {
    const payload = await request.json();
    const record = payload.record || payload.new_record || {};
    const oldRecord = payload.old_record || {};
    const eventType = String(payload.type || payload.eventType || '').toUpperCase();
    const orderId = record.id;
    if (!orderId) return json({ ok: true, sent: 0, reason: 'not an order event' });

    const statusChanged = eventType === 'INSERT' || record.status !== oldRecord.status;
    const assignedChanged = record.assigned_courier_id !== oldRecord.assigned_courier_id;
    if (!statusChanged && !assignedChanged) return json({ ok: true, sent: 0, reason: 'no notification change' });

    const code = record.public_code || orderId;
    const total = record.total ?? 0;
    let sent = 0;

    const { data: profiles } = await admin.from('staff_profiles')
      .select('user_id,role,active')
      .eq('active', true);
    const adminIds = (profiles || []).filter(p => p.role === 'admin').map(p => p.user_id);
    const activeCourierIds = (profiles || []).filter(p => p.role === 'courier').map(p => p.user_id);

    if (eventType === 'INSERT') {
      const subs = await activeSubscriptions('admin', adminIds);
      sent += await sendTo(subs, {
        title: 'T-AWAY 新訂單',
        body: `訂單 #${code} · $${total} · ${record.payment_method || '未選付款'}`,
        tag: `taway-admin-${orderId}`,
        data: { url: './admin.html', orderId }
      });
    }

    if ((statusChanged && record.status !== 'pending') || assignedChanged) {
      const adminSubs = await activeSubscriptions('admin', adminIds);
      sent += await sendTo(adminSubs, {
        title: `T-AWAY 訂單${label(record.status)}`,
        body: `訂單 #${code} · $${total}`,
        tag: `taway-admin-status-${orderId}-${record.status}`,
        data: { url: './admin.html', orderId }
      });
    }

    if ((statusChanged && ['confirmed', 'preparing'].includes(record.status) && !record.assigned_courier_id) ||
        (assignedChanged && record.assigned_courier_id)) {
      const courierIds = record.assigned_courier_id ? [record.assigned_courier_id] : activeCourierIds;
      const courierSubs = await activeSubscriptions('courier', courierIds);
      sent += await sendTo(courierSubs, {
        title: 'T-AWAY 可接配送訂單',
        body: `訂單 #${code} · 送餐至 ${record.address || '地址待查看'}`,
        tag: `taway-courier-${orderId}`,
        data: { url: './courier.html', orderId }
      });
    }

    if (statusChanged && eventType !== 'INSERT') {
      const customerSubs = await activeSubscriptions('customer', undefined, orderId);
      sent += await sendTo(customerSubs, {
        title: `T-AWAY 訂單${label(record.status)}`,
        body: `你的訂單 #${code} 現在是「${label(record.status)}」`,
        tag: `taway-customer-${orderId}-${record.status}`,
        data: { url: './index.html', orderId }
      });
    }

    return json({ ok: true, sent });
  } catch (error: any) {
    console.error(error);
    return json({ error: error?.message || 'Push notification failed' }, 500);
  }
});
