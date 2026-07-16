import { describe, expect, it } from "vitest";
import { buildRenderModel, buildPoseRenderModels } from "../src/buildRenderModel.js";
import { toRuns } from "../src/render-runs.js";
import { monster, dino, ghost } from "../src/characters/index.js";
import type { Frame } from "../src/types.js";

const monsterBaseFrame = monster.poses.base.frames[0];

describe("buildRenderModel", () => {
  it("matches the art's dimensions", () => {
    const model = buildRenderModel(monsterBaseFrame, monster.legend);
    const artLines = monsterBaseFrame.art.split("\n");

    expect(model.height).toBe(artLines.length);
    expect(model.rows).toHaveLength(artLines.length);
    model.rows.forEach((row, i) => {
      expect(row).toHaveLength(artLines[i].length);
    });
  });

  it("maps masked glyphs to the legend's slot names", () => {
    const model = buildRenderModel(monsterBaseFrame, monster.legend);
    // Row 0, col 2 is '▛', masked 'e' -> "eyes" per monster.ts.
    expect(model.rows[0][2]).toEqual({ char: "▛", slot: "eyes" });
  });

  it("leaves unmasked cells (mask char is a space) without a slot", () => {
    const model = buildRenderModel(monsterBaseFrame, monster.legend);
    // Row 0, col 0 is a space in both art and mask.
    expect(model.rows[0][0]).toEqual({ char: " " });
  });

  it("matches dimensions for every frame of every pose of every registered character", () => {
    // Checks the trimmed model is rectangular (no ragged rows), not that trimmed
    // dimensions equal the raw art's — trimming can legitimately shrink width/height,
    // and does for any character with a column blank across every row (e.g. ghost's
    // dome/torso rows are all indented at least 3 cols) even though it happens not to
    // for monster/dino's untrimmed-width rows.
    for (const character of [monster, dino, ghost]) {
      for (const [poseName, pose] of Object.entries(character.poses)) {
        pose.frames.forEach((frame, frameIndex) => {
          const model = buildRenderModel(frame, character.legend);
          model.rows.forEach((row, i) => {
            expect(row, `${character.name}/${poseName} frame ${frameIndex} row ${i}`).toHaveLength(
              model.width,
            );
          });
        });
      }
    }
  });

  it("falls back to no slots when a frame has no mask", () => {
    const model = buildRenderModel({ art: "ab\ncd" });
    for (const row of model.rows) {
      for (const cell of row) {
        expect(cell.slot).toBeUndefined();
      }
    }
  });
});

describe("buildPoseRenderModels", () => {
  function frame(art: string): Frame {
    return { art };
  }

  it("shares one trim boundary across every frame instead of each frame's own tightest box", () => {
    // Regression test for the bug that made ghost's `float` pose invisible: a solid
    // shape shifted sideways, then trimmed per-frame independently, re-crops to the
    // identical box regardless of the shift.
    const pose = {
      frames: [frame("  ███   "), frame("   ███  ")],
      frameDurations: [200, 200],
    };

    const [rest, shifted] = buildPoseRenderModels(pose);
    expect(rest.width).toBe(shifted.width);
    const toText = (m: (typeof rest)) => m.rows.map((row) => row.map((c) => c.char).join("")).join("\n");
    expect(toText(rest)).not.toBe(toText(shifted));
  });

  it("matches buildRenderModel's own output for a pose with only one frame", () => {
    const pose = { frames: [frame("  ab  ")], frameDurations: [0] };
    expect(buildPoseRenderModels(pose)).toEqual([buildRenderModel(pose.frames[0])]);
  });
});

describe("toRuns", () => {
  it("groups consecutive cells sharing a slot into one run", () => {
    const row = [
      { char: "a", slot: "body" },
      { char: "b", slot: "body" },
      { char: "c", slot: "eyes" },
      { char: "d" },
      { char: "e" },
    ];
    expect(toRuns(row)).toEqual([
      { text: "ab", slot: "body" },
      { text: "c", slot: "eyes" },
      { text: "de", slot: undefined },
    ]);
  });

  it("does not merge runs of the same slot separated by an unslotted gap", () => {
    const row = [
      { char: "a", slot: "body" },
      { char: " " },
      { char: "b", slot: "body" },
    ];
    expect(toRuns(row)).toEqual([
      { text: "a", slot: "body" },
      { text: " ", slot: undefined },
      { text: "b", slot: "body" },
    ]);
  });
});
