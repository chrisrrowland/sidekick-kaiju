// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as buildRenderModelModule from "../src/buildRenderModel.js";
import { animatePose } from "../src/dom.js";
import { monster } from "../src/characters/index.js";

// monster's poses (see src/characters/monster.ts): "base" is a single static frame
// (frameDurations: [0], holds indefinitely); "step" and "celebrate" are 4 frames of
// 220ms each (880ms total); "wink" is 3 frames totalling 560ms. Picked so { iterations }
// gives an exact, deterministic revert time to advance fake timers against.
const STEP_DURATION_MS = 880;
const WINK_DURATION_MS = 560;

/** The Pose object most recently passed to buildPoseRenderModels — a stand-in for
 * "which pose is currently showing", since animatePose's controller doesn't expose its
 * internal currentPoseName. */
function lastRenderedPose(spy: ReturnType<typeof vi.spyOn>): unknown {
  const calls = spy.mock.calls;
  return calls[calls.length - 1]?.[0];
}

function queuedNames(controller: ReturnType<typeof animatePose>): string[] {
  return controller.getQueued().map((entry) => entry.name);
}

describe("animatePose queue option", () => {
  let target: HTMLElement;
  let buildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    target = document.createElement("div");
    buildSpy = vi.spyOn(buildRenderModelModule, "buildPoseRenderModels");
  });

  afterEach(() => {
    vi.useRealTimers();
    buildSpy.mockRestore();
  });

  it("waits for the current timed pose to finish before switching", () => {
    const controller = animatePose(monster, "base", target);
    controller.setPose("step", { iterations: 1 });
    controller.setPose("wink", { queue: true, iterations: 1 });
    expect(queuedNames(controller)).toEqual(["wink"]);

    // Still mid-"step" — the queued pose hasn't taken over yet.
    vi.advanceTimersByTime(STEP_DURATION_MS - 1);
    expect(lastRenderedPose(buildSpy)).toBe(monster.poses.step);
    expect(queuedNames(controller)).toEqual(["wink"]);

    // "step" finishes reverting; the queued "wink" takes over immediately, and is no
    // longer reported as queued (it's the one currently playing now).
    vi.advanceTimersByTime(1);
    expect(lastRenderedPose(buildSpy)).toBe(monster.poses.wink);
    expect(queuedNames(controller)).toEqual([]);

    controller.stop();
  });

  it("plays every queued pose in FIFO order", () => {
    const controller = animatePose(monster, "base", target);
    controller.setPose("step", { iterations: 1 });
    controller.setPose("wink", { queue: true, iterations: 1 });
    controller.setPose("celebrate", { queue: true, iterations: 1 });
    // Both stay queued, oldest first — neither replaces the other.
    expect(queuedNames(controller)).toEqual(["wink", "celebrate"]);

    // "step" finishes; "wink" (queued first) takes over, "celebrate" still waits.
    vi.advanceTimersByTime(STEP_DURATION_MS);
    expect(lastRenderedPose(buildSpy)).toBe(monster.poses.wink);
    expect(queuedNames(controller)).toEqual(["celebrate"]);

    // "wink" finishes; "celebrate" takes over, queue empties.
    vi.advanceTimersByTime(WINK_DURATION_MS);
    expect(lastRenderedPose(buildSpy)).toBe(monster.poses.celebrate);
    expect(queuedNames(controller)).toEqual([]);

    controller.stop();
  });

  it("plays immediately when nothing timed is currently playing", () => {
    const controller = animatePose(monster, "base", target);
    controller.setPose("wink", { queue: true, iterations: 1 });

    expect(lastRenderedPose(buildSpy)).toBe(monster.poses.wink);
    expect(queuedNames(controller)).toEqual([]);

    controller.stop();
  });

  it("a plain setPose clears the whole queue", () => {
    const controller = animatePose(monster, "base", target);
    controller.setPose("step", { iterations: 1 });
    controller.setPose("wink", { queue: true, iterations: 1 });
    controller.setPose("celebrate", { queue: true, iterations: 1 });
    controller.setPose("base"); // not queued — takes over immediately, drops the queue

    expect(lastRenderedPose(buildSpy)).toBe(monster.poses.base);
    expect(queuedNames(controller)).toEqual([]);

    // Once base's own (unbounded, no duration/iterations) hold has nothing to revert
    // from, advancing time further shouldn't bring "wink"/"celebrate" back.
    vi.advanceTimersByTime(STEP_DURATION_MS + WINK_DURATION_MS);
    expect(lastRenderedPose(buildSpy)).toBe(monster.poses.base);

    controller.stop();
  });

  it("stop() clears the queue", () => {
    const controller = animatePose(monster, "base", target);
    controller.setPose("step", { iterations: 1 });
    controller.setPose("wink", { queue: true, iterations: 1 });
    controller.setPose("celebrate", { queue: true, iterations: 1 });
    expect(queuedNames(controller)).toEqual(["wink", "celebrate"]);

    controller.stop();
    expect(queuedNames(controller)).toEqual([]);
  });

  it("silently rejects queueing past maxQueueLength", () => {
    const controller = animatePose(monster, "base", target, { maxQueueLength: 2 });
    controller.setPose("step", { iterations: 1 });
    controller.setPose("wink", { queue: true, iterations: 1 });
    controller.setPose("celebrate", { queue: true, iterations: 1 });
    // At the cap — this one is dropped rather than pushed.
    controller.setPose("step", { queue: true, iterations: 1 });

    expect(queuedNames(controller)).toEqual(["wink", "celebrate"]);

    controller.stop();
  });

  it("Infinity opts out of the cap entirely", () => {
    const controller = animatePose(monster, "base", target, { maxQueueLength: Infinity });
    controller.setPose("step", { iterations: 1 });
    for (let i = 0; i < 50; i++) {
      controller.setPose("wink", { queue: true, iterations: 1 });
    }

    expect(controller.getQueued()).toHaveLength(50);

    controller.stop();
  });
});
