import { buildPoseRenderModels } from "./buildRenderModel.js";
import { getIterationsDuration, getPose } from "./poses.js";
import { toRuns } from "./render-runs.js";
import type { Character, ClassNames, RenderModel } from "./types.js";

export interface RenderOptions {
  /** Root element class, plus per-slot classes the host app already owns. */
  classNames?: ClassNames;
}

/** Falls back to this when `animatePose`'s `maxQueueLength` isn't given — high enough
 * that no real animation sequence should ever hit it, low enough to catch a runaway
 * event source (a chatty websocket, a bug in the caller) before its queue silently grows
 * unbounded. Pass `Infinity` to opt out of the cap entirely. */
export const DEFAULT_MAX_QUEUE_LENGTH = 1000;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Renders a render model to an HTML string.
 *
 * @remarks
 * For SSR or other non-DOM environments — the string-building equivalent of
 * `renderToElement`. Build the model first with `buildRenderModel`.
 *
 * @example
 * ```ts
 * const model = buildRenderModel(getPose(character, "base").frames[0], character.legend);
 * renderToHTMLString(model); // '<div class="sidekick"><pre class="sidekick__art">...'
 * ```
 *
 * @category Advanced
 */
export function renderToHTMLString(model: RenderModel, options: RenderOptions = {}): string {
  const { classNames = {} } = options;
  const rootClass = ["sidekick", classNames.root].filter(Boolean).join(" ");

  const lines = model.rows.map((row) =>
    toRuns(row)
      .map((run) => {
        const text = escapeHtml(run.text);
        if (!run.slot) return text;
        const slotClass = classNames[run.slot];
        const classAttr = slotClass ? ` class="${slotClass}"` : "";
        return `<span data-slot="${run.slot}"${classAttr}>${text}</span>`;
      })
      .join(""),
  );

  return `<div class="${rootClass}"><pre class="sidekick__art">${lines.join("\n")}</pre></div>`;
}

/**
 * Renders a render model into a target DOM element, replacing its contents.
 *
 * @remarks
 * The static, one-shot render primitive `animatePose` calls on every frame — reach for
 * `animatePose` instead unless you're driving frame changes yourself.
 *
 * @example
 * ```ts
 * const model = buildRenderModel(getPose(character, "base").frames[0], character.legend);
 * renderToElement(model, document.getElementById("app"));
 * ```
 *
 * @category Common
 */
export function renderToElement(
  model: RenderModel,
  target: HTMLElement,
  options: RenderOptions = {},
): void {
  const { classNames = {} } = options;

  target.replaceChildren();
  target.classList.add("sidekick");
  if (classNames.root) target.classList.add(classNames.root);

  const pre = document.createElement("pre");
  pre.className = "sidekick__art";

  model.rows.forEach((row, rowIndex) => {
    if (rowIndex > 0) pre.appendChild(document.createTextNode("\n"));
    for (const run of toRuns(row)) {
      if (!run.slot) {
        pre.appendChild(document.createTextNode(run.text));
        continue;
      }
      const span = document.createElement("span");
      span.dataset.slot = run.slot;
      const slotClass = classNames[run.slot];
      if (slotClass) span.className = slotClass;
      span.textContent = run.text;
      pre.appendChild(span);
    }
  });

  target.appendChild(pre);
}

export interface SetPoseOptions {
  /** ms before automatically reverting to the pose animatePose was started with. */
  duration?: number;
  /**
   * Revert to the starting pose after playing through the pose's frames this many
   * times, instead of looping or holding — `{ iterations: 1 }` is "play once". Takes
   * precedence over `duration` if both are given, since it needs to land on a loop
   * boundary rather than an arbitrary wall-clock time.
   */
  iterations?: number;
  /**
   * Playback speed multiplier for this pose invocation — `0.5` makes every frame last
   * twice as long, `2` makes them last half as long. Defaults to 1. Reverting (from
   * `duration` or `iterations`) resets speed back to 1 for the pose it reverts to.
   */
  speed?: number;
  /**
   * Wait for the currently-playing timed pose (one started with `duration` or
   * `iterations`) to finish before switching, instead of interrupting it. Queued poses
   * play in the order they were queued (FIFO), each keeping its own options, up to
   * `animatePose`'s `maxQueueLength` (see `AnimatePoseOptions`). If nothing is currently
   * mid-animation (holding indefinitely, or already back at the base pose), plays
   * immediately, same as a normal `setPose`. A plain (non-queued) `setPose` call always
   * clears the whole queue.
   */
  queue?: boolean;
}

/** One entry waiting in a `PoseController`'s queue — the pose name plus whatever
 * options its `setPose(name, { queue: true, ... })` call was given. */
export interface QueuedPose {
  name: string;
  options?: SetPoseOptions;
}

export interface AnimatePoseOptions extends RenderOptions {
  /**
   * Safety cap on how many poses can be waiting in the queue at once (see
   * `SetPoseOptions.queue`) — once hit, further `{ queue: true }` calls are silently
   * dropped rather than growing the queue further. Defaults to `DEFAULT_MAX_QUEUE_LENGTH`
   * (1000). Pass `Infinity` to opt out of the cap entirely. Check `controller.getQueued()
   * .length` before queueing if you want to throttle proactively instead of relying on
   * this cap.
   */
  maxQueueLength?: number;
}

