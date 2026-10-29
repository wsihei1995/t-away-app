// T-AWAY public Supabase configuration.
// This publishable key is intended for browser use; never put a secret/service_role key here.
window.TAWAY_SUPABASE_URL = 'https://dovqihtmjmkbjyilboiz.supabase.co';
window.TAWAY_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_tDGKQqEpfEUGhlQ8HHEflw_7DEp8TLl';
// Safe to expose in the browser; the matching private key stays in Supabase Edge Function Secrets.
window.TAWAY_VAPID_PUBLIC_KEY = 'BFvZ0pP2pzQ7MIDOW0_RVz6e_8Hm-7Bi4NzgzvoLlWaWkt7Jo0KLItLMLCJpy9LexEYpCuo2jFsR2KAWeDzd1SI';
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
