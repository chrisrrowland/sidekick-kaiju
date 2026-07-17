// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidekick, useSidekickPose } from "../src/react/index.js";

// Same monster pose durations as test/dom.test.ts: "step"/"celebrate" are 880ms total
// (4 frames * 220ms), "wink" is 560ms (90+380+90) — picked so { iterations: 1 } gives an
// exact, deterministic revert time to advance fake timers against.
const STEP_DURATION_MS = 880;
const WINK_DURATION_MS = 560;

function queuedNames(result: { current: readonly [unknown, unknown, unknown, { name: string }[]] }): string[] {
  return result.current[3].map((entry) => entry.name);
}

describe("useSidekickPose queue option", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the current timed pose to finish before switching", () => {
    const { result } = renderHook(() => useSidekickPose("base", "monster"));

    act(() => result.current[1]("step", { iterations: 1 }));
    act(() => result.current[1]("wink", { queue: true, iterations: 1 }));
    expect(queuedNames(result)).toEqual(["wink"]);

    // Still mid-"step" — the queued pose hasn't taken over yet.
    act(() => vi.advanceTimersByTime(STEP_DURATION_MS - 1));
    expect(result.current[0]).toBe("step");
    expect(queuedNames(result)).toEqual(["wink"]);

    // "step" finishes reverting; the queued "wink" takes over immediately, and is no
    // longer reported as queued (it's the one currently playing now).
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe("wink");
    expect(queuedNames(result)).toEqual([]);
  });

  it("plays every queued pose in FIFO order", () => {
    const { result } = renderHook(() => useSidekickPose("base", "monster"));

    act(() => result.current[1]("step", { iterations: 1 }));
    act(() => result.current[1]("wink", { queue: true, iterations: 1 }));
    act(() => result.current[1]("celebrate", { queue: true, iterations: 1 }));
    // Both stay queued, oldest first — neither replaces the other.
    expect(queuedNames(result)).toEqual(["wink", "celebrate"]);

    // "step" finishes; "wink" (queued first) takes over, "celebrate" still waits.
    act(() => vi.advanceTimersByTime(STEP_DURATION_MS));
    expect(result.current[0]).toBe("wink");
    expect(queuedNames(result)).toEqual(["celebrate"]);

    // "wink" finishes; "celebrate" takes over, queue empties.
    act(() => vi.advanceTimersByTime(WINK_DURATION_MS));
    expect(result.current[0]).toBe("celebrate");
    expect(queuedNames(result)).toEqual([]);
  });

  it("plays immediately when nothing timed is currently playing", () => {
    const { result } = renderHook(() => useSidekickPose("base", "monster"));

    act(() => result.current[1]("wink", { queue: true, iterations: 1 }));

    expect(result.current[0]).toBe("wink");
    expect(queuedNames(result)).toEqual([]);
  });

  it("a plain setPose clears the whole queue", () => {
    const { result } = renderHook(() => useSidekickPose("base", "monster"));

    act(() => result.current[1]("step", { iterations: 1 }));
    act(() => result.current[1]("wink", { queue: true, iterations: 1 }));
    act(() => result.current[1]("celebrate", { queue: true, iterations: 1 }));
    act(() => result.current[1]("base")); // not queued — takes over, drops the queue

    expect(result.current[0]).toBe("base");
    expect(queuedNames(result)).toEqual([]);

    act(() => vi.advanceTimersByTime(STEP_DURATION_MS + WINK_DURATION_MS));
    expect(result.current[0]).toBe("base");
  });

  it("silently rejects queueing past maxQueueLength", () => {
    const { result } = renderHook(() => useSidekickPose("base", "monster", { maxQueueLength: 2 }));

    act(() => result.current[1]("step", { iterations: 1 }));
    act(() => result.current[1]("wink", { queue: true, iterations: 1 }));
    act(() => result.current[1]("celebrate", { queue: true, iterations: 1 }));
    // At the cap — this one is dropped rather than pushed.
    act(() => result.current[1]("step", { queue: true, iterations: 1 }));

    expect(queuedNames(result)).toEqual(["wink", "celebrate"]);
  });

  it("Infinity opts out of the cap entirely", () => {
    const { result } = renderHook(() =>
      useSidekickPose("base", "monster", { maxQueueLength: Infinity }),
    );

    act(() => result.current[1]("step", { iterations: 1 }));
    for (let i = 0; i < 50; i++) {
      act(() => result.current[1]("wink", { queue: true, iterations: 1 }));
    }

    expect(queuedNames(result)).toHaveLength(50);
  });
});

describe("useSidekick frame reset on speed change", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Regression test: queuing the *same* pose name back-to-back at different speeds (the
  // "revving up" trick — see playground) used to leave a stale mid-pose frameIndex
  // carried over into the new invocation, because the frame-reset check only fired on a
  // pose *name* change. That produced a real, measured ~300ms stutter — the old frame
  // held on screen through one extra full hold at the new speed before finally wrapping
  // to frame 0 — confirmed via MutationObserver timestamps against a live playground
  // session before this fix. A re-render with the same pose name but a different speed
  // must now reset to frame 0 just like a name change does.
  it("resets to frame 0 when speed changes, even with the same pose name", () => {
    const { result, rerender } = renderHook(
      ({ speed }: { speed: number }) => useSidekick("monster", "step", speed),
      { initialProps: { speed: 1 } },
    );
    const frame0Model = result.current;

    // Advance a couple of frames away from frame 0.
    act(() => vi.advanceTimersByTime(220));
    act(() => vi.advanceTimersByTime(220));
    expect(result.current).not.toBe(frame0Model);

    // Same pose name ("step"), different speed — must snap back to frame 0 immediately,
    // in this same render, not after one more stale frame-hold.
    rerender({ speed: 2 });
    expect(result.current).toBe(frame0Model);
  });
});
