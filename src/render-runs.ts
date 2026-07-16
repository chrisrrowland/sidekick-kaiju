import type { Cell, CellRun } from "./types.js";

/**
 * Groups consecutive cells in a row that share a slot into single runs.
 *
 * @remarks
 * What both `<Mascot>` and `renderToElement`/`renderToHTMLString` use internally to
 * turn a render-model row into `<span data-slot="...">` runs instead of one element per
 * character. Reach for it directly only when writing a custom renderer.
 *
 * @category Advanced
 */
export function toRuns(row: Cell[]): CellRun[] {
  const runs: CellRun[] = [];
  for (const cell of row) {
    const last = runs[runs.length - 1];
    if (last && last.slot === cell.slot) {
      last.text += cell.char;
    } else {
      runs.push({ text: cell.char, slot: cell.slot });
    }
  }
  return runs;
}
