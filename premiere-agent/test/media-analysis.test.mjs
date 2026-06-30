import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ffmpegPath from "ffmpeg-static";
import { inspectInspoFolder } from "../server/media-analysis.mjs";

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr)));
  });
}

test("reference analyser measures cuts and produces sampled frames", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "nc-agent-inspo-"));
  const videoPath = path.join(folder, "three-scenes.mp4");
  try {
    await run([
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=0x8b4b3b:s=640x360:d=1:r=25",
      "-f", "lavfi", "-i", "color=c=0x355f66:s=640x360:d=1:r=25",
      "-f", "lavfi", "-i", "color=c=0xd2b57a:s=640x360:d=1:r=25",
      "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[out]",
      "-map", "[out]", "-y", videoPath,
    ]);
    const result = await inspectInspoFolder(folder);
    assert.equal(result.metrics.videoCount, 1);
    assert.equal(result.metrics.sampledFrameCount, 3);
    assert.ok(result.metrics.averageShotSeconds > 0);
    assert.ok(result.imageDataUrls.every((url) => url.startsWith("data:image/jpeg;base64,")));

    const premiereSelectionResult = await inspectInspoFolder(null, [videoPath]);
    assert.equal(premiereSelectionResult.metrics.videoCount, 1);
    assert.match(premiereSelectionResult.metrics.folderName, /^Premiere selection:/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
