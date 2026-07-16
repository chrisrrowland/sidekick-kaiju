import { describe, expect, it } from "vitest";
import {
  getPose,
  getPoseDuration,
  getIterationsDuration,
  poseNames,
  slotNames,
  describeCharacter,
} from "../src/poses.js";
import { monster } from "../src/characters/index.js";

describe("getPose", () => {
  it("returns the named pose", () => {
    expect(getPose(monster, "step")).toBe(monster.poses.step);
  });

  it("throws with the available pose names on an unknown pose", () => {
    expect(() => getPose(monster, "dance")).toThrowError(/Unknown pose "dance".*base, step/);
  });
});

describe("getPoseDuration", () => {
  it("sums frameDurations across all frames of a pose", () => {
    const total = monster.poses.step.frameDurations.reduce((a, b) => a + b, 0);
    expect(getPoseDuration(monster, "step")).toBe(total);
  });

  it("throws with the available pose names on an unknown pose", () => {
    expect(() => getPoseDuration(monster, "dance")).toThrowError(/Unknown pose "dance"/);
  });
});

describe("getIterationsDuration", () => {
  it("multiplies getPoseDuration by iterations at the default speed", () => {
    expect(getIterationsDuration(monster, "wink", 2)).toBe(getPoseDuration(monster, "wink") * 2);
  });

  it("divides by speed, so a slower playback takes proportionally longer", () => {
    expect(getIterationsDuration(monster, "wink", 2, 0.5)).toBe(
      (getPoseDuration(monster, "wink") / 0.5) * 2,
    );
    expect(getIterationsDuration(monster, "wink", 1, 2)).toBe(getPoseDuration(monster, "wink") / 2);
  });
});

describe("poseNames", () => {
  it("self-maps every pose key on the character", () => {
    expect(poseNames(monster)).toEqual({
      base: "base",
      step: "step",
      celebrate: "celebrate",
      wink: "wink",
    });
  });

  it("stays in sync with the character's actual poses (no separately-maintained list)", () => {
    expect(Object.keys(poseNames(monster))).toEqual(Object.keys(monster.poses));
  });
});

describe("slotNames", () => {
  it("returns the deduplicated legend values", () => {
    expect(slotNames(monster)).toEqual(["body", "eyes", "legs", "arms"]);
  });
});

describe("describeCharacter", () => {
  it("summarizes every pose and slot from the real character data", () => {
    const summary = describeCharacter(monster);
    expect(summary.name).toBe("monster");
    expect(summary.slots).toEqual(["body", "eyes", "legs", "arms"]);
    expect(summary.poses).toContainEqual({
      name: "base",
      frameCount: 1,
      animated: false,
      totalDurationMs: 0,
    });
    const step = summary.poses.find((p) => p.name === "step");
    expect(step).toEqual({
      name: "step",
      frameCount: 4,
      animated: true,
      totalDurationMs: getPoseDuration(monster, "step"),
    });
  });
});
