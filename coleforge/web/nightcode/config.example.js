// Copy to config.js for a local run. On Netlify, build-config.js writes config.js (and config.json)
// from the site's environment variables instead. The anon key is meant to be public: row level
// security in the migration decides what it can do. Never put the service_role key here.
window.NIGHTCODE_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
  siteUrl: "https://nightcode.coletechsystems.com/",
};
