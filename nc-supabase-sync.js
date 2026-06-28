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
    "ncstudios_project_status_v1",
    "ncstudios_consultations_v1",
    "ncstudios_capture_v1",
    "ncstudios_callsheets_v1",
    "ncstudios_messages_v1",
    "ncstudios_templates_v1",
    "ncstudios_content_v1",
    "ncstudios_crm_profiles_v1",
    "ncstudios_wedding_funds_v1",
    "ncStudiosAdminTrackerV1"
  ];

  const STORAGE_TABLE = "app_storage";
  const PUBLIC_ENQUIRIES_TABLE = "website_enquiries";
  const PUBLIC_MESSAGES_TABLE = "website_messages";
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

  async function getSession(){
    const ready = await waitForSupabase();

    if(!ready || !window.ncSupabase.auth){
      return null;
    }

    const response = await window.ncSupabase.auth.getSession();
    return response.data && response.data.session ? response.data.session : null;
  }

  function injectAuthStyles(){
    if(document.getElementById("ncSyncAuthStyles")) return;

    const style = document.createElement("style");
    style.id = "ncSyncAuthStyles";
    style.textContent = `
      .ncSyncAuth{
        position:fixed;
        left:16px;
        right:16px;
        bottom:16px;
        z-index:9999;
        max-width:760px;
        margin:0 auto;
        padding:14px;
        border:1px solid rgba(216,183,110,0.34);
        border-radius:20px;
        background:rgba(5,5,4,0.92);
        color:#f8f7f4;
        box-shadow:0 20px 60px rgba(0,0,0,0.45);
        backdrop-filter:blur(18px);
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      .ncSyncAuth[hidden]{display:none;}
      .ncSyncAuth strong{display:block;margin-bottom:4px;color:#e7c873;font-size:14px;}
      .ncSyncAuth p{margin:0 0 10px;color:rgba(248,247,244,0.74);font-size:13px;line-height:1.35;}
      .ncSyncAuth form{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:8px;}
      .ncSyncAuth input,
      .ncSyncAuth button{
        min-height:42px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.16);
        padding:10px 12px;
        font:inherit;
      }
      .ncSyncAuth input{background:rgba(255,255,255,0.08);color:#f8f7f4;}
      .ncSyncAuth button{cursor:pointer;background:#d8b76e;color:#080806;font-weight:700;}
      .ncSyncAuth .ncSyncLocalOnly{grid-column:1/-1;background:transparent;color:#f0dca8;border-color:rgba(216,183,110,0.34);}
      .ncSyncAuth .ncSyncAuthStatus{margin-top:8px;color:#f0a79e;font-size:12px;}
      @media(max-width:640px){
        .ncSyncAuth form{grid-template-columns:1fr;}
      }
    `;
    document.head.appendChild(style);
  }

  function showAuthPrompt(message){
    if(sessionStorage.getItem("nc_sync_use_local_only") === "yes"){
      return;
    }

    injectAuthStyles();

    let panel = document.getElementById("ncSyncAuth");
    if(!panel){
      panel = document.createElement("aside");
      panel.id = "ncSyncAuth";
      panel.className = "ncSyncAuth";
      panel.innerHTML = `
        <strong>studio sync is locked</strong>
        <p>Sign in to sync app data, import website enquiries, and publish website edits. Until then this page still saves locally on this device.</p>
        <form id="ncSyncAuthForm">
          <input id="ncSyncEmail" type="email" autocomplete="email" placeholder="email" required>
          <input id="ncSyncPassword" type="password" autocomplete="current-password" placeholder="password" required>
          <button type="submit">Sign in</button>
          <button class="ncSyncLocalOnly" type="button">Use this device only</button>
        </form>
        <div class="ncSyncAuthStatus" id="ncSyncAuthStatus"></div>
      `;
      document.body.appendChild(panel);

      panel.querySelector("#ncSyncEmail").value = localStorage.getItem("ncstudio_auth_email") || "";

      panel.querySelector("#ncSyncAuthForm").addEventListener("submit", async event => {
        event.preventDefault();

        const email = panel.querySelector("#ncSyncEmail").value.trim();
        const password = panel.querySelector("#ncSyncPassword").value;
        const status = panel.querySelector("#ncSyncAuthStatus");
        status.textContent = "Signing in...";

        try{
          const response = await window.ncSupabase.auth.signInWithPassword({email,password});

          if(response.error){
            throw response.error;
          }

          localStorage.setItem("ncstudio_auth_email", email);
          status.textContent = "Signed in. Syncing now...";
          panel.hidden = true;
          await pullAllFromSupabase();
          await pushAllLocalToSupabase();
        }catch(error){
          console.warn("NC Sync: sign in failed", error);
          status.textContent = "Sign in failed. Check the email/password user in Supabase Auth.";
        }
      });

      panel.querySelector(".ncSyncLocalOnly").addEventListener("click", function(){
        sessionStorage.setItem("nc_sync_use_local_only", "yes");
        panel.hidden = true;
      });
    }

    if(message){
      const status = panel.querySelector("#ncSyncAuthStatus");
      if(status) status.textContent = message;
    }

    panel.hidden = false;
  }

  async function ensureSignedIn(showPrompt){
    const session = await getSession();

    if(session){
      const panel = document.getElementById("ncSyncAuth");
      if(panel) panel.hidden = true;
      return true;
    }

    if(showPrompt !== false){
      showAuthPrompt("Sign in to unlock Supabase sync.");
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
    const signedIn = await ensureSignedIn(true);

    if(!signedIn){
      console.warn("NC Sync: not signed in. Saved locally only:", key);
      return false;
    }

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
    const signedIn = await ensureSignedIn(false);

    if(!signedIn){
      return false;
    }

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

  function mergeNewItems(storageKey, incoming){
    if(!incoming.length){
      return [];
    }

    const current = readLocal(storageKey);
    const existingIds = new Set(current.map(item => item && item.id).filter(Boolean));
    const newItems = incoming.filter(item => !existingIds.has(item.id));

    if(newItems.length){
      writeLocal(storageKey, [...newItems, ...current]);
    }

    return newItems;
  }

  async function importPublicEnquiries(){
    const signedIn = await ensureSignedIn(false);

    if(!signedIn){
      return false;
    }

    const ready = await waitForSupabase();

    if(!ready){
      console.warn("NC Sync: Supabase not ready while loading website enquiries");
      return false;
    }

    const response = await window.ncSupabase
      .from(PUBLIC_ENQUIRIES_TABLE)
      .select("id, data, created_at, updated_at")
      .is("imported_at", null)
      .order("created_at", { ascending:true });

    if(response.error){
      console.warn("NC Sync: website enquiry load failed", response.error);
      return false;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    const incoming = rows
      .map(normalisePublicEnquiry)
      .filter(Boolean);

    const newBookings = mergeNewItems(BOOKINGS_KEY, incoming);

    if(newBookings.length){
      await saveKeyToSupabase(BOOKINGS_KEY);
    }

    const importedIds = rows
      .map(row => row && row.id)
      .filter(Boolean);

    if(importedIds.length){
      const importedAt = new Date().toISOString();
      const cleanup = await window.ncSupabase
        .from(PUBLIC_ENQUIRIES_TABLE)
        .update({
          status:"imported",
          imported_at:importedAt,
          updated_at:importedAt
        })
        .in("id", importedIds);

      if(cleanup.error){
        console.warn("NC Sync: website enquiry mark-imported failed", cleanup.error);
      }
    }

    const importedLegacy = await importLegacyPublicEnquiries();
    return newBookings.length > 0 || importedLegacy;
  }

  async function importLegacyPublicEnquiries(){
    const response = await window.ncSupabase
      .from(STORAGE_TABLE)
      .select("app_key, data")
      .like("app_key", PUBLIC_ENQUIRY_PREFIX + "%");

    if(response.error){
      console.warn("NC Sync: legacy website enquiry load failed", response.error);
      return false;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    const incoming = rows
      .map(normalisePublicEnquiry)
      .filter(Boolean);
    const newBookings = mergeNewItems(BOOKINGS_KEY, incoming);

    if(newBookings.length){
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
        console.warn("NC Sync: legacy website enquiry cleanup failed", cleanup.error);
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
    const signedIn = await ensureSignedIn(false);

    if(!signedIn){
      return false;
    }

    const ready = await waitForSupabase();

    if(!ready){
      console.warn("NC Sync: Supabase not ready while loading website messages");
      return false;
    }

    const response = await window.ncSupabase
      .from(PUBLIC_MESSAGES_TABLE)
      .select("id, data, created_at, updated_at")
      .is("imported_at", null)
      .order("created_at", { ascending:true });

    if(response.error){
      console.warn("NC Sync: website message load failed", response.error);
      return false;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    const incoming = rows
      .map(normalisePublicMessage)
      .filter(Boolean);

    const newMessages = mergeNewItems(MESSAGES_KEY, incoming);

    if(newMessages.length){
      await saveKeyToSupabase(MESSAGES_KEY);
      notifyImportedMessages(newMessages);
      window.dispatchEvent(new CustomEvent("nc:messages-imported", { detail:{ messages:newMessages } }));
    }

    const importedIds = rows
      .map(row => row && row.id)
      .filter(Boolean);

    if(importedIds.length){
      const importedAt = new Date().toISOString();
      const cleanup = await window.ncSupabase
        .from(PUBLIC_MESSAGES_TABLE)
        .update({
          status:"imported",
          imported_at:importedAt,
          updated_at:importedAt
        })
        .in("id", importedIds);

      if(cleanup.error){
        console.warn("NC Sync: website message mark-imported failed", cleanup.error);
      }
    }

    const importedLegacy = await importLegacyPublicMessages();
    return newMessages.length > 0 || importedLegacy;
  }

  async function importLegacyPublicMessages(){
    const response = await window.ncSupabase
      .from(STORAGE_TABLE)
      .select("app_key, data")
      .like("app_key", PUBLIC_MESSAGE_PREFIX + "%");

    if(response.error){
      console.warn("NC Sync: legacy website message load failed", response.error);
      return false;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    const incoming = rows
      .map(normalisePublicMessage)
      .filter(Boolean);
    const newMessages = mergeNewItems(MESSAGES_KEY, incoming);

    if(newMessages.length){
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
        console.warn("NC Sync: legacy website message cleanup failed", cleanup.error);
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
    const signedIn = await ensureSignedIn(true);

    if(!signedIn){
      return;
    }

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
    const signedIn = await ensureSignedIn(true);

    if(!signedIn){
      return;
    }

    initialPullFinished = true;

    for(const key of SYNC_KEYS){
      await saveKeyToSupabase(key);
    }
  }

  window.NCSync = {
    keys:SYNC_KEYS,
    getSession:getSession,
    ensureSignedIn:ensureSignedIn,
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
