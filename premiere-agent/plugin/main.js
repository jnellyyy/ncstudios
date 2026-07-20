const { entrypoints, storage } = /** @type {any} */ (require("uxp"));
/** @type {import("@adobe/premierepro").premierepro} */
const ppro = require("premierepro");

const localFileSystem = storage.localFileSystem;
const HELPER_TOKEN_KEY = "nc-edit-agent-helper-folder";
const INSPO_TOKEN_KEY = "nc-edit-agent-inspo-folder";
const INSPO_SOURCE_KEY = "nc-edit-agent-inspo-source";
const STYLE_PROFILE_KEY = "nc-edit-agent-style-profile";
const CODEX_REQUEST_FILE = "codex-request.json";
const CODEX_PLAN_FILE = "codex-plan.json";

let initialized = false;
let busy = false;
let helperFolder = null;
let inspoFolder = null;
let inspoSource = null;
let styleProfile = null;
let timelineSnapshot = null;
let currentPlan = null;

/** @returns {any} */
const byId = (id) => document.getElementById(id);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function setStatus(message) {
  byId("status").textContent = message;
}

function setIndicator(state) {
  const indicator = byId("helper-indicator");
  indicator.className = `indicator${state ? ` ${state}` : ""}`;
}

function updateButtons() {
  byId("connect-helper").disabled = busy;
  byId("use-selected-inspo").disabled = busy;
  byId("choose-inspo").disabled = busy;
  byId("analyse-inspo").disabled = busy || !helperFolder || !inspoSource;
  byId("create-plan").disabled = busy || !helperFolder || !styleProfile;
  byId("export-codex-request").disabled = busy || !helperFolder;
  byId("load-codex-plan").disabled = busy || !helperFolder;
  byId("apply-plan").disabled = busy || !currentPlan || currentPlan.changes.length === 0;
}

