import path from "node:path";
import { fileURLToPath } from "node:url";
import { agentInfo } from "./agent.mjs";
import { startBridge } from "./bridge.mjs";

const serverFolder = path.dirname(fileURLToPath(import.meta.url));
const runtimeFolder = path.resolve(serverFolder, "../runtime");
const bridge = await startBridge(runtimeFolder);

console.log("");
console.log("NC Premiere Edit Agent is ready.");
console.log(`Bridge folder: ${runtimeFolder}`);
console.log(`Model: ${agentInfo.model}`);
console.log(agentInfo.apiEnabled ? "AI planning: enabled" : "AI planning: offline demo mode (no API key)");
console.log("Keep this window open while using Premiere. Press Control-C to stop.");
console.log("");

const shutdown = () => {
  bridge.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

