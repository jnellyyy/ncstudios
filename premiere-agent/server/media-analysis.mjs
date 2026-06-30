import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts", ".m2ts",
]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_VIDEOS = 4;
const MAX_STILLS = 6;
const MAX_ANALYSIS_SECONDS = 90;
const FRAMES_PER_VIDEO = 3;

function run(binary, args, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Media analysis exceeded ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < 4_000_000) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 8_000_000) stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function walk(folderPath, depth = 0) {
  if (depth > 4) return [];
  const entries = await readdir(folderPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.name.startsWith(".")) return [];
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) return walk(entryPath, depth + 1);
    if (!entry.isFile()) return [];
    const extension = path.extname(entry.name).toLowerCase();
    return VIDEO_EXTENSIONS.has(extension) || IMAGE_EXTENSIONS.has(extension) ? [entryPath] : [];
  }));
  return nested.flat();
}

function parseDuration(output) {
  const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parseVideoMetadata(output) {
  const resolution = output.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  const fps = output.match(/(?:,|\s)(\d+(?:\.\d+)?)\s*fps(?:,|\s)/);
  return {
    width: resolution ? Number(resolution[1]) : 0,
    height: resolution ? Number(resolution[2]) : 0,
    fps: fps ? Number(fps[1]) : 0,
  };
}

async function probeVideo(filePath) {
  const result = await run(ffmpegPath, [
    "-hide_banner", "-i", filePath, "-map", "0:v:0", "-c", "copy", "-f", "null", "-",
  ], 45_000);
  const output = `${result.stdout}\n${result.stderr}`;
  return {
    durationSeconds: parseDuration(output),
    ...parseVideoMetadata(output),
  };
}

async function detectCuts(filePath, durationSeconds) {
  const analysedSeconds = Math.max(1, Math.min(durationSeconds || MAX_ANALYSIS_SECONDS, MAX_ANALYSIS_SECONDS));
  const result = await run(ffmpegPath, [
    "-hide_banner", "-t", String(analysedSeconds), "-i", filePath, "-an",
    "-vf", "scale=320:-2,select='gt(scene,0.32)',showinfo",
    "-fps_mode", "vfr", "-f", "null", "-",
  ], 150_000);
  const matches = [...result.stderr.matchAll(/pts_time:([0-9.]+)/g)];
  const uniqueCutTimes = [...new Set(matches.map((match) => Number(match[1]).toFixed(3)))];
  return {
    analysedSeconds,
    detectedCuts: uniqueCutTimes.length,
    averageShotSeconds: analysedSeconds / Math.max(1, uniqueCutTimes.length + 1),
  };
}

async function extractFrames(filePath, durationSeconds, outputFolder, prefix) {
  const duration = Math.max(1, durationSeconds || 1);
  const positions = [0.2, 0.5, 0.8].slice(0, FRAMES_PER_VIDEO);
  const frames = [];
  for (let index = 0; index < positions.length; index += 1) {
    const outputPath = path.join(outputFolder, `${prefix}-${index + 1}.jpg`);
    const seek = Math.max(0, Math.min(duration - 0.1, duration * positions[index]));
    const result = await run(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-ss", String(seek), "-i", filePath,
      "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", "-y", outputPath,
    ], 45_000);
    if (result.code === 0) frames.push(outputPath);
  }
  return frames;
}

function imageMime(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

async function toDataUrl(filePath) {
  const fileStat = await stat(filePath);
  if (fileStat.size > 12 * 1024 * 1024) return null;
  const content = await readFile(filePath);
  return `data:${imageMime(filePath)};base64,${content.toString("base64")}`;
}

export async function inspectInspoFolder(folderPath, explicitFilePaths = []) {
  if (!ffmpegPath) throw new Error("The bundled FFmpeg executable is unavailable.");
  if (!folderPath && explicitFilePaths.length === 0) {
    throw new Error("No Inspo folder or Premiere media files were supplied.");
  }
  const files = explicitFilePaths.length > 0 ? explicitFilePaths : await walk(folderPath);
  const videoFiles = files.filter((file) => VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase())).slice(0, MAX_VIDEOS);
  const stillFiles = files.filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())).slice(0, MAX_STILLS);

  if (videoFiles.length === 0 && stillFiles.length === 0) {
    throw new Error("No supported videos or images were found in the selected Inspo folder.");
  }

  const tempFolder = await mkdtemp(path.join(os.tmpdir(), "nc-edit-agent-"));
  try {
    const videos = [];
    const extractedFrames = [];
    for (let index = 0; index < videoFiles.length; index += 1) {
      const filePath = videoFiles[index];
      const metadata = await probeVideo(filePath);
      const cuts = await detectCuts(filePath, metadata.durationSeconds);
      const frames = await extractFrames(filePath, metadata.durationSeconds, tempFolder, `video-${index + 1}`);
      extractedFrames.push(...frames);
      videos.push({
        name: path.basename(filePath),
        ...metadata,
        ...cuts,
      });
    }

    const visualFiles = [...extractedFrames, ...stillFiles];
    const imageDataUrls = (await Promise.all(visualFiles.map(toDataUrl))).filter(Boolean);
    const totalAnalysedSeconds = videos.reduce((sum, video) => sum + video.analysedSeconds, 0);
    const totalSegments = videos.reduce((sum, video) => sum + video.detectedCuts + 1, 0);

    return {
      metrics: {
        folderName: explicitFilePaths.length > 0
          ? `Premiere selection: ${path.basename(explicitFilePaths[0])}`
          : path.basename(folderPath),
        videoCount: videoFiles.length,
        imageCount: stillFiles.length,
        sampledFrameCount: imageDataUrls.length,
        averageShotSeconds: totalSegments > 0 ? totalAnalysedSeconds / totalSegments : 4,
        videos,
      },
      imageDataUrls,
    };
  } finally {
    await rm(tempFolder, { recursive: true, force: true });
  }
}
