(function(){
  "use strict";

  const UPDATED_AT = "2026-08-11T00:00:00.000Z";
  const MIGRATION_KEY = "ncstudios_seed_simi_kiefah_aug22_v2";

  const SENSES_PROJECT = {
    name:"Senses: The Day Party",
    stage:"completed"
  };

  const CURRENT_PROJECT = {
    name:"Simi + Kiefah",
    aliases:["Simi and Kiefah", "Simi + Keifah", "Simi and Keifah"],
    eventDate:"2026-08-22",
    location:"Birmingham - confirm exact ceremony and reception addresses"
  };

  const STORE_KEYS = {
    bookings:"ncstudios_bookings_v1",
    clients:"ncstudios_clients_v1",
    finance:"ncstudios_finance_v1",
    delivery:"ncstudios_delivery_v1",
    shots:"ncstudios_shots_v1",
    timeline:"ncstudios_timeline_v1",
    gear:"ncstudios_gear_v1",
    settings:"ncstudios_settings_v1",
    projectStages:"ncstudios_project_status_v1",
    consultations:"ncstudios_consultations_v1",
    callSheets:"ncstudios_callsheets_v1",
    capture:"ncstudios_capture_v1",
    tasks:"ncstudios_lists_v1",
    buyList:"ncstudios_buylist_v1",
    admin:"ncStudiosAdminTrackerV1"
  };

  const SIMI_SHOTS = [
    shot("details","Both venues","exterior, signage, street and arrival context","24mm","25fps","slow push or locked wide","wide establishing","Atmosphere","essential","open the film with place and atmosphere","Get clean vertical and horizontal options."),
    shot("details","Ceremony venue","decor, aisle, flowers, chairs, order of service","35mm","50fps","slow handheld details","close and medium","Detail","essential","soft movement across meaningful details","Shoot before guests sit down."),
    shot("details","Reception room","full room reveal before guests enter","24mm","25fps","slow pan or locked hold","wide","Hero","essential","premium room reveal","Get a clean wide, then details."),
    shot("details","Reception details","cake, tables, place cards, centrepieces, favours","50mm","50fps","slow slide","close detail","Detail","high","detail montage for pacing","Avoid cluttered backgrounds."),
    shot("details","Rings and accessories","rings, shoes, perfume, jewellery, invitation details","50mm","50fps","small push","close","Detail","essential","classic wedding detail sequence","Use natural light where possible."),
    shot("details","Audio setup","DJ mixer, recorder, mic receiver levels","35mm","25fps","locked check shot","medium close","Coverage","essential","proof of audio setup","Capture before speeches if possible."),

    shot("prep","Bride prep","makeup and hair finishing touches","35mm","50fps","gentle handheld","medium close","Coverage","essential","calm natural prep moments","Protect faces and hands."),
    shot("prep","Bride prep","dress hanging and dress detail","35mm","50fps","slow tilt","full to close","Detail","essential","dress reveal with texture","Get a clean room if possible."),
    shot("prep","Bride prep","bride getting into dress or final adjustment","50mm","50fps","hold and reframe","medium close","Hero","essential","emotional prep beat","Keep it respectful and calm."),
    shot("prep","Bride prep","mum, bridesmaids or close family reactions","70mm","50fps","hold from distance","close reaction","Reaction","high","quiet emotional reaction cutaways","Look for hands and faces."),
    shot("prep","Groom prep","groom details, watch, shoes, cufflinks","50mm","50fps","slow detail pass","close","Detail","high","groom detail rhythm","Keep it clean and quick."),
    shot("prep","Groom prep","groom with friends or family","35mm","50fps","handheld follow","medium","Coverage","high","natural laughs and nerves","Capture real interaction."),
    shot("prep","Travel / arrival","leaving prep or arriving at ceremony","24mm","50fps","follow movement","wide to medium","Movement","medium","transition from morning into ceremony","Useful if timings allow."),

    shot("ceremony","Ceremony room","guest arrivals and room atmosphere","24mm","25fps","handheld coverage","wide and medium","Coverage","high","guests greeting before ceremony","Get enough for setup."),
    shot("ceremony","B Camera safety","locked wide ceremony angle","24mm","25fps","tripod locked","wide safety","Safety","essential","full ceremony safety","Start before processional and keep rolling."),
    shot("ceremony","Front angle","groom waiting and reactions","70mm","25fps","tripod or steady hold","close","Reaction","essential","groom emotion before entrance","Do not miss hands and face."),
    shot("ceremony","Aisle","bride entrance","35mm","50fps","steady backwards or side hold","wide to medium","Hero","essential","clean processional moment","Prioritise focus over fancy movement."),
    shot("ceremony","Ceremony front","handover and couple together","70mm","25fps","hold steady","medium close","Coverage","essential","settle into ceremony story","Get both faces if possible."),
    shot("ceremony","Ceremony front","vows and readings","70mm","25fps","tripod/monopod hold","close","Hero","essential","clean speech coverage","Keep audio running."),
    shot("ceremony","Ceremony front","rings exchange close-up","70mm","50fps","hold and reframe","close hands","Detail","essential","hands and emotion","Shoot hands then faces."),
    shot("ceremony","Ceremony front","first kiss","70mm","50fps","hold steady","medium close","Hero","essential","do not miss moment","Stay composed and rolling."),
    shot("ceremony","Ceremony room","guest and parent reactions","70mm","25fps","quick reframes","close","Reaction","high","emotional cutaways","Only after safety is covered."),
    shot("ceremony","Ceremony room","signing register / certificate moment","35mm","25fps","small push","medium","Coverage","medium","official transition beat","Only if allowed."),
    shot("ceremony","Aisle / exit","couple recessional","24mm","50fps","move backwards","wide to medium","Movement","essential","joyful exit","Keep space and avoid blocking."),

    shot("portraits","After ceremony","confetti, hugs or immediate congratulations","24mm","50fps","inside the action","wide to medium","Hero","high","burst of emotion after ceremony","Capture quick real reactions."),
    shot("portraits","Family photos","full family group safety","35mm","25fps","locked or steady","wide group","Coverage","essential","usable family archive shot","Confirm exact groups on final call."),
    shot("portraits","Family photos","parents and siblings reactions between groups","70mm","50fps","hold from distance","close","Reaction","medium","natural family emotion","Cutaways while groups reset."),
    shot("portraits","Couple portraits","walking together","35mm","50fps","slow backwards","wide to medium","Movement","essential","classic couple movement","Keep it relaxed."),
    shot("portraits","Couple portraits","close hands, rings, bouquet and dress movement","70mm","50fps","hold and drift","close","Detail","high","intimate portrait details","Use for pacing between hero shots."),
    shot("portraits","Couple portraits","hero portrait looking at each other","70mm","50fps","steady hold","medium close","Hero","essential","emotional hero frame","Get one clean, flattering frame."),
    shot("portraits","Couple portraits","editorial solo bride portrait","70mm","50fps","hold","medium close","Hero","high","portfolio still-like frame","Useful for thumbnail/website."),
    shot("portraits","Couple portraits","editorial solo groom portrait","70mm","50fps","hold","medium close","Hero","medium","balance the story","Quick, confident and clean."),

    shot("reception","Reception entrance","couple entrance into room","24mm","50fps","backwards movement","wide to medium","Hero","essential","energy shift into reception","Know the entrance route first."),
    shot("reception","Reception room","guests clapping and cheering entrance","35mm","50fps","pan/reframe","medium","Reaction","high","room reaction cutaways","Pair with entrance audio."),
    shot("reception","Top table / couple","couple seated reactions","70mm","25fps","hold","close","Reaction","high","small moments during reception","Look for laughs and hands."),
    shot("reception","Reception room","food, service and guest conversations","35mm","50fps","handheld coverage","medium","Coverage","medium","social texture","Keep it tasteful and brief."),
    shot("reception","Reception room","outfit change 1 if it happens","35mm","50fps","hero walk-in","full body to medium","Hero","high","fresh chapter visual","Only if they have a change."),
    shot("reception","Reception room","outfit change 2 if it happens","35mm","50fps","hero walk-in","full body to medium","Hero","medium","extra style beat","Only if relevant."),

    shot("speeches","Speech setup","recorder running and speaker mic/source","35mm","25fps","locked check shot","medium close","Coverage","essential","audio safety confirmation","Check levels before speeches."),
    shot("speeches","B Camera safety","locked wide speeches angle","24mm","25fps","tripod locked","wide safety","Safety","essential","full speeches safety","Let it run through every speech."),
    shot("speeches","Speaker","main speaker clean coverage","70mm","25fps","steady hold","medium close","Hero","essential","usable speech footage","Do not chase too many reactions first."),
    shot("speeches","Couple table","Simi reaction during speeches","70mm","25fps","hold","close","Reaction","essential","priority face reaction","Get laughter and emotion."),
    shot("speeches","Couple table","Kiefah reaction during speeches","70mm","25fps","hold","close","Reaction","essential","priority face reaction","Get laughter and emotion."),
    shot("speeches","Guests","parents and guest reactions","70mm","25fps","quick reframes","close","Reaction","high","emotional reaction coverage","Only when speaker coverage is safe."),
    shot("speeches","Room","toast and applause","35mm","50fps","small push","medium wide","Movement","high","end of speeches release","Get glasses and smiles."),

    shot("dancing","Dance floor","first dance opening wide","24mm","25fps","steady hold","wide","Hero","essential","usable real-time opening","Start before music begins."),
    shot("dancing","Dance floor","first dance close faces and hands","50mm","50fps","slow orbit or hold","medium close","Hero","essential","romantic cutaways","Stay smooth and close enough."),
    shot("dancing","Dance floor","family watching first dance","70mm","25fps","hold","close","Reaction","high","family emotion","Grab quickly between couple shots."),
    shot("dancing","Dance floor","party floor opens","24mm","50fps","move into crowd","wide to medium","Movement","essential","energy shift into party","Make it feel inside the room."),
    shot("dancing","Dance floor","couple dancing in crowd","35mm","50fps","move with them","medium","Hero","essential","alive and immersive","Prioritise joy over perfection."),
    shot("dancing","Dance floor","friends dancing and singing along","35mm","50fps","handheld follow","medium close","Movement","high","party texture","Look for confident guests."),
    shot("dancing","Dance floor","hands up, claps, phones and beat drops","24mm","50fps","push into action","wide to close","Movement","high","social reel pacing","Use as edit punctuation."),
    shot("dancing","Dance floor","one clean laugh / joy close-up","70mm","50fps","hold and reframe","close","Reaction","essential","emotional ending beat","A strong closer for highlight pacing."),
    shot("details","Exit or night atmosphere","venue exterior, final hugs, empty room details","35mm","25fps","slow hold","wide to close","Atmosphere","medium","closing texture","Optional if timings allow.")
  ];

  const SIMI_TIMELINE = [
    timeline("09:00","prep","Charge, format and pack final check","Home / base","NC","upcoming","Confirm cards, batteries, audio, rentals and route before leaving."),
    timeline("10:30","prep","Arrive / travel buffer","Birmingham","NC","upcoming","Exact time depends on final venue timeline."),
    timeline("11:30","prep","Prep details and natural moments","Prep location TBC","A Camera","upcoming","Confirm prep address and access."),
    timeline("12:30","ceremony","Ceremony setup and B camera safety","Ceremony venue TBC","B Camera","upcoming","Set safety angle and audio before guests settle."),
    timeline("13:00","ceremony","Ceremony coverage","Ceremony venue TBC","A Camera","upcoming","Processional, vows, rings, kiss and recessional."),
    timeline("14:00","portraits","Family photos and congratulations","Venue / portrait area","NC","upcoming","Need final family group list and helper."),
    timeline("14:45","portraits","Couple portraits","Venue / nearby portrait spot","A Camera","upcoming","Get hero portraits, movement and close details."),
    timeline("16:00","reception","Reception room and entrance","Reception venue TBC","A Camera","upcoming","Room reveal, couple entrance and guest reactions."),
    timeline("17:00","speeches","Speeches and reactions","Reception venue TBC","A + B Camera","upcoming","Audio recorder on DJ/mixer feed if possible."),
    timeline("19:00","dancing","First dance","Dance floor","A Camera","upcoming","Wide start, close reactions and family watching."),
    timeline("20:00","dancing","Party coverage","Dance floor","A Camera","upcoming","Crowd, couple, friends, beat drops and final joy shots."),
    timeline("23:00","delivery","Double backup footage","Home / backup station","NC","upcoming","Back up to two places before wiping anything.")
  ];

  const SIMI_GEAR = [
    gear("camera","Sony A7 IV main body",1,"checked","Owned main camera. Clean lens mount, set date/time and format cards."),
    gear("lens","Samyang 35mm",1,"checked","Owned lens. Use for prep, portraits and natural coverage."),
    gear("rental","Second Sony A7 IV body",1,"rented","Rental booked. Test on collection and match settings."),
    gear("rental","Sony 24-70mm f2.8 GM II",1,"rented","Rental booked. Main flexible wedding lens."),
    gear("rental","Sony 70-200mm f2.8 GM II",1,"rented","Rental booked. Ceremony, speeches and reactions."),
    gear("monitor","Portkeys PT5 II monitor",1,"checked","Owned monitor. Pack HDMI and battery."),
    gear("power","NP-F550 monitor battery",1,"checked","Owned battery. Charge fully."),
    gear("power","Second NP-F550 monitor battery",1,"needed","Buy or confirm before wedding week."),
    gear("media","Two SD cards",2,"checked","Owned for now. Format and label empty/full sides."),
    gear("media","1TB SSD",1,"needed","Buy before 22 August for dedicated working storage."),
    gear("audio","DJI Mic 3",1,"checked","Test internal recording before wedding week."),
    gear("audio","Tascam DR-10L",1,"checked","Backup lav for groom/speeches."),
    gear("audio","Tascam DR-05XP",1,"needed","Buy if budget allows for mixer/room backup."),
    gear("audio","microSD card for recorder",1,"needed","Needed if DR-05XP is bought."),
    gear("audio","RCA to 3.5mm cable",1,"needed","For common DJ mixer output into recorder."),
    gear("accessories","Short flexible HDMI cable",1,"needed","Spare/clean monitor cable."),
    gear("accessories","K&F ND filter",1,"checked","Use for now; upgrade later."),
    gear("accessories","Small cable and adapter allowance",1,"needed","Audio adapter, spare HDMI or emergency replacement.")
  ];

  const SIMI_TASKS = [
    task("Confirm exact ceremony address","admin","high","2026-08-18","Ask for full address, parking entrance and access time."),
    task("Confirm exact reception address","admin","high","2026-08-18","Need room access time, parking and where to unload."),
    task("Confirm final wedding timeline","shoot prep","high","2026-08-18","Prep, ceremony, portraits, entrance, speeches, first dance and party."),
    task("Get family group photo list","client","high","2026-08-18","Ask who gathers people and any sensitive family notes."),
    task("Confirm DJ/audio output for speeches","gear","high","2026-08-20","Ask about mixer output, handheld mic and where speakers happen."),
    task("Collect and test rentals","gear","high","2026-08-20","Second body, 24-70 and 70-200. Match settings and check autofocus."),
    task("Format cards and prepare folders","shoot prep","high","2026-08-21","Cards labelled, folders ready, two-backup plan prepared."),
    task("Charge all camera, monitor and audio batteries","shoot prep","high","2026-08-21","Include DJI Mic 3, Tascam, Sony batteries and NP-F batteries."),
    task("Send final confirmation message","client","high","2026-08-21","Arrival time, contact details, venue addresses and emergency number."),
    task("Back up footage twice after the wedding","delivery","high","2026-08-22","Do not wipe cards until two separate backups exist.")
  ];

  const SIMI_BUY_ITEMS = [
    buy("1TB SSD","Storage + backup","urgent","needed",70,"Before 22 August","Dedicated working storage for Simi + Kiefah footage."),
    buy("Tascam DR-05XP","Audio","urgent","needed",93,"Before 22 August","Mixer feed, speeches backup and room ambience."),
    buy("microSD card for recorder","Audio","urgent","needed",12,"Before 22 August","Needed because recorder storage is separate."),
    buy("RCA to 3.5mm cable","Audio","urgent","needed",10,"Before 22 August","Common DJ mixer output into recorder."),
    buy("Second NP-F550 battery","Camera + filming","urgent","needed",15,"Before 22 August","Backup power for the Portkeys monitor."),
    buy("Short flexible HDMI cable","Camera + filming","soon","needed",15,"Before 22 August","Spare cable for monitor setup."),
    buy("Small cable and adapter allowance","Camera + filming","soon","needed",20,"Before 22 August","Emergency HDMI/audio adapter replacement.")
  ];

  function shot(section, location, shotText, lens, fps, movement, framing, shotType, priority, creativeExample, notes){
    return {section, location, shotText, lens, fps, movement, framing, shotType, priority, creativeExample, notes};
  }

  function timeline(time, phase, title, location, owner, status, notes){
    return {time, phase, title, location, owner, status, notes};
  }

  function gear(category, itemName, quantity, status, notes){
    return {category, itemName, quantity, status, notes};
  }

  function task(title, category, priority, dueDate, notes){
    return {title, category, priority, dueDate, status:"open", notes};
  }

  function buy(itemName, category, priority, status, price, targetDate, note){
    return {itemName, category, priority, status, price, targetDate, note};
  }

  function readArray(key){
    try{
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    }catch(error){
      return [];
    }
  }

  function writeArray(key,value){
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  }

  function projectKey(value){
    const noise = new Set(["and","the","of","for","wedding","film","films","video","videography","photography","shoot","project","couple","client"]);
    return String(value || "")
      .toLowerCase()
      .replace(/&|\+/g," and ")
      .replace(/[^a-z0-9]+/g," ")
      .trim()
      .split(/\s+/)
      .filter(word => word && !noise.has(word) && !/^\d{2,4}$/.test(word))
      .sort()
      .join(" ");
  }

  function sameProject(value, projectName){
    const left = projectKey(value);
    const right = projectKey(projectName);
    if(!left || !right) return false;
    if(left === right) return true;

    const leftTokens = left.split(/\s+/);
    const rightTokens = right.split(/\s+/);
    const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
    const longer = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
    const used = new Set();
    let matches = 0;

    shorter.forEach(token => {
      const index = longer.findIndex((candidate,candidateIndex) => !used.has(candidateIndex) && tokenLooksSame(token,candidate));
      if(index >= 0){
        used.add(index);
        matches++;
      }
    });

    return matches === shorter.length && longer.length <= shorter.length + 1;
  }

  function tokenLooksSame(left,right){
    if(left === right) return true;
    if(left.length < 4 || right.length < 4) return false;
    if(left.startsWith(right) || right.startsWith(left)) return Math.abs(left.length - right.length) <= 2;
    return editDistance(left, right, Math.max(left.length, right.length) >= 6 ? 2 : 1);
  }

  function editDistanceWithin(left,right,limit){
    if(Math.abs(left.length - right.length) > limit) return false;

    let previous = Array.from({length:right.length + 1}, (_,index) => index);

    for(let row = 1; row <= left.length; row++){
      const current = [row];
      let rowMin = current[0];

      for(let col = 1; col <= right.length; col++){
        const cost = left[row - 1] === right[col - 1] ? 0 : 1;
        current[col] = Math.min(previous[col] + 1, current[col - 1] + 1, previous[col - 1] + cost);
        rowMin = Math.min(rowMin, current[col]);
      }

      if(rowMin > limit) return false;
      previous = current;
    }

    return previous[right.length] <= limit;
  }

  function editDistance(left,right,limit){
    return editDistanceWithin(left,right,limit);
  }

  function projectValue(item){
    return item.project || item.projectName || item.client || item.clientName || item.eventName || item.name || "";
  }

  function seedId(prefix, index){
    return `seed-${prefix}${index !== undefined ? "-" + String(index + 1).padStart(2,"0") : ""}`;
  }

  function fillMissing(existing,next){
    const merged = {...existing};
    Object.keys(next).forEach(key => {
      const current = merged[key];
      if(current === undefined || current === null || current === ""){
        merged[key] = next[key];
      }
    });
    merged.updatedAt = existing.updatedAt || next.updatedAt || UPDATED_AT;
    return merged;
  }

  function upsert(key,item,matcher,options){
    const rows = readArray(key);
    const index = rows.findIndex(row => row.id === item.id || matcher(row));
    let changed = false;

    if(index >= 0){
      const next = options && options.replace ? {...rows[index],...item,id:rows[index].id} : fillMissing(rows[index], item);
      if(JSON.stringify(next) !== JSON.stringify(rows[index])){
        rows[index] = next;
        changed = true;
      }
    }else{
      rows.unshift(item);
      changed = true;
    }

    if(changed) writeArray(key, rows);
    return changed;
  }

  function setProjectStage(projectName, stage, notes, replace){
    const rows = readArray(STORE_KEYS.projectStages);
    const key = projectKey(projectName);
    const index = rows.findIndex(row => row.key === key || sameProject(row.project || row.key, projectName));
    const item = {
      id:index >= 0 ? rows[index].id : seedId(`${key.replace(/\s+/g,"-")}-stage`),
      key,
      project:projectName,
      stage,
      notes,
      updatedAt:UPDATED_AT
    };

    if(index >= 0){
      const current = rows[index];
      if(!replace && current.stage === stage && current.project === projectName) return false;
      rows[index] = {...current,...item};
    }else{
      rows.unshift(item);
    }

    writeArray(STORE_KEYS.projectStages, rows);
    return true;
  }

  function completeSensesProject(){
    let changed = false;
    changed = setProjectStage(SENSES_PROJECT.name, "completed", "Event covered. Keep out of the live dashboard.", true) || changed;

    const shots = readArray(STORE_KEYS.shots);
    let shotChanged = false;
    const nextShots = shots.map(item => {
      if(!sameProject(item.project, SENSES_PROJECT.name)) return item;
      if(item.captured === true) return item;
      shotChanged = true;
      return {...item,captured:true,updatedAt:UPDATED_AT};
    });
    if(shotChanged){
      writeArray(STORE_KEYS.shots, nextShots);
      changed = true;
    }

    const captures = readArray(STORE_KEYS.capture);
    let captureChanged = false;
    const nextCaptures = captures.map(item => {
      if(!sameProject(item.project, SENSES_PROJECT.name)) return item;
      if(item.status === "processed") return item;
      captureChanged = true;
      return {...item,status:"processed",updatedAt:UPDATED_AT};
    });
    if(captureChanged){
      writeArray(STORE_KEYS.capture, nextCaptures);
      changed = true;
    }

    return changed;
  }

  function ensureSimiProject(){
    const firstRun = localStorage.getItem(MIGRATION_KEY) !== "yes";
    let changed = false;

    changed = completeSensesProject() || changed;
    changed = setProjectStage(CURRENT_PROJECT.name, "live", "Current wedding focus. Use this as the dashboard project until 22 August.", true) || changed;

    changed = ensureBooking() || changed;
    changed = ensureClient() || changed;
    changed = ensureFinance() || changed;
    changed = ensureConsultation() || changed;
    changed = ensureCallSheet() || changed;
    changed = ensureShots() || changed;
    changed = ensureTimeline() || changed;
    changed = ensureGear() || changed;
    changed = ensureTasks() || changed;
    changed = ensureBuyList() || changed;
    changed = ensureAdminTracker() || changed;
    changed = ensureCaptureNote() || changed;

    if(firstRun){
      localStorage.setItem(MIGRATION_KEY, "yes");
    }

    if(changed){
      refreshVisiblePages();
      if(window.NCSync && typeof window.NCSync.getSession === "function" && typeof window.NCSync.flushPendingSaves === "function"){
        setTimeout(async () => {
          const session = await window.NCSync.getSession();
          if(session) window.NCSync.flushPendingSaves();
        }, 900);
      }
    }

    return changed;
  }

  function ensureBooking(){
    return upsert(STORE_KEYS.bookings, {
      id:"seed-simi-kiefah-booking",
      clientName:CURRENT_PROJECT.name,
      eventName:"Wedding videography",
      eventDate:CURRENT_PROJECT.eventDate,
      status:"confirmed",
      packagePrice:375,
      depositPaid:375,
      location:CURRENT_PROJECT.location,
      nextAction:"Confirm exact venues, parking, final timeline, family list, DJ audio and emergency contacts.",
      notes:"Paid in full. Rentals are booked for 85. Final prep should focus on logistics, audio, storage and gear checks.",
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT
    }, row => sameProject(row.clientName || row.eventName, CURRENT_PROJECT.name), {replace:true});
  }

  function ensureClient(){
    return upsert(STORE_KEYS.clients, {
      id:"seed-simi-kiefah-client",
      clientName:CURRENT_PROJECT.name,
      phone:"",
      email:"",
      eventDate:CURRENT_PROJECT.eventDate,
      status:"active",
      location:CURRENT_PROJECT.location,
      link:"",
      notes:"Current wedding. Need exact venue addresses, final contacts, family group list and DJ/audio details confirmed before the day.",
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT
    }, row => sameProject(row.clientName || row.name, CURRENT_PROJECT.name));
  }

  function ensureFinance(){
    let changed = false;
    changed = upsert(STORE_KEYS.finance, {
      id:"seed-simi-kiefah-paid-full",
      title:"Simi + Kiefah paid in full",
      type:"income",
      status:"paid",
      amount:375,
      date:"2026-08-11",
      category:"Wedding balance",
      client:CURRENT_PROJECT.name,
      notes:"Full payment received. Current usable balance from this payment is 0 after personal issue and rentals.",
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT
    }, row => sameProject(row.client || row.project || row.title, CURRENT_PROJECT.name) && row.type === "income", {replace:true});

    changed = upsert(STORE_KEYS.finance, {
      id:"seed-simi-kiefah-rentals-paid",
      title:"Simi + Kiefah rentals booked",
      type:"expense",
      status:"paid",
      amount:85,
      date:"2026-08-11",
      category:"Rentals",
      client:CURRENT_PROJECT.name,
      notes:"Rentals booked and paid at 85 flat.",
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT
    }, row => sameProject(row.client || row.project || row.title, CURRENT_PROJECT.name) && row.type === "expense" && /rental/i.test(row.title || row.category || "")) || changed;

    return changed;
  }

  function ensureConsultation(){
    return upsert(STORE_KEYS.consultations, {
      id:"seed-simi-kiefah-final-call",
      project:CURRENT_PROJECT.name,
      contactName:"Simi / Kiefah",
      callDate:"2026-08-18",
      callType:"final-call",
      status:"open",
      weddingDate:CURRENT_PROJECT.eventDate,
      ceremonyLocation:"Confirm exact ceremony venue",
      receptionLocation:"Confirm exact reception venue",
      finalPaymentStatus:"paid",
      timelineStatus:"needs-update",
      parkingMealStatus:"need-to-ask",
      kitRentalStatus:"booked",
      keyContacts:"Need bride, groom, planner/venue contact, DJ/contact for speeches audio, and family photo helper.",
      finalTimeline:"Confirm prep, ceremony, family photos, couple portraits, reception entrance, speeches, first dance and party timing.",
      familyShotList:"Need exact family group list and any sensitive family situations.",
      supplierNotes:"Confirm photographer, venue coordinator, DJ, parking/access, room turnaround and restrictions.",
      audioPlan:"DJI Mic 3 for groom/speeches, DR-10L as backup lav, DR-05XP/mixer feed if bought, room ambience if possible.",
      restrictionsNotes:"Ask about ceremony movement limits, registrar/church rules, parking, travel gaps and any filming restrictions.",
      rainPlan:"Confirm indoor portrait option and umbrella/covered route plan.",
      deliveryExpectations:"Confirm highlight priority, ceremony/speeches expectations and any teaser/social permission.",
      nextStep:"Run final call and fill exact venues, contacts, timeline, family list, parking, meal and audio plan.",
      finalActions:"Confirm venues, collect rentals, test audio, format cards, charge batteries, pack kit and send final confirmation message.",
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT
    }, row => sameProject(row.project, CURRENT_PROJECT.name) && row.callType === "final-call");
  }

  function ensureCallSheet(){
    return upsert(STORE_KEYS.callSheets, {
      id:"seed-simi-kiefah-call-sheet",
      project:CURRENT_PROJECT.name,
      eventDate:CURRENT_PROJECT.eventDate,
      venue:"Ceremony and reception venues TBC",
      address:"Confirm exact Birmingham addresses, parking entrance and unload point.",
      plannerName:"",
      plannerPhone:"",
      plannerEmail:"",
      bridePhone:"",
      groomPhone:"",
      secondShooter:"",
      keyPeople:"Need final list: parents, siblings, bridal party, family photo helper, best man/maid of honour and anyone not to miss.",
      restrictions:"Confirm ceremony filming rules, movement limits, no-flash rules, room access and any cultural/family sensitivities.",
      emergency:"Keep travel, parking, food and emergency buffer untouched until after 22 August.",
      notes:"Current day-of call sheet. Fill contact numbers and addresses before wedding week.",
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT
    }, row => sameProject(row.project, CURRENT_PROJECT.name));
  }

  function ensureShots(){
    const rows = readArray(STORE_KEYS.shots);
    let changed = false;

    SIMI_SHOTS.forEach((row,index) => {
      const item = {
        id:seedId("simi-kiefah-shot", index),
        project:CURRENT_PROJECT.name,
        section:row.section,
        camera:row.shotType === "Safety" ? "B Camera safety" : "A Camera",
        shotType:row.shotType,
        priority:row.priority,
        location:row.location,
        shotText:row.shotText,
        lens:row.lens,
        fps:row.fps,
        lensFps:[row.lens,row.fps].filter(Boolean).join(" + "),
        movement:row.movement,
        framing:row.framing,
        creativeExample:row.creativeExample,
        notes:row.notes,
        captured:false,
        updatedAt:UPDATED_AT
      };
      const exists = rows.some(existing => existing.id === item.id || (sameProject(existing.project, CURRENT_PROJECT.name) && String(existing.shotText || "").trim().toLowerCase() === item.shotText.toLowerCase()));
      if(!exists){
        rows.push(item);
        changed = true;
      }
    });

    if(changed) writeArray(STORE_KEYS.shots, rows);
    return changed;
  }

  function ensureTimeline(){
    let changed = false;
    SIMI_TIMELINE.forEach((row,index) => {
      changed = upsert(STORE_KEYS.timeline, {
        id:seedId("simi-kiefah-timeline", index),
        project:CURRENT_PROJECT.name,
        time:row.time,
        phase:row.phase,
        title:row.title,
        location:row.location,
        owner:row.owner,
        status:row.status,
        notes:row.notes,
        updatedAt:UPDATED_AT
      }, item => sameProject(item.project, CURRENT_PROJECT.name) && item.title === row.title) || changed;
    });
    return changed;
  }

  function ensureGear(){
    let changed = false;
    SIMI_GEAR.forEach((row,index) => {
      changed = upsert(STORE_KEYS.gear, {
        id:seedId("simi-kiefah-gear", index),
        project:CURRENT_PROJECT.name,
        category:row.category,
        quantity:row.quantity,
        itemName:row.itemName,
        status:row.status,
        dueDate:row.status === "needed" ? "2026-08-21" : "",
        notes:row.notes,
        updatedAt:UPDATED_AT
      }, item => sameProject(item.project, CURRENT_PROJECT.name) && String(item.itemName || "").toLowerCase() === row.itemName.toLowerCase()) || changed;
    });
    return changed;
  }

  function ensureTasks(){
    let changed = false;
    SIMI_TASKS.forEach((row,index) => {
      changed = upsert(STORE_KEYS.tasks, {
        id:seedId("simi-kiefah-task", index),
        title:row.title,
        project:CURRENT_PROJECT.name,
        category:row.category,
        priority:row.priority,
        dueDate:row.dueDate,
        status:row.status,
        notes:row.notes,
        createdAt:UPDATED_AT,
        updatedAt:UPDATED_AT
      }, item => sameProject(item.project, CURRENT_PROJECT.name) && String(item.title || "").toLowerCase() === row.title.toLowerCase()) || changed;
    });
    return changed;
  }

  function ensureBuyList(){
    let changed = false;
    SIMI_BUY_ITEMS.forEach((row,index) => {
      changed = upsert(STORE_KEYS.buyList, {
        id:seedId("simi-kiefah-buy", index),
        itemName:row.itemName,
        category:row.category,
        priority:row.priority,
        status:row.status,
        quantity:1,
        price:row.price,
        targetDate:"2026-08-21",
        source:row.targetDate,
        note:row.note,
        updatedAt:UPDATED_AT
      }, item => String(item.itemName || "").toLowerCase() === row.itemName.toLowerCase()) || changed;
    });
    return changed;
  }

  function ensureAdminTracker(){
    const checklist = {
      "Enquiry received":true,
      "Client details saved":false,
      "Consultation completed":true,
      "Package confirmed":true,
      "Quote sent":true,
      "Booking confirmed":true,
      "Contract created":false,
      "Contract sent":false,
      "Contract signed":false,
      "Deposit invoice sent":true,
      "Deposit paid":true,
      "Final balance date confirmed":true,
      "Payment notes saved":true,
      "Google Drive folder created":false,
      "Contract saved in client folder":false,
      "Invoice saved in client folder":false,
      "Planning form saved":false,
      "Client references saved":false,
      "Folder checked and organised":false,
      "Planning form sent":false,
      "Planning form completed":false,
      "WhatsApp group created":false,
      "Timeline requested":true,
      "Timeline received":false,
      "Venue details saved":false,
      "Supplier details saved":false,
      "Shot list prepared":true,
      "Gear list prepared":true,
      "Camera batteries charged":false,
      "Audio batteries charged":false,
      "SD cards formatted":false,
      "Travel route checked":false,
      "Parking checked":false,
      "Emergency contact saved":false,
      "Final confirmation message sent":false,
      "Footage backed up":false,
      "Editing folder created":false,
      "Highlight film edited":false,
      "Full film edited":false,
      "Exports checked":false,
      "Delivery link created":false,
      "Final payment received":true,
      "Delivery link sent":false,
      "Client feedback requested":false,
      "Review requested":false,
      "Social media permission confirmed":false,
      "Testimonial saved":false,
      "Client archived":false
    };

    return upsert(STORE_KEYS.admin, {
      id:"seed-simi-kiefah-admin",
      name:CURRENT_PROJECT.name,
      date:CURRENT_PROJECT.eventDate,
      package:"Wedding videography",
      notes:"Paid in full. Focus admin on final logistics: addresses, contacts, timeline, family list, parking, audio and pack checks.",
      archived:false,
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT,
      checklist
    }, row => sameProject(row.name, CURRENT_PROJECT.name));
  }

  function ensureCaptureNote(){
    return upsert(STORE_KEYS.capture, {
      id:"seed-simi-kiefah-capture-brief",
      type:"admin",
      project:CURRENT_PROJECT.name,
      title:"Simi + Kiefah wedding prep brief",
      amount:0,
      note:"Paid in full. Rentals booked at 85. Before 22 August confirm exact venues, parking, timeline, family shot list, supplier contacts, DJ audio plan, storage and battery/cable gaps.",
      status:"open",
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT
    }, row => sameProject(row.project, CURRENT_PROJECT.name) && /prep brief/i.test(row.title || ""));
  }

  function refreshVisiblePages(){
    try{
      if(typeof window.updateDashboardFromLocal === "function") window.updateDashboardFromLocal();
      if(typeof window.renderProjects === "function") window.renderProjects();
      if(typeof window.renderShots === "function") window.renderShots();
      if(typeof window.renderCapture === "function") window.renderCapture();
      if(typeof window.renderCrm === "function") window.renderCrm();
      if(typeof window.renderBookings === "function") window.renderBookings();
      if(typeof window.renderClients === "function") window.renderClients();
      if(typeof window.renderFinance === "function") window.renderFinance();
      if(typeof window.renderConsultations === "function") window.renderConsultations();
      if(typeof window.renderSheets === "function") window.renderSheets();
      if(typeof window.renderTimeline === "function") window.renderTimeline();
      if(typeof window.renderGear === "function") window.renderGear();
      if(typeof window.renderTasks === "function") window.renderTasks();
      if(typeof window.renderBuyList === "function") window.renderBuyList();
      if(typeof window.render === "function" && document.body && /Admin Tracker/i.test(document.body.innerText || "")) window.render();
    }catch(error){
      console.warn("NC seed refresh failed", error);
    }
  }

  function ensureAndRefresh(){
    ensureSimiProject();
    refreshVisiblePages();
  }

  window.NCStudioProjectSeeds = {
    ensureSimiProject,
    ensureCurrentProjects:ensureSimiProject,
    currentProjectName:CURRENT_PROJECT.name,
    currentAliases:CURRENT_PROJECT.aliases,
    completedProjectName:SENSES_PROJECT.name
  };

  ensureSimiProject();
  window.addEventListener("load", function(){
    [700, 3200, 8000].forEach(delay => {
      setTimeout(ensureAndRefresh, delay);
    });
  });
})();