async function runBusy(message, task) {
  if (busy) return;
  busy = true;
  setIndicator("busy");
  setStatus(message);
  updateButtons();
  try {
    return await task();
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error && error.message ? error.message : String(error)}`);
    throw error;
  } finally {
    busy = false;
    await refreshHelperStatus();
    updateButtons();
  }
}

async function restoreFolder(tokenKey) {
  const token = localStorage.getItem(tokenKey);
  if (!token) return null;
  try {
    return await localFileSystem.getEntryForPersistentToken(token);
  } catch (error) {
    localStorage.removeItem(tokenKey);
    return null;
  }
}

async function chooseFolder(tokenKey) {
  const folder = await localFileSystem.getFolder();
  if (!folder) return null;
  const token = await localFileSystem.createPersistentToken(folder);
  localStorage.setItem(tokenKey, token);
  return folder;
}

function nativePath(entry) {
  return entry.nativePath || localFileSystem.getNativePath(entry);
}

async function findEntry(folder, name) {
  const entries = await folder.getEntries();
  return entries.find((entry) => entry.name === name) || null;
}

async function refreshHelperStatus() {
  if (!helperFolder) {
    setIndicator("");
    return false;
  }
  try {
    const healthEntry = await findEntry(helperFolder, "health.json");
    if (!healthEntry) {
      setIndicator("");
      return false;
    }
    const health = JSON.parse(await healthEntry.read());
    const age = Date.now() - new Date(health.updatedAt).getTime();
    const online = health.status === "online" && age < 15_000;
    setIndicator(online ? "online" : "");
    return online;
  } catch (error) {
    setIndicator("");
    return false;
  }
}

function makeRequestId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

async function bridgeRequest(type, payload, timeoutMs) {
  if (!helperFolder) throw new Error("Connect the helper runtime folder first.");
  const online = await refreshHelperStatus();
  if (!online) throw new Error("The local helper is not running. Open start-agent.command and keep its window open.");

  const id = makeRequestId();
  const requestName = `request-${id}.json`;
  const responseName = `response-${id}.json`;
  const requestFile = await helperFolder.createFile(requestName, { overwrite: true });
  await requestFile.write(JSON.stringify({
    id,
    type,
    payload,
    createdAt: new Date().toISOString(),
  }));

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const responseFile = await findEntry(helperFolder, responseName);
    if (responseFile) {
      const response = JSON.parse(await responseFile.read());
      if (!response.ok) throw new Error(response.error || "The helper could not complete the request.");
      return response.data;
    }
    await delay(650);
  }
  throw new Error("The helper took too long to respond.");
}

async function writeHelperJsonFile(name, data) {
  if (!helperFolder) throw new Error("Connect the helper runtime folder first.");
  const file = await helperFolder.createFile(name, { overwrite: true });
  await file.write(`${JSON.stringify(data, null, 2)}\n`);
}

async function readHelperJsonFile(name) {
  if (!helperFolder) throw new Error("Connect the helper runtime folder first.");
  const file = await findEntry(helperFolder, name);
  if (!file) throw new Error(`${name} was not found in the connected runtime folder.`);
  return JSON.parse(await file.read());
}

function renderStyleProfile(profile, mode) {
  const container = byId("style-profile");
  container.className = "profile";
  container.innerHTML = "";

  const title = document.createElement("p");
  title.className = "profile-title";
  title.textContent = profile.summary;
  container.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "profile-grid";
  const stats = [
    ["Shot length", `${profile.pacing.averageShotSeconds.toFixed(1)}s`],
    ["Rhythm", profile.pacing.rhythm.replace("_", " ")],
    ["Colour", `${profile.color.temperature} / ${profile.color.contrast}`],
  ];
  stats.forEach(([label, value]) => {
    const stat = document.createElement("div");
    stat.className = "profile-stat";
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    const valueNode = document.createElement("strong");
    valueNode.textContent = value;
    stat.appendChild(labelNode);
    stat.appendChild(valueNode);
    grid.appendChild(stat);
  });
  container.appendChild(grid);

  if (mode === "offline" || mode === "mock") {
    const note = document.createElement("p");
    note.className = "path-label";
    note.textContent = "Offline profile: restart the helper with an API key for visual analysis.";
    container.appendChild(note);
  }
}

async function connectHelper() {
  const folder = await chooseFolder(HELPER_TOKEN_KEY);
  if (!folder) return;
  helperFolder = folder;
  byId("helper-path").textContent = nativePath(folder);
  const online = await refreshHelperStatus();
  setStatus(online ? "Helper connected." : "Folder connected. Start the local helper to continue.");
  updateButtons();
}

async function chooseInspo() {
  const folder = await chooseFolder(INSPO_TOKEN_KEY);
  if (!folder) return;
  inspoFolder = folder;
  inspoSource = {
    type: "folder",
    folderPath: nativePath(folder),
    label: folder.name || nativePath(folder),
  };
  localStorage.setItem(INSPO_SOURCE_KEY, JSON.stringify(inspoSource));
  byId("inspo-path").textContent = `Finder folder: ${inspoSource.label}`;
  setStatus("Inspo folder selected. Ready to analyse.");
  updateButtons();
}

async function collectClipProjectItems(projectItems, limit = 4) {
  const queue = [...projectItems];
  const clips = [];
  const visited = new Set();
  while (queue.length > 0 && clips.length < limit) {
    const item = queue.shift();
    if (!item) continue;
    const itemKey = String(item.guid || item.name || queue.length);
    if (visited.has(itemKey)) continue;
    visited.add(itemKey);

    let clipItem = null;
    try {
      clipItem = ppro.ClipProjectItem.cast(item);
    } catch (error) {
      clipItem = null;
    }
    if (clipItem) {
      clips.push(clipItem);
      continue;
    }

    let folderItem = null;
    try {
      folderItem = ppro.FolderItem.cast(item);
    } catch (error) {
      folderItem = null;
    }
    if (folderItem) {
      const children = await folderItem.getItems();
      queue.push(...children);
    }
  }
  return clips;
}

async function getTimelineSelectedProjectItems(project) {
  const sequence = await project.getActiveSequence();
  if (!sequence) return [];
  const timelineSelection = await sequence.getSelection();
  const trackItems = await timelineSelection.getTrackItems();
  const projectItems = [];
  for (const trackItem of trackItems) {
    const projectItem = await trackItem.getProjectItem();
    if (projectItem) projectItems.push(projectItem);
  }
  return projectItems;
}

async function useSelectedPremiereInspo() {
  await runBusy("Reading selected Inspo clips from Premiere…", async () => {
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Open a Premiere project first.");
    const selection = await ppro.ProjectUtils.getSelection(project);
    let items = await selection.getItems();
    if (!items || items.length === 0) items = await getTimelineSelectedProjectItems(project);
    if (!items || items.length === 0) {
      throw new Error("Select the Inspo video, its bin, or its clip on the timeline first.");
    }

    const clipItems = await collectClipProjectItems(items, 4);
    console.log(`[NC Edit Agent] Found ${clipItems.length} clip candidate(s) from ${items.length} selected item(s).`);

    const filePaths = [];
    const names = [];
    for (const clipItem of clipItems) {
      if (await clipItem.isSequence()) continue;
      if (await clipItem.isOffline()) continue;
      let mediaPath = await clipItem.getMediaFilePath();
      if (!mediaPath && await clipItem.hasProxy()) mediaPath = await clipItem.getProxyPath();
      if (!mediaPath) continue;
      if (!filePaths.includes(mediaPath)) {
        filePaths.push(mediaPath);
        names.push(clipItem.name || "Inspo clip");
      }
    }
    if (filePaths.length === 0) {
      throw new Error("Premiere found the selection, but it has no online source or proxy file to analyse.");
    }

    inspoSource = {
      type: "premiere_clips",
      filePaths,
      label: names.join(", "),
    };
    localStorage.setItem(INSPO_SOURCE_KEY, JSON.stringify(inspoSource));
    byId("inspo-path").textContent = `Premiere: ${inspoSource.label}`;
    setStatus(`${filePaths.length} Premiere Inspo clip(s) ready. Now click Analyse selected source.`);
  });
}

async function analyseInspo() {
  await runBusy("Analysing reference videos and building your style profile…", async () => {
    const payload = inspoSource.type === "premiere_clips"
      ? { filePaths: inspoSource.filePaths }
      : { folderPath: inspoSource.folderPath };
    const result = await bridgeRequest("analyze_inspo", payload, 12 * 60 * 1000);
    styleProfile = result.profile;
    localStorage.setItem(STYLE_PROFILE_KEY, JSON.stringify(styleProfile));
    renderStyleProfile(styleProfile, result.analysisMode);
    setStatus(`Style profile ready${result.model ? ` · ${result.model}` : ""}.`);
  });
}

async function getTimeSeconds(item, methodName) {
  const value = await item[methodName]();
  return Number(value.seconds);
}

function makeClipId(kind, trackIndex, itemIndex, startSeconds, name) {
  return `${kind}:${trackIndex}:${itemIndex}:${startSeconds.toFixed(3)}:${name}`;
}

async function readTrack(sequence, kind, trackIndex, includeReferences) {
  const track = kind === "video"
    ? await sequence.getVideoTrack(trackIndex)
    : await sequence.getAudioTrack(trackIndex);
  const items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
  const clips = [];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const name = await item.getName();
    const startSeconds = await getTimeSeconds(item, "getStartTime");
    const endSeconds = await getTimeSeconds(item, "getEndTime");
    const inPointSeconds = await getTimeSeconds(item, "getInPoint");
    const outPointSeconds = await getTimeSeconds(item, "getOutPoint");
    const clip = {
      id: makeClipId(kind, trackIndex, itemIndex, startSeconds, name),
      kind,
      trackIndex,
      itemIndex,
      name,
      startSeconds,
      endSeconds,
      durationSeconds: endSeconds - startSeconds,
      inPointSeconds,
      outPointSeconds,
      speed: Number(await item.getSpeed()),
      selected: Boolean(await item.getIsSelected()),
      disabled: Boolean(await item.isDisabled()),
    };
    if (kind === "video") clip.adjustmentLayer = Boolean(await item.isAdjustmentLayer());
    if (includeReferences) clip.reference = item;
    clips.push(clip);
  }
  return {
    index: trackIndex,
    name: track.name,
    muted: Boolean(await track.isMuted()),
    clips,
  };
}

async function readTimeline(sequence, includeReferences) {
  const videoTracks = [];
  const audioTracks = [];
  const videoTrackCount = Number(await sequence.getVideoTrackCount());
  const audioTrackCount = Number(await sequence.getAudioTrackCount());
  for (let index = 0; index < videoTrackCount; index += 1) {
    videoTracks.push(await readTrack(sequence, "video", index, includeReferences));
  }
  for (let index = 0; index < audioTrackCount; index += 1) {
    audioTracks.push(await readTrack(sequence, "audio", index, includeReferences));
  }
  const endTime = await sequence.getEndTime();
  const frameSize = await sequence.getFrameSize();
  return {
    sequenceGuid: String(sequence.guid),
    sequenceName: sequence.name,
    durationSeconds: Number(endTime.seconds),
    frameSize: { width: Number(frameSize.width || 0), height: Number(frameSize.height || 0) },
    timebase: String(await sequence.getTimebase()),
    videoTracks,
    audioTracks,
  };
}

function stripReferences(snapshot) {
  return {
    ...snapshot,
    videoTracks: snapshot.videoTracks.map((track) => ({
      ...track,
      clips: track.clips.map(({ reference, ...clip }) => clip),
    })),
    audioTracks: snapshot.audioTracks.map((track) => ({
      ...track,
      clips: track.clips.map(({ reference, ...clip }) => clip),
    })),
  };
}

function allClips(snapshot) {
  return [...snapshot.videoTracks, ...snapshot.audioTracks].flatMap((track) => track.clips);
}

async function createPlan() {
  const instruction = byId("edit-request").value.trim();
  if (!instruction) throw new Error("Describe what you want changed first.");
  await runBusy("Reading the active timeline and planning the edit…", async () => {
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Open a Premiere project first.");
    const sequence = await project.getActiveSequence();
    if (!sequence) throw new Error("Open a sequence in the Timeline first.");
    timelineSnapshot = await readTimeline(sequence, false);
    const result = await bridgeRequest("plan_timeline", {
      instruction,
      styleProfile,
      timeline: stripReferences(timelineSnapshot),
    }, 5 * 60 * 1000);
    currentPlan = result.plan;
    renderPlan(currentPlan);
    setStatus(`Edit plan ready${result.model ? ` · ${result.model}` : ""}. Review before applying.`);
  });
}

async function exportCodexRequest() {
  const instruction = byId("edit-request").value.trim();
  if (!instruction) throw new Error("Describe what you want changed first.");

  await runBusy("Exporting this timeline request for Codex…", async () => {
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Open a Premiere project first.");
    const sequence = await project.getActiveSequence();
    if (!sequence) throw new Error("Open a sequence in the Timeline first.");

    timelineSnapshot = await readTimeline(sequence, false);
    const requestId = makeRequestId();
    const codexRequest = {
      id: requestId,
      createdAt: new Date().toISOString(),
      outputFile: CODEX_PLAN_FILE,
      instruction,
      styleProfile,
      timeline: stripReferences(timelineSnapshot),
      instructionsForCodex: [
        `Read this ${CODEX_REQUEST_FILE} file and create ${CODEX_PLAN_FILE} in the same folder.`,
        "Return a conservative Premiere edit plan using only the supplied clipId values.",
        "Supported change types are trim_clip, remove_clip, move_clip, set_clip_disabled, and rename_clip.",
        "Keep dialogue/music sync in mind: mirror changes across matching audio/video clips when they clearly share timing and name.",
        "Never reduce a clip below 0.25 seconds, create negative start times, or propose overlapping moves.",
        "Use this JSON shape: { sourceRequestId, sequenceGuid, title, summary, confidence, warnings, changes }.",
      ],
      planShape: {
        sourceRequestId: requestId,
        sequenceGuid: timelineSnapshot.sequenceGuid,
        title: "Short plan title",
        summary: "What the plan is doing",
        confidence: 0.0,
        warnings: ["Optional safety notes"],
        changes: [
          {
            type: "trim_clip",
            clipId: "Use an exact clip id from the timeline",
            reason: "Why this is safe/useful",
            trimStartSeconds: 0,
            trimEndSeconds: 0,
          },
        ],
      },
    };

    await writeHelperJsonFile(CODEX_REQUEST_FILE, codexRequest);
    setStatus(`Saved ${CODEX_REQUEST_FILE}. Ask Codex to make ${CODEX_PLAN_FILE}, then click Load Codex plan.`);
  });
}

function boundedNumber(value, min, max, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`Codex plan has an invalid ${fieldName}.`);
  }
  return number;
}

function requiredText(value, fieldName, maxLength) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Codex plan is missing ${fieldName}.`);
  }
  return value.trim().slice(0, maxLength);
}

