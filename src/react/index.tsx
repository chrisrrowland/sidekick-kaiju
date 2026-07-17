import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { buildPoseRenderModels } from "../buildRenderModel.js";
import { getCharacter } from "../characters/index.js";
import { DEFAULT_MAX_QUEUE_LENGTH } from "../dom.js";
import { getIterationsDuration, getPose } from "../poses.js";
import { toRuns } from "../render-runs.js";
import { themeToStyle } from "../theme.js";
import type { ClassNames, RenderModel, Theme } from "../types.js";

export interface SidekickProps extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "style"> {
  /** Name of a registered character, e.g. "monster". */
  character?: string;
  /** Name of a pose on that character, e.g. "base" or "step". */
  pose?: string;
  /** Playback speed multiplier — 0.5 makes every frame last twice as long, 2 makes
   * them last half as long. Defaults to 1. Pair with `useSidekickPose`'s returned
   * `speed`, which tracks whatever `{ speed }` the last `setPose` call used. */
  speed?: number;
  /** Root element class name, in addition to the base "sidekick" class. */
  className?: string;
  /** Per-slot classes the host app already owns (e.g. `{ eyes: styles.glow }`). */
  classNames?: ClassNames;
  /** Theme overrides, applied as CSS custom properties. */
  theme?: Theme;
  style?: CSSProperties;
}

/**
 * Builds the render model for a character's pose, animating between frames per the
 * pose's `frameDurations`.
 *
 * @remarks
 * Frame duration is divided by `speed` — 0.5 plays every frame twice as long, 2 plays
 * them half as long. Static single-frame poses (duration 0) never schedule a timer
 * regardless of speed, so plain `useSidekick("monster")` has zero animation overhead.
 * `<Sidekick>` calls this internally and renders the result — reach for this directly
 * only when you need to build your own markup around the render model instead of
 * `<Sidekick>`'s `<div><pre>...</pre></div>`.
 *
 * @example
 * ```tsx
 * const model = useSidekick("monster", "step");
 * // build your own <div>/<pre> around model.rows, or pass it to a custom renderer
 * ```
 *
 * @category Advanced
 */
export function useSidekick(
  character: string = "monster",
  pose: string = "base",
  speed: number = 1,
): RenderModel {
  const characterData = getCharacter(character);
  const poseData = getPose(characterData, pose);

  const [frameIndex, setFrameIndex] = useState(0);

  // Reset to frame 0 whenever character/pose/speed changes, during render (not an
  // effect) so there's no one-tick flash of a stale frame from the previous pose.
  // Compares against previous *state* (not a ref) per React's documented pattern for
  // this — mutating a ref during render is unsafe under StrictMode's double-invocation:
  // the second render pass would see the ref already updated by the first and skip the
  // reset, desyncing frameIndex from the pose after enough rapid switches. State
  // comparisons don't have this problem. This still isn't enough on its own to
  // prevent an out-of-bounds read further down in *this same* render pass (frameIndex
  // is still whatever it was for the previous pose right up until the corrective
  // setFrameIndex(0) commits), so every read of `frameIndex` below goes through
  // `safeFrameIndex` instead, which clamps against the new pose's frame count.
  //
  // `speed` is part of this key, not just character+pose: a `useSidekickPose` queue
  // re-invoking the *same* pose name at a new speed (e.g. chained `setPose("step",
  // { queue: true, speed })` calls for a "revving up" effect) is a fresh animation
  // instance just as much as a name change is — without this, the same-name case never
  // trips the pose-changed check below, so a stale mid-pose frameIndex (left over from
  // whatever frame the previous instance's own frame-loop timer happened to land on,
  // canceled mid-flight when the new instance took over) carries into the new instance
  // instead of restarting at frame 0. That stale carry-over is what produces a visible
  // stutter — the old frame lingers for a whole extra hold at the new speed before the
  // loop finally wraps around to frame 0 on its own. Folding `speed` in forces the same
  // clean restart a name change already gets. This assumes `speed` only changes at
  // pose-invocation boundaries (true for `useSidekickPose`, and documented as the
  // intended pairing on `SidekickProps.speed`) rather than being live-adjusted mid-pose
  // (e.g. a continuously-dragged slider), which this would also reset on.
  const poseKey = `${character}:${pose}:${speed}`;
  const [prevPoseKey, setPrevPoseKey] = useState(poseKey);
  if (prevPoseKey !== poseKey) {
    setPrevPoseKey(poseKey);
    if (frameIndex !== 0) setFrameIndex(0);
  }
  const safeFrameIndex = frameIndex % poseData.frames.length;

  useEffect(() => {
    if (poseData.frames.length <= 1) return;
    const duration = poseData.frameDurations[safeFrameIndex];
    if (!duration) return; // 0/undefined means hold this frame indefinitely
    const timer = setTimeout(() => {
      setFrameIndex((i) => (i + 1) % poseData.frames.length);
    }, duration / speed);
    return () => clearTimeout(timer);
  }, [poseData, safeFrameIndex, speed]);

  const models = useMemo(
    () => buildPoseRenderModels(poseData, characterData.legend),
    [characterData, poseData],
  );
  return models[safeFrameIndex];
}

