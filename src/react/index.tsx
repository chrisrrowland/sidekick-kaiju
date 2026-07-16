import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { buildPoseRenderModels } from "../buildRenderModel.js";
import { getCharacter } from "../characters/index.js";
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

  // Reset to frame 0 whenever character/pose changes, during render (not an effect)
  // so there's no one-tick flash of a stale frame from the previous pose. Compares
  // against previous *state* (not a ref) per React's documented pattern for this —
  // mutating a ref during render is unsafe under StrictMode's double-invocation: the
  // second render pass would see the ref already updated by the first and skip the
  // reset, desyncing frameIndex from the pose after enough rapid switches. State
  // comparisons don't have this problem. This still isn't enough on its own to
  // prevent an out-of-bounds read further down in *this same* render pass (frameIndex
  // is still whatever it was for the previous pose right up until the corrective
  // setFrameIndex(0) commits), so every read of `frameIndex` below goes through
  // `safeFrameIndex` instead, which clamps against the new pose's frame count.
  const poseKey = `${character}:${pose}`;
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
 * stacking timers, and reverting always resets speed back to 1. Otherwise knows nothing
 * about characters/frames — compose with `useSidekick(character, pose, speed)` or
 * `<Sidekick pose speed>` for the animated pose itself.
 *
 * @example
 * ```tsx
 * const [pose, setPose, speed] = useSidekickPose("base", "monster");
 * <Sidekick character="monster" pose={pose} speed={speed} />;
 * // elsewhere — a click handler, a websocket message, anything
 * setPose("wink", { iterations: 2, speed: 0.5 }); // two slow-motion blinks
 * ```
 *
 * @category Common
 */
export function useSidekickPose(basePose: string = "base", character?: string) {
  const [pose, setPoseState] = useState(basePose);
  const [speed, setSpeedState] = useState(1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const setPose = useCallback(
    (name: string, options?: { duration?: number; iterations?: number; speed?: number }) => {
      clearTimeout(timeoutRef.current);
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
          setPoseState(basePose);
          setSpeedState(1);
        }, duration);
      }
    },
    [basePose, character],
  );

  return [pose, setPose, speed] as const;
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