function requiredBoolean(value, fieldName) {
  if (typeof value !== "boolean") throw new Error(`Codex plan has an invalid ${fieldName}.`);
  return value;
}

function normalizeCodexChange(change) {
  if (!change || typeof change !== "object") throw new Error("Codex plan contains an invalid change.");
  const base = {
    type: requiredText(change.type, "change.type", 80),
    clipId: requiredText(change.clipId, "change.clipId", 500),
    reason: requiredText(change.reason, "change.reason", 300),
  };

  if (base.type === "trim_clip") {
    return {
      ...base,
      trimStartSeconds: boundedNumber(change.trimStartSeconds, 0, 30, "trimStartSeconds"),
      trimEndSeconds: boundedNumber(change.trimEndSeconds, 0, 30, "trimEndSeconds"),
    };
  }
  if (base.type === "remove_clip") {
    return { ...base, rippleDelete: requiredBoolean(change.rippleDelete, "rippleDelete") };
  }
  if (base.type === "move_clip") {
    return { ...base, deltaSeconds: boundedNumber(change.deltaSeconds, -30, 30, "deltaSeconds") };
  }
  if (base.type === "set_clip_disabled") {
    return { ...base, disabled: requiredBoolean(change.disabled, "disabled") };
  }
  if (base.type === "rename_clip") {
    return { ...base, name: requiredText(change.name, "change.name", 80) };
  }

  throw new Error(`Codex plan uses unsupported change type: ${base.type}`);
}

