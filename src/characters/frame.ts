import type { Frame } from "../types.js";

/**
 * Authoring helper: joins row-arrays into a `Frame`. Lets a pose's frame list grow by
 * pushing more `frame(...)` calls into an array, rather than needing a uniquely-named
 * constant (`stepFrame2Art`, `stepFrame3Art`, ...) per frame.
 */
export function frame(art: string[], mask?: string[]): Frame {
  return mask ? { art: art.join("\n"), mask: mask.join("\n") } : { art: art.join("\n") };
}
