import type { Cell, RenderModel } from "./types.js";

function isBlank(cell: Cell | undefined): boolean {
  return !cell || cell.char === " ";
}

function isBlankRow(row: Cell[]): boolean {
  return row.every(isBlank);
}

function isBlankColumn(rows: Cell[][], col: number): boolean {
  return rows.every((row) => isBlank(row[col]));
}

interface TrimBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function computeBounds(rows: Cell[][]): TrimBounds {
  let top = 0;
  while (top < rows.length && isBlankRow(rows[top])) top++;
  let bottom = rows.length;
  while (bottom > top && isBlankRow(rows[bottom - 1])) bottom--;

  const width = Math.max(0, ...rows.map((row) => row.length));

  let left = 0;
  while (left < width && isBlankColumn(rows, left)) left++;
  let right = width;
  while (right > left && isBlankColumn(rows, right - 1)) right--;

  return { top, bottom, left, right };
}

function applyBounds(rows: Cell[][], bounds: TrimBounds): RenderModel {
  if (bounds.bottom <= bounds.top || bounds.right <= bounds.left) {
    return { rows: [], width: 0, height: 0 };
  }
  const trimmedRows = rows
    .slice(bounds.top, bounds.bottom)
    .map((row) => row.slice(bounds.left, bounds.right));
  return { rows: trimmedRows, width: bounds.right - bounds.left, height: trimmedRows.length };
}

/**
 * Strips fully-blank rows/columns from a render model's *edges* only.
 *
 * @remarks
 * Internal negative space (e.g. the gap between a character's legs) is never touched,
 * since those rows/columns aren't blank across every row/column. This keeps a
 * character's reported width/height an accurate measure of its actual silhouette,
 * regardless of incidental padding left in its `art`. `buildRenderModel` already calls
 * this for you — reach for it directly only if you're constructing a `RenderModel` by
 * hand instead of from a `Frame`.
 *
 * @category Advanced
 */
export function trimRenderModel(model: RenderModel): RenderModel {
  if (model.rows.length === 0) return { rows: [], width: 0, height: 0 };
  return applyBounds(model.rows, computeBounds(model.rows));
}

/**
 * Trims multiple render models to one *shared* bounding box, instead of each being
 * cropped to its own tightest edges.
 *
 * @remarks
 * A row/column is only cropped away if it's blank in *every* model passed in — not
 * just blank in the one being trimmed. This matters for a pose whose frames animate by
 * shifting an otherwise solid/symmetric shape sideways (or up/down): trimmed
 * independently, each frame re-crops to the same tightest box regardless of the
 * shift, silently erasing the very motion the frames exist to show. `animatePose` and
 * `useSidekick`/`<Sidekick>` already call this (via `buildPoseRenderModels`) so every
 * frame of a pose shares one consistent frame of reference — reach for it directly
 * only if you're building `RenderModel`s by hand instead of from a `Pose`.
 *
 * @category Advanced
 */
export function trimRenderModels(models: RenderModel[]): RenderModel[] {
  const nonEmpty = models.filter((model) => model.rows.length > 0);
  if (nonEmpty.length === 0) return models.map(() => ({ rows: [], width: 0, height: 0 }));

  const allBounds = nonEmpty.map((model) => computeBounds(model.rows));
  const shared: TrimBounds = {
    top: Math.min(...allBounds.map((b) => b.top)),
    bottom: Math.max(...allBounds.map((b) => b.bottom)),
    left: Math.min(...allBounds.map((b) => b.left)),
    right: Math.max(...allBounds.map((b) => b.right)),
  };

  return models.map((model) =>
    model.rows.length === 0 ? model : applyBounds(model.rows, shared),
  );
}