function normalizeCodexPlan(raw) {
  const source = raw && raw.plan && typeof raw.plan === "object" ? raw.plan : raw;
  if (!source || typeof source !== "object") throw new Error("Codex plan file is not a valid JSON object.");
  const changes = Array.isArray(source.changes) ? source.changes.map(normalizeCodexChange) : [];
  return {
    sourceRequestId: typeof source.sourceRequestId === "string" ? source.sourceRequestId : "",
    sequenceGuid: typeof source.sequenceGuid === "string" ? source.sequenceGuid : "",
    title: typeof source.title === "string" && source.title.trim() ? source.title.trim().slice(0, 100) : "Codex edit plan",
    summary: typeof source.summary === "string" && source.summary.trim()
      ? source.summary.trim().slice(0, 700)
      : "Codex plan loaded from the local no-API file.",
    confidence: Number.isFinite(Number(source.confidence)) ? Math.max(0, Math.min(1, Number(source.confidence))) : 0.5,
    warnings: Array.isArray(source.warnings) ? source.warnings.map((item) => String(item).slice(0, 240)).slice(0, 12) : [],
    changes,
  };
}

async function loadCodexPlan() {
  await runBusy("Loading Codex plan from the local runtime folder…", async () => {
    const raw = await readHelperJsonFile(CODEX_PLAN_FILE);
    const plan = normalizeCodexPlan(raw);

    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Open a Premiere project first.");
    const sequence = await project.getActiveSequence();
    if (!sequence) throw new Error("Open the matching sequence in the Timeline first.");
    timelineSnapshot = await readTimeline(sequence, false);

    if (plan.sequenceGuid && plan.sequenceGuid !== timelineSnapshot.sequenceGuid) {
      throw new Error("That Codex plan was made for a different sequence. Open the matching sequence or export a fresh request.");
    }

    currentPlan = plan;
    renderPlan(currentPlan);
    setStatus(`Loaded ${currentPlan.changes.length} Codex change(s). Review before applying.`);
  });
}

