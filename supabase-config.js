// Use the project URL and publishable key from the Supabase Dashboard.
const supabaseConfig = Object.freeze({
  url: 'https://swgmrewjmbdmpbpmnutp.supabase.co',
  publishableKey: 'sb_publishable_s3XxhVNFjAZ8Z4-pBBLQOA_5cUnDNqE'
});

const supabaseUrl = supabaseConfig.url.replace(/\/+$/, '');
const useSupabase = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)
  && supabaseConfig.publishableKey.startsWith('sb_publishable_');
