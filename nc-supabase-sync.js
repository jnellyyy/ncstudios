(function(){
  const SUPABASE_WAIT_LIMIT = 40;
  const SUPABASE_WAIT_DELAY = 150;

  async function waitForSupabase(){
    for(let attempt = 0; attempt < SUPABASE_WAIT_LIMIT; attempt++){
      if(window.ncSupabase){
        return true;
      }

      await new Promise(function(resolve){
        setTimeout(resolve, SUPABASE_WAIT_DELAY);
      });
    }

    return false;
  }

  function readLocal(key){
    try{
      const saved = JSON.parse(localStorage.getItem(key));
      return Array.isArray(saved) ? saved : [];
    }catch(error){
      return [];
    }
  }

  function saveLocal(key, data){
    localStorage.setItem(key, JSON.stringify(Array.isArray(data) ? data : []));
  }

  async function loadFromSupabase(key){
    const ready = await waitForSupabase();

    if(!ready){
      console.warn("Supabase is not ready. Using local data for:", key);
      return readLocal(key);
    }

    const response = await window.ncSupabase
      .from("app_storage")
      .select("data")
      .eq("app_key", key)
      .maybeSingle();

    if(response.error){
      console.warn("Could not load Supabase data for:", key, response.error);
      return readLocal(key);
    }

    if(!response.data || !Array.isArray(response.data.data)){
      return readLocal(key);
    }

    saveLocal(key, response.data.data);
    return response.data.data;
  }

  async function saveToSupabase(key, data){
    saveLocal(key, data);

    const ready = await waitForSupabase();

    if(!ready){
      console.warn("Supabase is not ready. Saved locally only for:", key);
      return {
        ok:false,
        mode:"local",
        error:"Supabase is not ready"
      };
    }

    const response = await window.ncSupabase
      .from("app_storage")
      .upsert(
        {
          app_key:key,
          data:Array.isArray(data) ? data : [],
          updated_at:new Date().toISOString()
        },
        {
          onConflict:"app_key"
        }
      );

    if(response.error){
      console.warn("Could not save Supabase data for:", key, response.error);
      return {
        ok:false,
        mode:"local",
        error:response.error.message || "Supabase save failed"
      };
    }

    return {
      ok:true,
      mode:"supabase"
    };
  }

  async function syncLocalToSupabase(key){
    const localData = readLocal(key);
    return saveToSupabase(key, localData);
  }

  async function refreshLocalFromSupabase(key){
    return loadFromSupabase(key);
  }

  function makeId(prefix){
    if(window.crypto && typeof window.crypto.randomUUID === "function"){
      return window.crypto.randomUUID();
    }

    return String(prefix || "item") + "_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  window.NCSync = {
    readLocal:readLocal,
    saveLocal:saveLocal,
    loadFromSupabase:loadFromSupabase,
    saveToSupabase:saveToSupabase,
    syncLocalToSupabase:syncLocalToSupabase,
    refreshLocalFromSupabase:refreshLocalFromSupabase,
    makeId:makeId
  };
})();