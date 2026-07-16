---
name: create-mascot-character
description: Author a new mascot character (or add a pose/animation to an existing one) in src/characters/*.ts. Trigger this whenever the request involves creating, designing, or sketching a new creature/character/mascot for this library, or giving an existing one a new pose, gesture, or animation (e.g. "make it wave", "add a sleeping pose", "let's do a third mascot") — even if the user doesn't say "skill" or use these exact words. Covers how legends, slots, frames, and poses fit together, and what "done" requires (registration in the character index, dimension tests, optional CSS slot rules, and mandatory visual verification).
---

Two characters (`monster`, `dino`) already establish the idiom this project expects. A
new character should read like a sibling of those, not a one-off. This skill is the
checklist and mental model; `verify-mascot-art` is the rendering/verification mechanics
— always finish through that skill, don't treat "the code compiles" as done.

## Mental model

- A `Character` (`src/types.ts`) is `{ name, legend, poses }`. `legend` maps single
  mask characters (e.g. `b`, `e`, `l`, `a`) to slot names (`"body"`, `"eyes"`, ...).
  Slot names are theming hooks — `styles/mascot.css` and host `classNames`/CSS vars key
  off them, so pick slots by *what a consumer would want to style independently*, not
  by anatomical literalism (a tail that never moves and is never re-themed separately
  from the body doesn't need its own slot).
- A `Pose` is `{ frames: Frame[], frameDurations: number[] }`, same length arrays. Use
  the `frame(artRows: string[], maskRows: string[])` helper (`src/characters/frame.ts`)
  to build each `Frame` — never hand-join `\n` strings or maintain `art`/`mask` as
  separate parallel arrays.
- Every character must have a `base` pose. `base` is what other poses' unchanged rows
  get built from (e.g. `monster.ts`'s `bodyFrame(armRow, legsArt, legsMask)` composes
  variants by swapping only the row that changes) — don't redefine the whole grid per
  pose from scratch.
- `frameDurations: [0]` on a single-frame pose means "static, never auto-advance."
  Multi-frame poses loop back to frame 0 after the last frame.
- `art`/`mask` lines must be equal width across all rows *within a frame*, and mask
  dimensions must match art dimensions exactly — `buildRenderModel` pairs them
  positionally. Blank border rows/cols are auto-trimmed (`trimRenderModel`), so don't
  hand-pad for centering.

## Steps

1. **Design the silhouette on paper/scratch first.** Sketch the character as plain
   glyph rows (a `node -e` print or scratch file) before touching `src/characters/`.
   Decide the grid size and which rows are static vs. animated.
2. **Define the legend.** Reuse `body`/`eyes`/`legs`/`arms` where the new character
   genuinely has analogous parts (keeps cross-character theming consistent for
   consumers who style "eyes" once and expect it to apply everywhere). Only introduce a
   new slot name if the part needs independent styling — and if you do, add a
   `[data-slot="..."]` rule to `styles/mascot.css` alongside the existing ones (a slot
   with no CSS rule still renders, just via the generic `[data-slot]` fallback — that's
   fine as a starting point but check whether the new part actually needs its own rule).
3. **Build the `base` pose first**, as a single static frame. Get this visually right
   (see `verify-mascot-art`) before building any animated pose on top of it — every
   other pose composes from `base`'s rows.
4. **Add poses incrementally**, one at a time, each verified before moving to the next.
   Look at how `monster.ts`/`dino.ts` build variants: swap one row at a time via a small
   composing helper (`bodyFrame`, `chompFrame`) rather than restating the full frame,
   and comment *why* a glyph choice reads as the intended motion (e.g. which corner
   glyph swap reads as a wink, which up/down glyph pair reads as a raised limb) — these
   are non-obvious from the glyphs alone and this project's existing files always
   explain the trick being used.
5. **Register the character** in `src/characters/index.ts` (import + add to the
   `characters` record + re-export), so `getCharacter`/`poseNames`/`slotNames`/
   `describeCharacter` all pick it up automatically — don't maintain a second list.
6. **Run `npm test`.** `buildRenderModel.test.ts` iterates every frame of every pose of
   every registered character checking art/mask dimension consistency — this will catch
   width mismatches you introduced, but it cannot catch whether the art *looks* right.
7. **Visually verify** — invoke `verify-mascot-art` for every frame and every pose,
   including switching between poses/characters rapidly. This is not optional; do not
   report the character as done without having rendered it.
8. Check the playground (`npm run playground`) picks up the new character/poses in its
   character/pose pickers without further wiring — if it doesn't, something is missing
   from step 5, not a playground-specific fix.
