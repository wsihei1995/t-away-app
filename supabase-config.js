// T-AWAY public Supabase configuration.
// This publishable key is intended for browser use; never put a secret/service_role key here.
window.TAWAY_SUPABASE_URL = 'https://dovqihtmjmkbjyilboiz.supabase.co';
window.TAWAY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_tDGKQqEpfEUGhlQ8HHEflw_7DEp8TLl';
// Safe to expose in the browser; the matching private key stays in Supabase Edge Function Secrets.
window.TAWAY_VAPID_PUBLIC_KEY = 'BECiq-_FBn8dmU6ZUKsDNnoJDXAlcuYHhYHseXJwPLwwg37nPvI9pVVCh6b3u46_SskrIQB7LXZJPp6qnYvjg4k';
(function () {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = './manifest.json';
  document.head.appendChild(manifest);
  const script = document.createElement('script');
  script.src = './push.js';
  script.defer = true;
  document.head.appendChild(script);
})();
