import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { editPlanSchema, styleProfileSchema } from "./schemas.mjs";
import { inspectInspoFolder } from "./media-analysis.mjs";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const MOCK_MODE = process.env.NC_AGENT_MOCK === "1";

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function pacingFromAverage(averageShotSeconds) {
  if (averageShotSeconds < 1.4) return { rhythm: "rapid", cutDensity: "very_dense" };
  if (averageShotSeconds < 2.6) return { rhythm: "dynamic", cutDensity: "dense" };
  if (averageShotSeconds < 5.5) return { rhythm: "measured", cutDensity: "moderate" };
  return { rhythm: "slow", cutDensity: "sparse" };
}

function offlineStyleProfile(metrics) {
  const pacing = pacingFromAverage(metrics.averageShotSeconds);
  return {
    summary: `Offline pacing profile from ${metrics.videoCount} reference video(s). Add an API key for visual style analysis.`,
    pacing: {
      averageShotSeconds: Number(metrics.averageShotSeconds.toFixed(2)),
      rhythm: pacing.rhythm,
      cutDensity: pacing.cutDensity,
      notes: ["Scene-change density was measured locally from the sampled references."],
    },
    color: {
      temperature: "mixed",
      contrast: "mixed",
      saturation: "mixed",
      palette: ["Visual analysis requires an API key"],
      notes: ["No reference frames were sent for AI analysis in offline mode."],
    },
    transitions: ["Transition classification requires an API key."],
    motion: ["Motion classification requires an API key."],
    audio: ["Audio style is not inferred in the offline MVP."],
    rules: [
      `Aim for an average visible shot length near ${metrics.averageShotSeconds.toFixed(1)} seconds.`,
      "Preserve intentional emotional holds instead of cutting mechanically.",
    ],
    confidence: metrics.videoCount > 0 ? 0.35 : 0.15,
    sources: {
      videoCount: metrics.videoCount,
      imageCount: metrics.imageCount,
      sampledFrameCount: metrics.sampledFrameCount,
    },
  };
}

export async function analyzeInspo({ folderPath, filePaths = [] }) {
  const inspection = await inspectInspoFolder(folderPath, filePaths);
  const client = getClient();
  if (!client || MOCK_MODE) {
    return {
      profile: styleProfileSchema.parse(offlineStyleProfile(inspection.metrics)),
      analysisMode: MOCK_MODE ? "mock" : "offline",
    };
  }

  const content = [
    {
      type: "input_text",
      text: [
        "Analyse the editing style represented by these reference metrics and sampled frames.",
        "Infer reusable stylistic patterns only; do not copy people, brands, story content, or exact shots.",
        "Treat measured shot density as stronger evidence than a visual guess.",
        JSON.stringify(inspection.metrics),
      ].join("\n\n"),
    },
    ...inspection.imageDataUrls.map((imageUrl) => ({
      type: "input_image",
      image_url: imageUrl,
      detail: "low",
    })),
  ];

  const response = await client.responses.parse({
    model: MODEL,
    store: false,
    input: [
      {
        role: "system",
        content: "You are a senior film editor and colourist. Build a concise, practical style bible that another editing agent can follow.",
      },
      { role: "user", content },
    ],
    text: {
      format: zodTextFormat(styleProfileSchema, "inspo_style_profile"),
    },
  });

  if (!response.output_parsed) throw new Error("The model did not return a usable style profile.");
  const profile = styleProfileSchema.parse({
    ...response.output_parsed,
    pacing: {
      ...response.output_parsed.pacing,
      averageShotSeconds: Number(inspection.metrics.averageShotSeconds.toFixed(2)),
    },
    sources: {
      videoCount: inspection.metrics.videoCount,
      imageCount: inspection.metrics.imageCount,
      sampledFrameCount: inspection.metrics.sampledFrameCount,
    },
  });

  return { profile, analysisMode: "openai", model: MODEL };
}

function offlinePlan() {
  return editPlanSchema.parse({
    title: "API key required",
    summary: "The timeline was read successfully, but a real AI edit plan requires an OpenAI API key.",
    confidence: 0,
    warnings: ["Restart the helper and paste an OpenAI API key when prompted."],
    changes: [],
  });
}

export async function planTimeline({ instruction, styleProfile, timeline }) {
  const client = getClient();
  if (!client || MOCK_MODE) return { plan: offlinePlan(), planningMode: MOCK_MODE ? "mock" : "offline" };

  const response = await client.responses.parse({
    model: MODEL,
    store: false,
    input: [
      {
        role: "system",
        content: [
          "You are a careful Premiere Pro assistant editor.",
          "Return a conservative edit plan using only the supported operations and exact clipId values supplied.",
          "trimStartSeconds and trimEndSeconds are amounts removed from the current clip edges, not absolute times.",
          "Preserve sync: mirror trim, move, or removal operations across clearly linked video/audio clips sharing start, duration, and name.",
          "Never reduce a clip below 0.25 seconds, create negative start times, or propose overlapping moves.",
          "Prefer fewer high-confidence changes. If evidence is insufficient, explain that in warnings and return fewer or zero changes.",
          "The Premiere panel will validate every operation and the editor must approve it before execution.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `EDITOR REQUEST:\n${instruction}`,
          `INSPO STYLE PROFILE:\n${JSON.stringify(styleProfile)}`,
          `ACTIVE TIMELINE:\n${JSON.stringify(timeline)}`,
        ].join("\n\n"),
      },
    ],
    text: {
      format: zodTextFormat(editPlanSchema, "premiere_edit_plan"),
    },
  });

  if (!response.output_parsed) throw new Error("The model did not return a usable edit plan.");
  return {
    plan: editPlanSchema.parse(response.output_parsed),
    planningMode: "openai",
    model: MODEL,
  };
}

export const agentInfo = {
  model: MODEL,
  apiEnabled: Boolean(process.env.OPENAI_API_KEY),
  mockMode: MOCK_MODE,
};
