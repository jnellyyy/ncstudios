(function(){
  const SYNC_KEYS = [
    "ncstudios_bookings_v1",
    "ncstudios_clients_v1",
    "ncstudios_finance_v1",
    "ncstudios_delivery_v1",
    "ncstudios_lists_v1",
    "ncstudios_shots_v1",
    "ncstudios_timeline_v1",
    "ncstudios_gear_v1",
    "ncstudios_buylist_v1",
    "ncstudios_settings_v1",
    "ncstudios_consultations_v1",
    "ncstudios_capture_v1",
    "ncstudios_callsheets_v1",
    "ncstudios_messages_v1",
    "ncstudios_templates_v1",
    "ncStudiosAdminTrackerV1"
  ];

  const STORAGE_TABLE = "app_storage";
  const BOOKINGS_KEY = "ncstudios_bookings_v1";
  const MESSAGES_KEY = "ncstudios_messages_v1";
  const PUBLIC_ENQUIRY_PREFIX = "website_enquiry_";
  const PUBLIC_MESSAGE_PREFIX = "website_message_";
  const RELOAD_FLAG_PREFIX = "nc_sync_reloaded_";
  const SAVE_DELAY = 250;

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const pendingSaves = new Set();

  let initialPullFinished = false;
  let saveTimer = null;

  function wait(ms){
    return new Promise(function(resolve){
      setTimeout(resolve, ms);
    });
  }

  async function waitForSupabase(){
    for(let attempt = 0; attempt < 60; attempt++){
      if(window.ncSupabase){
        return true;
      }

      await wait(150);
    }

    return false;
  }

  function isSyncKey(key){
    return SYNC_KEYS.includes(String(key));
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
    originalSetItem.call(localStorage, key, JSON.stringify(Array.isArray(data) ? data : []));
  }

  function queueSave(key){
    if(!isSyncKey(key)) return;

    pendingSaves.add(String(key));

    if(!initialPullFinished){
      return;
    }

    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushPendingSaves, SAVE_DELAY);
  }

  async function saveKeyToSupabase(key){
    const ready = await waitForSupabase();

    if(!ready){
      console.warn("NC Sync: Supabase not ready. Saved locally only:", key);
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

  async function flushPendingSaves(){
    if(pendingSaves.size === 0) return;

    const keys = Array.from(pendingSaves);
    pendingSaves.clear();

    for(const key of keys){
      await saveKeyToSupabase(key);
    }
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

    const localData = readLocal(key);

    if(!response.data || !Array.isArray(response.data.data)){
      if(localData.length > 0){
        await saveKeyToSupabase(key);
      }
      return false;
    }

    const remoteData = response.data.data;

    if(JSON.stringify(remoteData) !== JSON.stringify(localData)){
      writeLocal(key, remoteData);
      return true;
    }

    return false;
  }

  function normalisePublicEnquiry(row){
    const data = row && row.data;

    if(!data || typeof data !== "object" || !data.id || !data.clientName){
      return null;
    }

    return {
      ...data,
      status:data.status || "enquiry",
      nextAction:data.nextAction || "Reply to website enquiry",
      source:data.source || "website",
      contactEmail:data.contactEmail || data.contactemail || "",
      contactPhone:data.contactPhone || data.contactphone || "",
      createdAt:data.createdAt || data.updatedAt || new Date().toISOString(),
      updatedAt:data.updatedAt || new Date().toISOString()
    };
  }

  async function importPublicEnquiries(){
    const ready = await waitForSupabase();

    if(!ready){
      console.warn("NC Sync: Supabase not ready while loading website enquiries");
      return false;
    }

    const response = await window.ncSupabase
      .from(STORAGE_TABLE)
      .select("app_key, data")
      .like("app_key", PUBLIC_ENQUIRY_PREFIX + "%");

    if(response.error){
      console.warn("NC Sync: website enquiry load failed", response.error);
      return false;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    const incoming = rows
      .map(normalisePublicEnquiry)
      .filter(Boolean);

    if(!incoming.length){
      return false;
    }

    const bookings = readLocal(BOOKINGS_KEY);
    const existingIds = new Set(bookings.map(item => item && item.id).filter(Boolean));
    const newBookings = incoming.filter(item => !existingIds.has(item.id));

    if(newBookings.length){
      writeLocal(BOOKINGS_KEY, [...newBookings, ...bookings]);
      await saveKeyToSupabase(BOOKINGS_KEY);
    }

    const importedKeys = rows
      .map(row => row && row.app_key)
      .filter(Boolean);

    if(importedKeys.length){
      const cleanup = await window.ncSupabase
        .from(STORAGE_TABLE)
        .delete()
        .in("app_key", importedKeys);

      if(cleanup.error){
        console.warn("NC Sync: website enquiry cleanup failed", cleanup.error);
      }
    }

    return newBookings.length > 0;
  }

  function normalisePublicMessage(row){
    const data = row && row.data;

    if(!data || typeof data !== "object" || !data.id || !data.message){
      return null;
    }

    const now = new Date().toISOString();

    return {
      ...data,
      status:data.status || "new",
      source:data.source || "website message",
      channel:data.channel || "website",
      clientName:data.clientName || data.fullName || "Website visitor",
      contactEmail:data.contactEmail || data.email || "",
      contactPhone:data.contactPhone || data.phone || "",
      subject:data.subject || data.topic || "Website message",
      createdAt:data.createdAt || data.updatedAt || now,
      updatedAt:data.updatedAt || now,
      replies:Array.isArray(data.replies) ? data.replies : []
    };
  }

  function notifyImportedMessages(messages){
    if(!messages.length || !("Notification" in window) || Notification.permission !== "granted"){
      return;
    }

    const first = messages[0];
    const extra = messages.length > 1 ? " +" + (messages.length - 1) + " more" : "";

    try{
      new Notification("New NC Studio message" + extra, {
        body:(first.clientName || "Website visitor") + ": " + (first.message || "").slice(0,120),
        tag:"nc-studio-message"
      });
    }catch(error){
      console.warn("NC Sync: notification failed", error);
    }
  }

  async function importPublicMessages(){
    const ready = await waitForSupabase();

    if(!ready){
      console.warn("NC Sync: Supabase not ready while loading website messages");
      return false;
    }

    const response = await window.ncSupabase
      .from(STORAGE_TABLE)
      .select("app_key, data")
      .like("app_key", PUBLIC_MESSAGE_PREFIX + "%");

    if(response.error){
      console.warn("NC Sync: website message load failed", response.error);
      return false;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    const incoming = rows
      .map(normalisePublicMessage)
      .filter(Boolean);

    if(!incoming.length){
      return false;
    }

    const messages = readLocal(MESSAGES_KEY);
    const existingIds = new Set(messages.map(item => item && item.id).filter(Boolean));
    const newMessages = incoming.filter(item => !existingIds.has(item.id));

    if(newMessages.length){
      writeLocal(MESSAGES_KEY, [...newMessages, ...messages]);
      await saveKeyToSupabase(MESSAGES_KEY);
      notifyImportedMessages(newMessages);
      window.dispatchEvent(new CustomEvent("nc:messages-imported", { detail:{ messages:newMessages } }));
    }

    const importedKeys = rows
      .map(row => row && row.app_key)
      .filter(Boolean);

    if(importedKeys.length){
      const cleanup = await window.ncSupabase
        .from(STORAGE_TABLE)
        .delete()
        .in("app_key", importedKeys);

      if(cleanup.error){
        console.warn("NC Sync: website message cleanup failed", cleanup.error);
      }
    }

    return newMessages.length > 0;
  }

  function patchStorage(){
    if(window.__ncStoragePatched) return;
    window.__ncStoragePatched = true;

    Storage.prototype.setItem = function(key, value){
      originalSetItem.call(this, key, value);

      if(this === localStorage && isSyncKey(key)){
        queueSave(key);
      }
    };

    Storage.prototype.removeItem = function(key){
      originalRemoveItem.call(this, key);

      if(this === localStorage && isSyncKey(key)){
        queueSave(key);
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

    const importedPublicEnquiries = await importPublicEnquiries();
    if(importedPublicEnquiries){
      changed = true;
    }

    const importedPublicMessages = await importPublicMessages();
    if(importedPublicMessages){
      changed = true;
    }

    initialPullFinished = true;
    pendingSaves.clear();

    const pageKey = RELOAD_FLAG_PREFIX + location.pathname;

    if(changed && !sessionStorage.getItem(pageKey)){
      sessionStorage.setItem(pageKey, "yes");
      location.reload();
    }
  }

  async function pushAllLocalToSupabase(){
    initialPullFinished = true;

    for(const key of SYNC_KEYS){
      await saveKeyToSupabase(key);
    }
  }

  window.NCSync = {
    keys:SYNC_KEYS,
    readLocal:readLocal,
    writeLocal:writeLocal,
    saveKeyToSupabase:saveKeyToSupabase,
    loadKeyFromSupabase:loadKeyFromSupabase,
    importPublicEnquiries:importPublicEnquiries,
    importPublicMessages:importPublicMessages,
    pullAllFromSupabase:pullAllFromSupabase,
    pushAllLocalToSupabase:pushAllLocalToSupabase,
    flushPendingSaves:flushPendingSaves
  };

  patchStorage();

  window.addEventListener("load", function(){
    pullAllFromSupabase();
  });

  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "hidden"){
      flushPendingSaves();
    }
  });

  window.addEventListener("pagehide", function(){
    flushPendingSaves();
  });
})();
