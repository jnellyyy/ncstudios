import assert from "node:assert/strict";
import test from "node:test";
import { editPlanSchema, styleProfileSchema } from "../server/schemas.mjs";
import { sampleStyleProfile } from "./fixtures.mjs";

test("style profile accepts a complete bounded profile", () => {
  assert.equal(styleProfileSchema.parse(sampleStyleProfile).pacing.averageShotSeconds, 2.8);
});

test("edit plan accepts supported operations", () => {
  const plan = editPlanSchema.parse({
    title: "Tighter ceremony cut",
    summary: "Tighten pauses while preserving the couple's reactions.",
    confidence: 0.76,
    warnings: ["Review linked audio before applying ripple removals."],
    changes: [
      {
        type: "trim_clip",
        clipId: "video:0:0:0.000:A001.mov",
        trimStartSeconds: 0.1,
        trimEndSeconds: 0.3,
        reason: "Shortens a static lead-in.",
      },
      {
        type: "remove_clip",
        clipId: "video:0:1:4.000:A002.mov",
        rippleDelete: true,
        reason: "Removes a redundant reaction.",
      },
    ],
  });
  assert.equal(plan.changes.length, 2);
});

test("edit plan rejects unsafe trim sizes", () => {
  assert.throws(() => editPlanSchema.parse({
    title: "Bad plan",
    summary: "This should not validate.",
    confidence: 0.1,
    warnings: [],
    changes: [{
      type: "trim_clip",
      clipId: "video:0:0:0.000:A001.mov",
      trimStartSeconds: 90,
      trimEndSeconds: 0,
      reason: "Too large.",
    }],
  }));
});