/**
 * Tracks a pose name (plus its playback speed) with an optional timed revert.
 *
 * @remarks
 * `setPose("celebrating", { duration: 2000 })` switches immediately and reverts to
 * `basePose` after the given ms; omitting `duration` holds the pose indefinitely.
 * `setPose("wink", { iterations: 2 })` instead reverts after the pose's frames have
 * played through twice (requires passing `character`, since that's what `iterations`
 * measures frame durations against). `{ speed: 0.5 }` plays every frame of this
 * invocation at twice the duration — combine with `iterations` for e.g. two slow-motion
 * blinks — and takes effect immediately on the returned `speed`, not just the revert
 * timing. Re-calling `setPose` before a pending revert fires replaces it rather than
 * stacking timers, and reverting always resets speed back to 1. `{ queue: true }` waits
 * for the current timed pose to finish instead of interrupting it — queued poses play in
 * the order they were queued (FIFO), each keeping its own options, up to `options.maxQueueLength`;
 * a later non-queued `setPose` clears the whole queue. The returned `queuedPoses` is that
 * list, oldest (next up) first, for a host app that wants to show "up next" UI. Otherwise
 * knows nothing about characters/frames — compose with `useSidekick(character, pose,
 * speed)` or `<Sidekick pose speed>` for the animated pose itself.
 *
 * @example
 * ```tsx
 * const [pose, setPose, speed, queuedPoses] = useSidekickPose("base", "monster");
 * <Sidekick character="monster" pose={pose} speed={speed} />;
 * // elsewhere — a click handler, a websocket message, anything
 * setPose("wink", { iterations: 2, speed: 0.5 }); // two slow-motion blinks
 * setPose("celebrate", { queue: true, iterations: 1 }); // waits for wink to finish
 * setPose("chomp", { queue: true, iterations: 1 }); // waits for celebrate too
 * queuedPoses; // [{ name: "celebrate", ... }, { name: "chomp", ... }]
 * ```
 *
 * @category Common
 */
export interface SetSidekickPoseOptions {
  /** ms before automatically reverting to `basePose`. */
  duration?: number;
  /** Revert after playing through the pose's frames this many times, instead of
   * looping or holding. Takes precedence over `duration` if both are given. */
  iterations?: number;
  /** Playback speed multiplier — `0.5` plays every frame twice as long, `2` half as
   * long. Defaults to 1. Reverting resets speed back to 1. */
  speed?: number;
  /**
   * Wait for the currently-playing timed pose to finish before switching, instead of
   * interrupting it. Queued poses play in the order they were queued (FIFO), each
   * keeping its own options, up to `useSidekickPose`'s `maxQueueLength` option. If
   * nothing is currently mid-animation, plays immediately, same as a normal `setPose`. A
   * plain (non-queued) `setPose` call always clears the whole queue.
   */
  queue?: boolean;
}

/** One pose waiting in `useSidekickPose`'s queue — the pose name plus whatever options
 * its `setPose(name, { queue: true, ... })` call was given. */
export interface QueuedSidekickPose {
  name: string;
  options?: SetSidekickPoseOptions;
}

export interface UseSidekickPoseOptions {
  /**
   * Safety cap on how many poses can be waiting in the queue at once — once hit, further
   * `{ queue: true }` calls are silently dropped rather than growing the queue further.
   * Defaults to `DEFAULT_MAX_QUEUE_LENGTH` (1000). Pass `Infinity` to opt out of the cap
   * entirely. Check the returned `queuedPoses.length` before queueing if you want to
   * throttle proactively instead of relying on this cap.
   */
  maxQueueLength?: number;
}