function changeLabel(change, clipName) {
  const target = clipName || "clip";
  if (change.type === "trim_clip") {
    return `Trim ${target} · ${change.trimStartSeconds.toFixed(2)}s head / ${change.trimEndSeconds.toFixed(2)}s tail`;
  }
  if (change.type === "remove_clip") return `${change.rippleDelete ? "Ripple-remove" : "Remove"} ${target}`;
  if (change.type === "move_clip") return `Move ${target} · ${change.deltaSeconds > 0 ? "+" : ""}${change.deltaSeconds.toFixed(2)}s`;
  if (change.type === "set_clip_disabled") return `${change.disabled ? "Disable" : "Enable"} ${target}`;
  if (change.type === "rename_clip") return `Rename ${target} → ${change.name}`;
  return `Edit ${target}`;
}

function renderPlan(plan) {
  byId("plan-card").classList.remove("hidden");
  byId("plan-summary").textContent = plan.summary;
  const warnings = byId("plan-warnings");
  warnings.innerHTML = "";
  if (plan.warnings.length > 0) {
    warnings.classList.remove("hidden");
    plan.warnings.forEach((warning) => {
      const line = document.createElement("div");
      line.textContent = warning;
      warnings.appendChild(line);
    });
  } else {
    warnings.classList.add("hidden");
  }

  const clipMap = new Map(allClips(timelineSnapshot).map((clip) => [clip.id, clip.name]));
  const changes = byId("plan-changes");
  changes.innerHTML = "";
  plan.changes.forEach((change, index) => {
    const row = document.createElement("label");
    row.className = "change";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = true;
    toggle.className = "plan-toggle";
    toggle.dataset.index = String(index);
    const copy = document.createElement("div");
    const title = document.createElement("p");
    title.className = "change-title";
    title.textContent = changeLabel(change, clipMap.get(change.clipId));
    const reason = document.createElement("p");
    reason.className = "change-reason";
    reason.textContent = change.reason;
    copy.appendChild(title);
    copy.appendChild(reason);
    row.appendChild(toggle);
    row.appendChild(copy);
    changes.appendChild(row);
  });
  if (plan.changes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "path-label";
    empty.textContent = "No safe automatic changes were proposed.";
    changes.appendChild(empty);
  }
  updateButtons();
}

