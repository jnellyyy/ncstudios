(function(){
  "use strict";

  const PROJECT_NAME = "Senses: The Day Party";
  const PROJECT_KEY = normaliseProjectKey(PROJECT_NAME);
  const UPDATED_AT = "2026-07-24T00:00:00.000Z";
  const REMOVED_KEY = "ncstudios_seed_senses_day_party_removed_v1";
  const SOURCE_REELS = [
    "https://www.instagram.com/reel/DZflTzUpcvp/",
    "https://www.instagram.com/reel/DZIdA6AAcOV/"
  ];

  const STORE_KEYS = {
    projectStages:"ncstudios_project_status_v1",
    shots:"ncstudios_shots_v1",
    capture:"ncstudios_capture_v1"
  };

  const SHOTS = [
    shot("details","Venue entrance","outside sign / queue energy","24mm","25fps","slow push in","wide establishing","Hero","essential","start with the event name, door, queue, wristbands or signage","Portfolio opener. Make the viewer know where they are within 2 seconds."),
    shot("details","Branding details","Senses branding, flyers, wristbands, stamp, signage","35mm","50fps","slow handheld slide","close detail","Detail","essential","sensory detail montage with clean cuts","Use as rhythm inserts between people shots."),
    shot("details","Drinks and hands","bar, cups, pouring, cheers, wristbands","50mm","50fps","small push or tilt","tight close ups","Detail","high","hands and drink texture, not generic bar filler","Good for beat-matched transitions."),
    shot("details","DJ setup texture","decks, laptop, cables, mixer lights","50mm","50fps","slow detail pass","close detail","Detail","essential","music gear as atmosphere","Avoid messy background if possible."),
    shot("details","Speaker / light texture","lights, haze, shadows, reflections","35mm","50fps","hold then drift","abstract close to medium","Atmosphere","high","moody visual texture for reel pacing","Grab these whenever the room light changes."),

    shot("reception","Guests arriving","doorway hugs, greetings, first smiles","35mm","50fps","handheld follow","medium","Coverage","essential","warm arrival moments","Portfolio needs human welcome, not just party chaos."),
    shot("reception","Outfit walk-ins","strong fits entering or walking past camera","35mm","50fps","low-to-mid tracking","full body to medium","Movement","essential","fashion-event style walk-by","Keep background clean; this can be a reel hook."),
    shot("reception","Group hugs and greetings","friends greeting, handshakes, laughter","50mm","50fps","hold and reframe","medium close","Reaction","high","natural connection moments","Let moments breathe for 2-3 seconds."),
    shot("reception","Room wide energy","whole space before peak party","24mm","25fps","slow pan or locked hold","wide","Atmosphere","essential","establish scale and crowd","Shoot vertical and horizontal if possible."),
    shot("reception","Host / organiser presence","host greeting people or moving through room","35mm","50fps","follow from side","medium","Coverage","high","show the people behind the event","Useful for portfolio and relationship-building."),

    shot("dancing","DJ hero shot","DJ performing with crowd behind or lights around","35mm","50fps","slow push in","medium hero","Hero","essential","music source plus room reaction","Get one clean DJ hero before the floor gets too packed."),
    shot("dancing","Crowd hands up","hands, claps, phones, movement on beat","24mm","50fps","inside the crowd","wide to mid","Movement","essential","immersive party energy","Get close; make it feel like you are in the room."),
    shot("dancing","Main dance pocket","best dancers in the crowd","35mm","50fps","orbit or side track","medium","Movement","essential","social reel energy, faces and movement","Prioritise confident guests who look happy on camera."),
    shot("dancing","One hero dancer","single person with strong movement or outfit","50mm","50fps","hold and reframe","medium close","Hero","essential","portfolio hero moment","This can become the thumbnail frame."),
    shot("dancing","Laugh reaction","faces laughing, shouting lyrics, reacting to song drop","70mm","50fps","hold steady","close","Reaction","essential","joy shot for emotional punctuation","End sections with this kind of face."),
    shot("dancing","Couple / pair dancing","two friends dancing together","35mm","50fps","move with them","medium close","Movement","high","connection inside the party","Avoid shots that feel too intrusive."),
    shot("dancing","Phone-light / phone-recording moment","phones up, screens, flash, filming each other","50mm","50fps","slow push","close to medium","Atmosphere","medium","modern party texture","Good for transitions and social proof."),
    shot("dancing","Low angle movement","feet, trainers, floor, shadows","24mm","50fps","low glide","low close","Creative","high","kinetic cutaway for beat changes","Use only if safe and not in anyone's way."),
    shot("dancing","Over-shoulder crowd view","from behind guest into the room","35mm","50fps","small push forward","over shoulder","Creative","high","viewer feels inside the event","Great for the Instagram-reel feel."),
    shot("dancing","Beat-drop reaction","song drop, hands jump, cheers","24mm","50fps","push into action","wide to medium","Hero","essential","peak-energy moment","Stay ready near the DJ during big drops."),

    shot("portraits","Best outfit portraits","2-3 clean portraits of stylish guests","50mm","50fps","small handheld sway","medium close","Hero","high","portfolio-friendly style portraits","Ask quickly if needed; keep it casual."),
    shot("portraits","Friend group portrait","tight group smiling or posing","35mm","50fps","gentle push in","medium group","Coverage","high","social proof and community","Get at least one polished group shot."),
    shot("portraits","Candid profile / silhouette","side profile in light, drink or laugh","70mm","50fps","hold steady","close","Creative","medium","editorial cutaway","Useful for slower sections."),
    shot("portraits","Host portrait","clean portrait of host / organiser","50mm","50fps","hold","medium close","Hero","essential","portfolio and client relationship asset","Get this early before everyone is too busy."),

    shot("reception","Table / booth texture","hands on table, tickets, phones, details","50mm","50fps","slow slide","close","Detail","medium","small details that make the event feel premium","Avoid dead empty-table shots."),
    shot("reception","Conversations","people talking, leaning in, reactions","70mm","50fps","hold from distance","close","Reaction","high","natural social texture","Use longer lens so it feels candid."),
    shot("reception","Toast / cheers","glasses up, cheers, smiles","35mm","50fps","move into group","medium close","Hero","high","celebration beat","Ask once if needed, then keep it natural."),
    shot("reception","Venue staff / service movement","bar serving, food passing, queue movement","35mm","50fps","tracking pass","medium","Coverage","medium","event operations texture","Only include if it looks polished."),
    shot("reception","Light passing across faces","faces in nice light or colour shifts","50mm","50fps","hold","close","Creative","high","cinematic texture","Hunt these when the lighting is good."),

    shot("dancing","360 crowd texture","small orbit around group dancing","24mm","50fps","controlled orbit","wide to mid","Creative","high","dynamic reel moment","Keep it smooth; do not overuse."),
    shot("dancing","Whip / body transition shot","person crosses frame, arm passes lens, dark-to-light move","35mm","50fps","intentional pass-by","frame wipe","Creative","medium","transition material","Use for edits inspired by quick Instagram pacing."),
    shot("dancing","Foreground blur layer","shoot through shoulder, glass, hand, light","50mm","50fps","small reframe","layered close","Creative","medium","premium depth and motion","Helps footage feel less flat."),
    shot("dancing","Slow-motion smiles","one clean smile/laugh in party light","70mm","50fps","hold steady","close","Reaction","essential","emotional anchor shot","Protect focus; this is a portfolio keeper."),
    shot("dancing","Wide final energy","full room near peak moment","24mm","25fps","locked or very slow push","wide","Hero","essential","closing scale shot","Get a clean wide before leaving."),
    shot("details","Exit / final atmosphere","outside night, last hugs, venue sign, empty cups","35mm","25fps","slow hold","wide to close","Atmosphere","medium","ending texture","Optional, but useful if the event story needs a close.")
  ];

  function shot(section, location, shotText, lens, fps, movement, framing, shotType, priority, creativeExample, notes){
    return {section, location, shotText, lens, fps, movement, framing, shotType, priority, creativeExample, notes};
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

  function makeId(prefix,index){
    return `seed-senses-day-party-${prefix}${index !== undefined ? "-" + String(index + 1).padStart(2,"0") : ""}`;
  }

  function normaliseProjectKey(value){
    return String(value || "")
      .toLowerCase()
      .replace(/&|\+/g," and ")
      .replace(/[^a-z0-9]+/g," ")
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  }

  function buildLensFps(lens,fps){
    return [lens, fps].filter(Boolean).join(" + ");
  }

  function hasProjectItem(items){
    return items.some(item => normaliseProjectKey(item.project || item.projectName || item.client || item.captureProject) === PROJECT_KEY);
  }

  function ensureStage(){
    const stages = readArray(STORE_KEYS.projectStages);
    const existingIndex = stages.findIndex(item => item.id === makeId("stage") || normaliseProjectKey(item.project || item.key) === PROJECT_KEY);
    const stage = {
      id:existingIndex >= 0 ? stages[existingIndex].id : makeId("stage"),
      key:PROJECT_KEY,
      project:PROJECT_NAME,
      stage:"live",
      notes:"Portfolio day-party coverage. Keep this live while actively shooting the event.",
      updatedAt:UPDATED_AT
    };

    if(existingIndex >= 0){
      const existing = stages[existingIndex];
      if(existing.stage === "live" && existing.project === PROJECT_NAME) return false;
      stages[existingIndex] = {...existing,...stage};
    }else{
      stages.unshift(stage);
    }

    writeArray(STORE_KEYS.projectStages, stages);
    return true;
  }

  function ensureShots(){
    const shots = readArray(STORE_KEYS.shots);
    let changed = false;

    SHOTS.forEach((row,index) => {
      const id = makeId("shot", index);
      const exists = shots.some(item => item.id === id || (
        normaliseProjectKey(item.project) === PROJECT_KEY &&
        String(item.shotText || "").trim().toLowerCase() === row.shotText.toLowerCase()
      ));

      if(exists) return;

      shots.push({
        id,
        project:PROJECT_NAME,
        section:row.section,
        camera:"A Camera",
        shotType:row.shotType,
        priority:row.priority,
        location:row.location,
        shotText:row.shotText,
        lens:row.lens,
        fps:row.fps,
        lensFps:buildLensFps(row.lens,row.fps),
        movement:row.movement,
        framing:row.framing,
        creativeExample:row.creativeExample,
        notes:row.notes,
        captured:false,
        updatedAt:UPDATED_AT
      });
      changed = true;
    });

    if(changed) writeArray(STORE_KEYS.shots, shots);
    return changed;
  }

  function ensureCaptureNote(){
    const captures = readArray(STORE_KEYS.capture);
    const id = makeId("capture-brief");
    const exists = captures.some(item => item.id === id || (
      normaliseProjectKey(item.project) === PROJECT_KEY &&
      String(item.title || "").toLowerCase().includes("portfolio brief")
    ));

    if(exists) return false;

    captures.unshift({
      id,
      type:"shot",
      project:PROJECT_NAME,
      title:"Portfolio brief and reel inspiration",
      amount:0,
      note:[
        "Cover this as a portfolio day-party event: sensory details, stylish guests, DJ, room energy, close reactions, movement, transitions and clean hero shots.",
        "Reference links:",
        SOURCE_REELS.join("\n")
      ].join("\n"),
      status:"open",
      createdAt:UPDATED_AT,
      updatedAt:UPDATED_AT
    });

    writeArray(STORE_KEYS.capture, captures);
    return true;
  }

  function refreshVisiblePages(){
    try{
      if(typeof window.updateDashboardFromLocal === "function") window.updateDashboardFromLocal();
      if(typeof window.renderProjects === "function") window.renderProjects();
      if(typeof window.renderShots === "function") window.renderShots();
      if(typeof window.renderCapture === "function") window.renderCapture();
    }catch(error){
      console.warn("NC seed refresh failed", error);
    }
  }

  function ensureSensesProject(){
    if(localStorage.getItem(REMOVED_KEY) === "yes") return false;

    const before = [
      hasProjectItem(readArray(STORE_KEYS.projectStages)),
      hasProjectItem(readArray(STORE_KEYS.shots)),
      hasProjectItem(readArray(STORE_KEYS.capture))
    ].some(Boolean);

    const changed = [ensureStage(), ensureShots(), ensureCaptureNote()].some(Boolean);
    const after = [
      hasProjectItem(readArray(STORE_KEYS.projectStages)),
      hasProjectItem(readArray(STORE_KEYS.shots)),
      hasProjectItem(readArray(STORE_KEYS.capture))
    ].some(Boolean);

    if(changed || (!before && after)){
      refreshVisiblePages();
      if(window.NCSync && typeof window.NCSync.flushPendingSaves === "function"){
        setTimeout(() => window.NCSync.flushPendingSaves(), 900);
      }
    }

    return changed;
  }

  window.NCStudioProjectSeeds = {
    ensureSensesProject,
    projectName:PROJECT_NAME,
    sourceReels:SOURCE_REELS
  };

  function ensureAndRefresh(){
    ensureSensesProject();
    refreshVisiblePages();
  }

  ensureSensesProject();
  window.addEventListener("load", function(){
    [700, 3200, 8000].forEach(delay => {
      setTimeout(ensureAndRefresh, delay);
    });
  });
})();
