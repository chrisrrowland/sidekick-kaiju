import type { Cell, Frame, Pose, RenderModel } from "./types.js";
import { trimRenderModel, trimRenderModels } from "./trim.js";

function buildUntrimmedRenderModel(frame: Frame, legend: Record<string, string>): RenderModel {
  const artLines = frame.art.split("\n");
  const maskLines = frame.mask?.split("\n") ?? [];

  const width = Math.max(0, ...artLines.map((line) => line.length));
  const height = artLines.length;

  const rows: Cell[][] = artLines.map((line, rowIndex) => {
    const maskLine = maskLines[rowIndex] ?? "";
    return Array.from(line, (char, colIndex): Cell => {
      const maskChar = maskLine[colIndex];
      const slot = maskChar && maskChar !== " " ? legend[maskChar] : undefined;
      return slot ? { char, slot } : { char };
    });
  });

  return { rows, width, height };
}

/**
 * Compiles a single frame's `art` + `mask` + `legend` into a grid of cells.
 *
 * @remarks
 * Blank border rows/columns are trimmed automatically (via `trimRenderModel`), so
 * `width`/`height` always reflect the frame's real silhouette regardless of any
 * incidental padding left in its `art` string. The result feeds `renderToElement` /
 * `renderToHTMLString`, or a renderer of your own.
 *
 * Building frames of the same pose one at a time this way trims each to its own
 * tightest box independently — right for a single static frame, but it silently
 * erases motion expressed as a plain shift of an otherwise solid/symmetric shape (the
 * re-crop lands on the same box regardless of the shift). Use `buildPoseRenderModels`
 * for a pose whose frames animate that way.
 *
 * @example
 * ```ts
 * const character = getCharacter("monster");
 * const model = buildRenderModel(getPose(character, "base").frames[0], character.legend);
 * // { rows: [...], width: 9, height: 3 }
 * ```
 *
 * @category Advanced
 */
export function buildRenderModel(frame: Frame, legend: Record<string, string> = {}): RenderModel {
  return trimRenderModel(buildUntrimmedRenderModel(frame, legend));
}

/**
 * Compiles every frame of a pose into render models sharing one trim boundary, instead
 * of each frame being cropped to its own tightest box.
 *
 * @remarks
 * `animatePose` and `useSidekick`/`<Sidekick>` call this internally so a pose's frames
 * stay in one consistent frame of reference — reach for it directly only if you're
 * driving frame changes yourself instead of through those.
 *
 * @example
 * ```ts
 * const character = getCharacter("ghost");
 * const models = buildPoseRenderModels(getPose(character, "float"), character.legend);
 * ```
 *
 * @category Advanced
 */
export function buildPoseRenderModels(pose: Pose, legend: Record<string, string> = {}): RenderModel[] {
  const rawModels = pose.frames.map((frame) => buildUntrimmedRenderModel(frame, legend));
  return trimRenderModels(rawModels);
}
