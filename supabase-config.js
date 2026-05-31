const NC_SUPABASE_URL = "https://qimgavpfscppnlsbxjhbk.supabase.co";

const NC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbWdhdnBmc2NwbmxzYnhqaGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjk0NjYsImV4cCI6MjA5NTgwMDk2Nn0.fFR3oMeU15sn0FUNQGn769M_xQlrcDylstn4SHYvKcg";

window.ncSupabase = window.supabase.createClient(
  NC_SUPABASE_URL,
  NC_SUPABASE_ANON_KEY
);