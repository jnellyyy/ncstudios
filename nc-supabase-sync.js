(function(){
  const SYNC_KEYS = [
    "ncstudios_bookings_v1",
    "ncstudios_clients_v1",
    "ncstudios_finance_v1",
    "ncstudios_delivery_v1",
    "ncstudios_lists_v1",
    "ncstudios_shots_v1",
    "ncstudios_templates_v1",
    "ncStudiosAdminTrackerV1"
  ];

  const STORAGE_TABLE = "app_storage";
  const RELOAD_FLAG_PREFIX = "nc_sync_reloaded_";
  const SYNC_DELAY = 600;

  let saveTimer = null;
  const originalSetItem = localStorage.setItem.bind(localStorage);

  function wait(ms){
    return new Promise(function(resolve){
      setTimeout(resolve, ms);
    });
  }

  async function waitForSupabase(){
    for(let i = 0; i < 50; i++){
      if(window.ncSupabase){
        return true;
      }

      await wait(150);
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

  function writeLocal(key, data){
    originalSetItem(key, JSON.stringify(Array.isArray(data) ? data : []));
  }

  async function saveKeyToSupabase(key){
    const ready = await waitForSupabase();

    if(!ready){
      console.warn("NC Sync: Supabase not ready for", key);
      return false;
    }

    const data = readLocal(key);

    const response = await window.ncSupabase
      .from(STORAGE_TABLE)
      .upsert(
        {
          app_key:key,
          data:data,
          updated_at:new Date().toISOString()
        },
        {
          onConflict:"app_key"
        }
      );

    if(response.error){
      console.warn("NC Sync: save failed for " + key, response.error);
      return false;
    }

    console.log("NC Sync: saved", key);
    return true;
  }

  async function loadKeyFromSupabase(key){
    const ready = await waitForSupabase();

    if(!ready){
      console.warn("NC Sync: Supabase not ready while loading", key);
      return false;
    }

    const response = await window.ncSupabase
      .from(STORAGE_TABLE)
      .select("data, updated_at")
      .eq("app_key", key)
      .maybeSingle();

    if(response.error){
      console.warn("NC Sync: load failed for " + key, response.error);
      return false;
    }

    if(!response.data || !Array.isArray(response.data.data)){
      return false;
    }

    const remoteData = response.data.data;
    const localData = readLocal(key);

    if(remoteData.length === 0 && localData.length > 0){
      await saveKeyToSupabase(key);
      return false;
    }

    const remoteString = JSON.stringify(remoteData);
    const localString = JSON.stringify(localData);

    if(remoteString !== localString){
      writeLocal(key, remoteData);
      return true;
    }

    return false;
  }

  function patchLocalStorage(){
    localStorage.setItem = function(key, value){
      originalSetItem(key, value);

      if(SYNC_KEYS.includes(key)){
        clearTimeout(saveTimer);

        saveTimer = setTimeout(function(){
          saveKeyToSupabase(key);
        }, SYNC_DELAY);
      }
    };
  }

  async function pullAllFromSupabase(){
    let changed = false;

    for(const key of SYNC_KEYS){
      const didChange = await loadKeyFromSupabase(key);

      if(didChange){
        changed = true;
      }
    }

    const pageKey = RELOAD_FLAG_PREFIX + location.pathname;

    if(changed && !sessionStorage.getItem(pageKey)){
      sessionStorage.setItem(pageKey, "yes");
      location.reload();
    }
  }

  async function pushAllLocalToSupabase(){
    for(const key of SYNC_KEYS){
      await saveKeyToSupabase(key);
    }
  }

  window.NCSync = {
    readLocal:readLocal,
    writeLocal:writeLocal,
    saveKeyToSupabase:saveKeyToSupabase,
    loadKeyFromSupabase:loadKeyFromSupabase,
    pullAllFromSupabase:pullAllFromSupabase,
    pushAllLocalToSupabase:pushAllLocalToSupabase
  };

  patchLocalStorage();

  window.addEventListener("load", function(){
    pullAllFromSupabase();
  });
})();
