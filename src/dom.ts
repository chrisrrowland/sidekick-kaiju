import { buildPoseRenderModels } from "./buildRenderModel.js";
import { getIterationsDuration, getPose } from "./poses.js";
import { toRuns } from "./render-runs.js";
import type { Character, ClassNames, RenderModel } from "./types.js";

export interface RenderOptions {
  /** Root element class, plus per-slot classes the host app already owns. */
  classNames?: ClassNames;
}

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
 * renderToHTMLString(model); // '<div class="mascot"><pre class="mascot__art">...'
 * ```
 *
 * @category Advanced
 */
export function renderToHTMLString(model: RenderModel, options: RenderOptions = {}): string {
  const { classNames = {} } = options;
  const rootClass = ["mascot", classNames.root].filter(Boolean).join(" ");

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

  return `<div class="${rootClass}"><pre class="mascot__art">${lines.join("\n")}</pre></div>`;
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
  target.classList.add("mascot");
  if (classNames.root) target.classList.add(classNames.root);

  const pre = document.createElement("pre");
  pre.className = "mascot__art";

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
}

export interface PoseController {
  /** Switches to a pose immediately; a pending revert from a previous `setPose` call
   * (if any) is replaced, not stacked. */
  setPose(name: string, options?: SetPoseOptions): void;
  /** Stops frame/revert timers. Does not clear the target's current contents. */
  stop(): void;
}

/**
 * Vanilla-DOM equivalent of the React `useMascot` + `useMascotPose` pair.
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
 * controller.stop(); // when done
 * ```
 *
 * @category Common
 */
export function animatePose(
  character: Character,
  poseName: string,
  target: HTMLElement,
  options: RenderOptions = {},
): PoseController {
  const basePose = poseName;
  let currentPoseName = poseName;
  let currentSpeed = 1;
  let frameIndex = 0;
  let currentModels: RenderModel[] = buildPoseRenderModels(getPose(character, currentPoseName), character.legend);
  let frameTimer: ReturnType<typeof setTimeout> | undefined;
  let revertTimer: ReturnType<typeof setTimeout> | undefined;

  function render() {
    renderToElement(currentModels[frameIndex], target, options);
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

  function setPose(name: string, setPoseOptions?: SetPoseOptions): void {
    clearTimeout(frameTimer);
    clearTimeout(revertTimer);
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
      revertTimer = setTimeout(() => setPose(basePose), duration);
    }
  }

  render();
  scheduleNextFrame();

  return {
    setPose,
    stop() {
      clearTimeout(frameTimer);
      clearTimeout(revertTimer);
    },
  };
}