export function useSidekickPose(
  basePose: string = "base",
  character?: string,
  options?: UseSidekickPoseOptions,
) {
  const maxQueueLength = options?.maxQueueLength ?? DEFAULT_MAX_QUEUE_LENGTH;
  const [pose, setPoseState] = useState(basePose);
  const [speed, setSpeedState] = useState(1);
  const [queuedPoses, setQueuedPosesState] = useState<QueuedSidekickPose[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  // The actual FIFO queue, needed to apply each entry once its turn comes up.
  // `queuedPoses` above mirrors it as render-visible state — a ref alone wouldn't
  // trigger a re-render when a pose gets queued or consumed.
  const queuedRef = useRef<QueuedSidekickPose[]>([]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  // The actual pose switch, shared by immediate setPose calls and by a queued pose
  // taking over once the pose it was waiting behind reverts. Named (not an anonymous
  // arrow) so the revert timer below can recurse via `applyPoseImpl` — a named function
  // expression's own name is a separate binding, visible only inside its body, so this
  // doesn't hit the "self-reference to a not-yet-declared const" TDZ concern the lint
  // rule flags for an arrow function calling the outer `applyPose` const.
  const applyPose = useCallback(function applyPoseImpl(
    name: string,
    options?: SetSidekickPoseOptions,
  ) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
    setPoseState(name);
    const speedValue = options?.speed ?? 1;
    setSpeedState(speedValue);
    let duration = options?.duration;
    if (options?.iterations) {
      if (!character) {
        throw new Error('useSidekickPose: pass `character` to use `setPose(name, { iterations })`');
      }
      duration = getIterationsDuration(getCharacter(character), name, options.iterations, speedValue);
    }
    if (duration) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = undefined;
        const [next, ...rest] = queuedRef.current;
        if (next) {
          queuedRef.current = rest;
          setQueuedPosesState(rest);
          applyPoseImpl(next.name, next.options);
        } else {
          setPoseState(basePose);
          setSpeedState(1);
        }
      }, duration);
    }
  }, [basePose, character]);

  const setPose = useCallback(
    (name: string, setPoseOptions?: SetSidekickPoseOptions) => {
      if (setPoseOptions?.queue && timeoutRef.current !== undefined) {
        // Past the cap, the queue attempt is silently dropped — check
        // `queuedPoses.length` before queueing if a caller wants to throttle
        // proactively instead.
        if (queuedRef.current.length >= maxQueueLength) return;
        const next = [...queuedRef.current, { name, options: setPoseOptions }];
        queuedRef.current = next;
        setQueuedPosesState(next);
        return;
      }
      queuedRef.current = [];
      setQueuedPosesState([]);
      applyPose(name, setPoseOptions);
    },
    [applyPose, maxQueueLength],
  );

  return [pose, setPose, speed, queuedPoses] as const;
}

/**
 * Renders a character's pose as terminal-art, themeable via `theme`/`classNames`.
 *
 * @remarks
 * Unlisted props (`onClick`, `aria-*`, `data-*`, ...) forward straight to the root
 * `<div>`, so it behaves like a regular element for event handlers and accessibility
 * attributes. Pair with `useSidekickPose` to switch poses over time.
 *
 * @example
 * ```tsx
 * <Sidekick character="monster" pose="step" theme={{ color: "#39ff88" }} />
 * ```
 *
 * @category Common
 */
export function Sidekick({
  character = "monster",
  pose = "base",
  speed = 1,
  className,
  classNames = {},
  theme,
  style,
  ...rest
}: SidekickProps) {
  const model = useSidekick(character, pose, speed);

  const rootClassName = ["sidekick", className, classNames.root].filter(Boolean).join(" ");
  const mergedStyle: CSSProperties = theme ? { ...themeToStyle(theme), ...style } : (style ?? {});

  return (
    <div className={rootClassName} style={mergedStyle} {...rest}>
      <pre className="sidekick__art">
        {model.rows.map((row, rowIndex) => (
          <span key={rowIndex}>
            {rowIndex > 0 ? "\n" : null}
            {toRuns(row).map((run, runIndex) =>
              run.slot ? (
                <span key={runIndex} data-slot={run.slot} className={classNames[run.slot]}>
                  {run.text}
                </span>
              ) : (
                run.text
              ),
            )}
          </span>
        ))}
      </pre>
    </div>
  );
}
