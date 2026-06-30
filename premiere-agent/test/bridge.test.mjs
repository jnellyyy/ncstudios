import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sampleStyleProfile } from "./fixtures.mjs";

process.env.NC_AGENT_MOCK = "1";
const { startBridge } = await import("../server/bridge.mjs");

async function waitForFile(filePath, timeoutMs = 4_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

test("filesystem bridge returns a structured offline edit plan", async () => {
  const runtimeFolder = await mkdtemp(path.join(os.tmpdir(), "nc-agent-bridge-"));
  const bridge = await startBridge(runtimeFolder, { intervalMs: 25 });
  try {
    const id = "testrequest1";
    await writeFile(path.join(runtimeFolder, `request-${id}.json`), JSON.stringify({
      id,
      type: "plan_timeline",
      payload: {
        instruction: "Tighten the edit",
        styleProfile: sampleStyleProfile,
        timeline: { sequenceName: "Test", videoTracks: [], audioTracks: [] },
      },
    }));
    const response = JSON.parse(await waitForFile(path.join(runtimeFolder, `response-${id}.json`)));
    assert.equal(response.ok, true);
    assert.equal(response.data.planningMode, "mock");
    assert.deepEqual(response.data.plan.changes, []);
  } finally {
    bridge.close();
    await rm(runtimeFolder, { recursive: true, force: true });
  }
});