async function cloneSequence(project, sequence) {
  const before = await project.getSequences();
  const beforeGuids = new Set(before.map((item) => String(item.guid)));
  let success = false;
  project.lockedAccess(() => {
    success = project.executeTransaction((compoundAction) => {
      compoundAction.addAction(sequence.createCloneAction());
    }, "NC Edit Agent: create protected sequence copy");
  });
  if (!success) throw new Error("Premiere could not clone the active sequence.");

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const sequences = await project.getSequences();
    const clone = sequences.find((item) => !beforeGuids.has(String(item.guid)));
    if (clone) {
      await project.setActiveSequence(clone);
      return clone;
    }
    await delay(200);
  }
  throw new Error("The protected sequence copy was created but could not be opened automatically.");
}

function validateChanges(changes, snapshot) {
  const clipMap = new Map(allClips(snapshot).map((clip) => [clip.id, clip]));
  let accepted = [];
  const rejected = [];
  const seen = new Set();
  const removedIds = new Set(changes.filter((change) => change.type === "remove_clip").map((change) => change.clipId));
  const removeModes = new Set(changes.filter((change) => change.type === "remove_clip").map((change) => change.rippleDelete));

  changes.forEach((change) => {
    const clip = clipMap.get(change.clipId);
    const key = `${change.type}:${change.clipId}`;
    let reason = "";
    if (!clip) reason = "Clip no longer matches the active copy.";
    else if (seen.has(key)) reason = "Duplicate operation.";
    else if (removedIds.has(change.clipId) && change.type !== "remove_clip") reason = "Clip is already scheduled for removal.";
    else if (change.type === "trim_clip" && clip.durationSeconds - change.trimStartSeconds - change.trimEndSeconds < 0.25) reason = "Trim would leave less than 0.25 seconds.";
    else if (change.type === "move_clip" && clip.startSeconds + change.deltaSeconds < 0) reason = "Move would place the clip before sequence start.";
    else if (change.type === "remove_clip" && removeModes.size > 1) reason = "Mixed ripple and non-ripple removal is not supported in one pass.";

    if (reason) rejected.push({ change, reason });
    else {
      seen.add(key);
      accepted.push({ change, clip });
    }
  });

  const operationsByClip = new Map();
  accepted.forEach(({ change }) => {
    if (!operationsByClip.has(change.clipId)) operationsByClip.set(change.clipId, []);
    operationsByClip.get(change.clipId).push(change);
  });
  const invalidMoves = new Set();
  [...snapshot.videoTracks, ...snapshot.audioTracks].forEach((track) => {
    const projected = track.clips
      .filter((clip) => !removedIds.has(clip.id))
      .map((clip) => {
        let start = clip.startSeconds;
        let end = clip.endSeconds;
        const operations = operationsByClip.get(clip.id) || [];
        operations.forEach((operation) => {
          if (operation.type === "trim_clip") {
            start += operation.trimStartSeconds;
            end -= operation.trimEndSeconds;
          } else if (operation.type === "move_clip") {
            start += operation.deltaSeconds;
            end += operation.deltaSeconds;
          }
        });
        return { clip, start, end, moved: operations.some((operation) => operation.type === "move_clip") };
      })
      .sort((a, b) => a.start - b.start);
    for (let index = 1; index < projected.length; index += 1) {
      const previous = projected[index - 1];
      const current = projected[index];
      if (current.start < previous.end - 0.02) {
        if (previous.moved) invalidMoves.add(previous.clip.id);
        if (current.moved) invalidMoves.add(current.clip.id);
      }
    }
  });
  if (invalidMoves.size > 0) {
    accepted = accepted.filter((item) => {
      const invalid = item.change.type === "move_clip" && invalidMoves.has(item.change.clipId);
      if (invalid) rejected.push({ change: item.change, reason: "Move would overlap another clip on the same track." });
      return !invalid;
    });
  }
  return { accepted, rejected };
}

