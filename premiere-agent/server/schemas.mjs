import { z } from "zod";

export const styleProfileSchema = z.object({
  summary: z.string().min(1).max(600),
  pacing: z.object({
    averageShotSeconds: z.number().min(0.1).max(120),
    rhythm: z.enum(["slow", "measured", "dynamic", "rapid", "mixed"]),
    cutDensity: z.enum(["sparse", "moderate", "dense", "very_dense"]),
    notes: z.array(z.string().max(180)).max(8),
  }),
  color: z.object({
    temperature: z.enum(["cool", "neutral", "warm", "mixed"]),
    contrast: z.enum(["soft", "balanced", "strong", "mixed"]),
    saturation: z.enum(["muted", "natural", "rich", "mixed"]),
    palette: z.array(z.string().max(60)).min(1).max(8),
    notes: z.array(z.string().max(180)).max(8),
  }),
  transitions: z.array(z.string().max(160)).max(10),
  motion: z.array(z.string().max(160)).max(10),
  audio: z.array(z.string().max(160)).max(10),
  rules: z.array(z.string().max(180)).min(1).max(16),
  confidence: z.number().min(0).max(1),
  sources: z.object({
    videoCount: z.number().int().min(0),
    imageCount: z.number().int().min(0),
    sampledFrameCount: z.number().int().min(0),
  }),
});

const changeBase = {
  clipId: z.string().min(1).max(500),
  reason: z.string().min(1).max(300),
};

export const editChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trim_clip"),
    ...changeBase,
    trimStartSeconds: z.number().min(0).max(30),
    trimEndSeconds: z.number().min(0).max(30),
  }),
  z.object({
    type: z.literal("remove_clip"),
    ...changeBase,
    rippleDelete: z.boolean(),
  }),
  z.object({
    type: z.literal("move_clip"),
    ...changeBase,
    deltaSeconds: z.number().min(-30).max(30),
  }),
  z.object({
    type: z.literal("set_clip_disabled"),
    ...changeBase,
    disabled: z.boolean(),
  }),
  z.object({
    type: z.literal("rename_clip"),
    ...changeBase,
    name: z.string().min(1).max(80),
  }),
]);

export const editPlanSchema = z.object({
  title: z.string().min(1).max(100),
  summary: z.string().min(1).max(700),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string().max(240)).max(12),
  changes: z.array(editChangeSchema).max(80),
});

