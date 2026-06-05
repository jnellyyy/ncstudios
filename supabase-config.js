const NC_SUPABASE_URL = "https://qimgavpfscpnlsbxjhbk.supabase.co";

const NC_SUPABASE_ANON_KEY = "sb_publishable_CIR45TS0FmiV_RiQZBqhfg_-mDFUqT7";

if(window.supabase && window.supabase.createClient){
  window.ncSupabase = window.supabase.createClient(
    NC_SUPABASE_URL,
    NC_SUPABASE_ANON_KEY
  );
}else{
  console.warn("NC Studios: Supabase library is not available yet.");
}