async function applyCheckedPlan() {
  const checkedIndexes = [...document.querySelectorAll(".plan-toggle:checked")]
    .map((toggle) => Number((/** @type {HTMLInputElement} */ (toggle)).dataset.index));
  const chosenChanges = checkedIndexes.map((index) => currentPlan.changes[index]).filter(Boolean);
  if (chosenChanges.length === 0) throw new Error("Select at least one proposed change.");

  await runBusy("Cloning the sequence and applying approved changes…", async () => {
    const project = await ppro.Project.getActiveProject();
    const sequence = await project.getActiveSequence();
    if (!sequence || String(sequence.guid) !== timelineSnapshot.sequenceGuid) {
      throw new Error("The active sequence changed after the plan was created. Create a fresh plan first.");
    }

    const clone = await cloneSequence(project, sequence);
    const cloneSnapshot = await readTimeline(clone, true);
    const validation = validateChanges(chosenChanges, cloneSnapshot);
    if (validation.accepted.length === 0) {
      throw new Error(`No changes passed validation. ${validation.rejected.map((item) => item.reason).join(" ")}`);
    }

    const removals = validation.accepted.filter((item) => item.change.type === "remove_clip");
    let removalSelection = null;
    if (removals.length > 0) {
      await clone.clearSelection();
      removalSelection = await clone.getSelection();
      removals.forEach(({ clip }) => removalSelection.addItem(clip.reference, false));
      await clone.setSelection(removalSelection);
    }

    let success = false;
    project.lockedAccess(() => {
      success = project.executeTransaction((compoundAction) => {
        validation.accepted.forEach(({ change, clip }) => {
          if (change.type === "trim_clip") {
            if (change.trimStartSeconds > 0) {
              compoundAction.addAction(clip.reference.createSetStartAction(
                ppro.TickTime.createWithSeconds(clip.startSeconds + change.trimStartSeconds)
              ));
            }
            if (change.trimEndSeconds > 0) {
              compoundAction.addAction(clip.reference.createSetEndAction(
                ppro.TickTime.createWithSeconds(clip.endSeconds - change.trimEndSeconds)
              ));
            }
          } else if (change.type === "move_clip") {
            compoundAction.addAction(clip.reference.createMoveAction(
              ppro.TickTime.createWithSeconds(change.deltaSeconds)
            ));
          } else if (change.type === "set_clip_disabled") {
            compoundAction.addAction(clip.reference.createSetDisabledAction(change.disabled));
          } else if (change.type === "rename_clip") {
            compoundAction.addAction(clip.reference.createSetNameAction(change.name));
          }
        });

        if (removalSelection) {
          const editor = ppro.SequenceEditor.getEditor(clone);
          compoundAction.addAction(editor.createRemoveItemsAction(
            removalSelection,
            removals[0].change.rippleDelete,
            ppro.Constants.MediaType.VIDEO
          ));
        }
      }, `NC Edit Agent: ${currentPlan.title}`);
    });

    if (!success) throw new Error("Premiere rejected the edit transaction.");
    const rejectionNote = validation.rejected.length > 0
      ? ` ${validation.rejected.length} unsafe change(s) were skipped.`
      : "";
    setStatus(`Applied ${validation.accepted.length} change(s) to the cloned sequence.${rejectionNote}`);
    currentPlan = null;
    byId("apply-plan").disabled = true;
  });
}