export interface PoseController {
  /** Switches to a pose immediately (or waits behind the current one with
   * `{ queue: true }`); a pending revert from a previous non-queued `setPose` call is
   * replaced, not stacked. */
  setPose(name: string, options?: SetPoseOptions): void;
  /** The poses waiting behind the current one, oldest (next up) first — each with the
   * options its own `{ queue: true }` call was given. Empty if nothing's queued. Useful
   * for a host app that wants to show "up next" UI. */
  getQueued(): QueuedPose[];
  /** Stops frame/revert timers and clears the queue. Does not clear the target's current
   * contents. */
  stop(): void;
}

/**
 * Vanilla-DOM equivalent of the React `useSidekick` + `useSidekickPose` pair.
 *
 * @remarks
 * Renders `character`'s `poseName` into `target` (via `renderToElement`), animating
 * between frames per the pose's `frameDurations`, and returns a controller for
 * switching poses (optionally with a timed revert back to the starting pose).
 *
 * @example
 * ```ts
 * const controller = animatePose(getCharacter("monster"), "base", document.getElementById("app"));
 * controller.setPose("step", { duration: 2000 }); // auto-reverts to "base" after 2s
 * controller.setPose("wink", { iterations: 2, speed: 0.5 }); // two slow-motion blinks
 * controller.setPose("celebrate", { queue: true, iterations: 1 }); // waits for wink
 * controller.setPose("chomp", { queue: true, iterations: 1 }); // waits for celebrate too
 * controller.getQueued(); // [{ name: "celebrate", ... }, { name: "chomp", ... }]
 * controller.stop(); // when done
 * ```
 *
 * @category Common
 */
export function animatePose(
  character: Character,
  poseName: string,
  target: HTMLElement,
  options: AnimatePoseOptions = {},
): PoseController {
  const { maxQueueLength = DEFAULT_MAX_QUEUE_LENGTH, ...renderOptions } = options;
  const basePose = poseName;
  let currentPoseName = poseName;
  let currentSpeed = 1;
  let frameIndex = 0;
  let currentModels: RenderModel[] = buildPoseRenderModels(getPose(character, currentPoseName), character.legend);
  let frameTimer: ReturnType<typeof setTimeout> | undefined;
  let revertTimer: ReturnType<typeof setTimeout> | undefined;
  let queued: QueuedPose[] = [];

  function render() {
    renderToElement(currentModels[frameIndex], target, renderOptions);
  }

  function scheduleNextFrame() {
    clearTimeout(frameTimer);
    const pose = getPose(character, currentPoseName);
    if (pose.frames.length <= 1) return;
    const duration = pose.frameDurations[frameIndex];
    if (!duration) return; // 0/undefined means hold this frame indefinitely
    frameTimer = setTimeout(() => {
      frameIndex = (frameIndex + 1) % pose.frames.length;
      render();
      scheduleNextFrame();
    }, duration / currentSpeed);
  }

  // The actual pose switch, shared by immediate setPose calls and by a queued pose
  // taking over once the pose it was waiting behind reverts.
  function applyPose(name: string, setPoseOptions?: SetPoseOptions): void {
    clearTimeout(frameTimer);
    clearTimeout(revertTimer);
    revertTimer = undefined;
    currentPoseName = name;
    currentModels = buildPoseRenderModels(getPose(character, currentPoseName), character.legend);
    currentSpeed = setPoseOptions?.speed ?? 1;
    frameIndex = 0;
    render();
    scheduleNextFrame();
    const duration = setPoseOptions?.iterations
      ? getIterationsDuration(character, name, setPoseOptions.iterations, currentSpeed)
      : setPoseOptions?.duration;
    if (duration) {
      revertTimer = setTimeout(onRevert, duration);
    }
  }

  // Fires when a timed pose's duration/iterations elapse — hands off to the next queued
  // pose (FIFO), or falls back to the original revert-to-base behavior once the queue's
  // empty.
  function onRevert(): void {
    const next = queued.shift();
    if (next) {
      applyPose(next.name, next.options);
    } else {
      applyPose(basePose);
    }
  }

  function setPose(name: string, setPoseOptions?: SetPoseOptions): void {
    if (setPoseOptions?.queue && revertTimer) {
      // Past the cap, the queue attempt is silently dropped — check `getQueued().length`
      // before queueing if a caller wants to throttle proactively instead.
      if (queued.length >= maxQueueLength) return;
      queued.push({ name, options: setPoseOptions });
      return;
    }
    queued = [];
    applyPose(name, setPoseOptions);
  }

  render();
  scheduleNextFrame();

  return {
    setPose,
    getQueued() {
      return [...queued];
    },
    stop() {
      clearTimeout(frameTimer);
      clearTimeout(revertTimer);
      queued = [];
    },
  };
}
