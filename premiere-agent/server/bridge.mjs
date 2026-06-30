import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeInspo, agentInfo, planTimeline } from "./agent.mjs";

const REQUEST_PATTERN = /^request-([a-zA-Z0-9_-]+)\.json$/;

async function writeJsonAtomic(filePath, data) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

export async function handleRequest(request) {
  if (!request || typeof request !== "object") throw new Error("Invalid bridge request.");
  if (request.type === "analyze_inspo") return analyzeInspo(request.payload || {});
  if (request.type === "plan_timeline") return planTimeline(request.payload || {});
  throw new Error(`Unsupported bridge request type: ${String(request.type)}`);
}

export async function startBridge(runtimeFolder, options = {}) {
  const intervalMs = options.intervalMs || 500;
  await mkdir(runtimeFolder, { recursive: true });
  let closed = false;
  const processing = new Set();

  const writeHealth = () => writeJsonAtomic(path.join(runtimeFolder, "health.json"), {
    status: "online",
    pid: process.pid,
    model: agentInfo.model,
    apiEnabled: agentInfo.apiEnabled,
    mockMode: agentInfo.mockMode,
    updatedAt: new Date().toISOString(),
  }).catch(() => {});

  await writeHealth();
  const healthTimer = setInterval(writeHealth, 5_000);

  const poll = async () => {
    if (closed) return;
    let entries = [];
    try {
      entries = await readdir(runtimeFolder);
    } catch {
      return;
    }

    for (const name of entries) {
      const match = name.match(REQUEST_PATTERN);
      if (!match || processing.has(name)) continue;
      processing.add(name);
      const requestPath = path.join(runtimeFolder, name);
      const id = match[1];
      const responsePath = path.join(runtimeFolder, `response-${id}.json`);
      try {
        const request = JSON.parse(await readFile(requestPath, "utf8"));
        if (request.id !== id) throw new Error("Request ID does not match its bridge filename.");
        const data = await handleRequest(request);
        await writeJsonAtomic(responsePath, { id, ok: true, data, completedAt: new Date().toISOString() });
        await rm(requestPath, { force: true });
      } catch (error) {
        if (error instanceof SyntaxError) {
          processing.delete(name);
          continue;
        }
        await writeJsonAtomic(responsePath, {
          id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date().toISOString(),
        });
        await rm(requestPath, { force: true });
      } finally {
        processing.delete(name);
      }
    }
  };

  const pollTimer = setInterval(() => poll().catch(() => {}), intervalMs);
  return {
    close() {
      closed = true;
      clearInterval(pollTimer);
      clearInterval(healthTimer);
    },
  };
}