async function initialize() {
  if (initialized) return;
  initialized = true;

  byId("connect-helper").addEventListener("click", () => connectHelper().catch(() => {}));
  byId("use-selected-inspo").addEventListener("click", () => useSelectedPremiereInspo().catch(() => {}));
  byId("choose-inspo").addEventListener("click", () => chooseInspo().catch(() => {}));
  byId("analyse-inspo").addEventListener("click", () => analyseInspo().catch(() => {}));
  byId("create-plan").addEventListener("click", () => createPlan().catch(() => {}));
  byId("export-codex-request").addEventListener("click", () => exportCodexRequest().catch(() => {}));
  byId("load-codex-plan").addEventListener("click", () => loadCodexPlan().catch(() => {}));
  byId("apply-plan").addEventListener("click", () => applyCheckedPlan().catch(() => {}));

  helperFolder = await restoreFolder(HELPER_TOKEN_KEY);
  inspoFolder = await restoreFolder(INSPO_TOKEN_KEY);
  if (helperFolder) byId("helper-path").textContent = nativePath(helperFolder);
  const storedSource = localStorage.getItem(INSPO_SOURCE_KEY);
  if (storedSource) {
    try {
      inspoSource = JSON.parse(storedSource);
      byId("inspo-path").textContent = inspoSource.type === "premiere_clips"
        ? `Premiere: ${inspoSource.label}`
        : `Finder folder: ${inspoSource.label}`;
    } catch (error) {
      localStorage.removeItem(INSPO_SOURCE_KEY);
    }
  } else if (inspoFolder) {
    inspoSource = {
      type: "folder",
      folderPath: nativePath(inspoFolder),
      label: inspoFolder.name || nativePath(inspoFolder),
    };
    byId("inspo-path").textContent = `Finder folder: ${inspoSource.label}`;
  }

  const storedProfile = localStorage.getItem(STYLE_PROFILE_KEY);
  if (storedProfile) {
    try {
      styleProfile = JSON.parse(storedProfile);
      renderStyleProfile(styleProfile, "stored");
    } catch (error) {
      localStorage.removeItem(STYLE_PROFILE_KEY);
    }
  }

  const online = await refreshHelperStatus();
  setStatus(online ? "Helper connected. Ready." : "Start the helper, then connect its runtime folder.");
  updateButtons();
}

entrypoints.setup({
  panels: {
    "nc-edit-agent-panel": {
      show() {
        return initialize();
      },
    },
  },
});
