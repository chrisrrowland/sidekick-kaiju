# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`mascot` is a themeable terminal-art monster/creature library: a framework-agnostic
core (`src/`, zero runtime dependencies) plus a thin React wrapper (`src/react/`).
Although the author is currently the primary (maybe only) consumer, this is meant to be
built and maintained as a genuinely well-architected, flexible npm library — favor
extensible, creative-reuse-friendly design (see the dual CSS-var/`classNames` theming
contract, or the framework-agnostic core with React as an optional layer on top) over
quick single-purpose hacks, even for small changes.

## Commands

- This repo uses pnpm (`packageManager` field in `package.json`) — use `pnpm`, not `npm`,
  for installs and scripts, so the committed `pnpm-lock.yaml` stays authoritative.
- `pnpm run build` — tsup, dual ESM/CJS + `.d.ts`.
- `pnpm test` / `pnpm run test:watch` — vitest.
- `pnpm run playground` — Vite dev server (HMR) that aliases `mascot`/`mascot/react` to
  `src/`, not the built `dist/`. This is the primary tool for iterating on character art
  and animation live; use it (or a scratch Playwright page) to check changes, not just
  the built package.

## Architecture

- A `Character` (`src/characters/*.ts`) is a registry of named `poses`; each `Pose` is
  one or more `Frame`s (`art` + `mask` strings), with `frameDurations` driving looped
  animation. `getPose`/`getCharacter` throw on unknown names with the available list.
- `buildRenderModel(frame, legend)` compiles one frame into a cell grid, and always runs
  it through `trimRenderModel` — blank border rows/columns are stripped automatically.
  Don't hand-pad art for centering purposes; account for this trim when reasoning about
  expected dimensions.
- Build character frames with the `frame()` helper (`src/characters/frame.ts`), which
  bundles `art`+`mask` (and callers pair a `duration`) per frame instead of parallel
  arrays — parallel arrays risk `art`/`mask`/duration arrays silently desyncing in length.
- Theming: per-slot CSS rules in `styles/mascot.css` are wrapped in `:where(...)` so they
  carry zero specificity — any class a host passes via `classNames` wins outright, no
  `!important` needed.

## Hard rule: visually verify character/animation changes

Any change to a character's `art`, `mask`, or animation frames must be visually
confirmed (via `pnpm run playground` or a scratch Playwright preview page) before being
considered complete — reasoning about the glyph strings alone has repeatedly missed real
bugs in this project (asymmetric padding invisible at small sizes, font-rendering
differences between Unicode block glyphs, animation frames that only break after
several pose switches). Do not report art/animation work as done without having
actually rendered it.

## Known gotchas

- **React StrictMode + refs**: never mutate a `ref` during render to reset state in
  response to a changed prop (e.g. resetting frame index when `pose` changes). This
  silently breaks under StrictMode's double-invoked render (used by the playground) —
  compare against previous *state* (`useState`) instead, per React's documented pattern.
- **`vitest.config.ts` is intentionally separate from `vite.config.ts`** — vitest
  auto-loads `vite.config.ts` by default, which would otherwise inherit its
  `root: "playground"` and fail to discover `test/`.
- Quadrant/block-drawing glyphs (`▘▝▖▗▛▜▙▟`) don't render identically across fonts —
  don't assume a visual result from the character data alone (see the hard rule above).

## Publishing status

Not yet published to npm. Install via `npm install github:chrisrrowland/sidekick-kaiju`
— the `prepare` script runs the build automatically for git-based installs.
