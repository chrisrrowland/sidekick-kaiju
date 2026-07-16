---
name: verify-mascot-art
description: Visually verify character art, masks, or animation/pose frames in mascot before considering the change complete. Use whenever art/mask data in src/characters/*.ts changes, or a new pose/frame is authored — never report art/animation work as done without having actually rendered it.
---

Reasoning about glyph strings alone has repeatedly missed real bugs in this project:
asymmetric padding invisible at small sizes, quadrant glyphs (`▘▝▖▗▛▜▙▟`) rendering
differently than expected, animation frames that collide or drift only after several
transitions. Always render the actual change before calling it done.

## For a single static frame (new/changed `art`+`mask`)

1. Print the raw glyphs with `node -e` or the Bash tool first, to sanity-check row
   lengths and column alignment match your intent.
2. Use the Playwright browser tool to render the exact string (a scratch `about:blank`
   page with a `<pre>` at a large `font-size`, e.g. 80–120px, is enough to spot
   misalignment that's invisible at typical small sizes).
3. Screenshot and actually look at it — don't infer symmetry/alignment from the text.

## For a multi-frame pose/animation

1. Build candidate frames as plain strings first and preview the *sequence* — animate a
   scratch `<pre>` with `setInterval`/manual `textContent` swaps, or step through frames
   one at a time via repeated `browser_evaluate` + `browser_take_screenshot` calls, so
   you see the actual frame-to-frame transition, not just each frame in isolation.
2. Check for the specific failure modes this project has hit before: a leg/limb
   silently disappearing (deleting a glyph instead of repositioning it), two moving
   parts landing on the same column (a real collision, not just a design choice), or a
   part drifting outside the character's silhouette over the course of the cycle.
3. Once a candidate looks right in isolation, wire it into the real character file
   (`src/characters/*.ts`), rebuild (`pnpm run build`), and confirm `pnpm test` still
   passes (the dimension tests iterate every frame of every pose automatically).
4. Verify it live: run/attach to `pnpm run playground`, trigger the pose via its button,
   and poll the rendered `.sidekick__art` textContent (or screenshot) across multiple
   frames to confirm the live, HMR'd result matches what was previewed in isolation —
   the built package can behave differently than a scratch page (e.g. React StrictMode
   double-rendering effects only manifest in the real component tree).
5. If switching between poses/characters is part of the change, specifically test
   rapid/repeated switching (not just one transition) — timing-dependent bugs in this
   codebase have only shown up after several toggles.
