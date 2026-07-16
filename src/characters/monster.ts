import type { Character } from "../types.js";
import { frame } from "./frame.js";

// Head row never changes across any pose/frame, except during a wink (below).
const HEAD_ART = " ▐▛███▜▌ ";
const HEAD_MASK = " bebbbeb ";

// Winking right eye: the ▜ corner glyph that reads as the open eye is swapped for a
// plain █, blending that pixel into the solid head silhouette — the same trick as a
// sprite's eye pixel recoloring to match its lid when closed. The mask keeps that cell
// tagged "eyes" (not "body") even though it's visually blended: `mascot.css`'s default
// eyes rule colors the glyph itself body-color, so a solid █ still blends in on its own
// — no need to relabel the slot for that. Keeping the slot stable also matters for
// consumers who put a host-owned class/animation on the eyes slot (see the playground's
// classNames demo): retagging this cell "body" mid-pose would change its `data-slot`
// and class list, which — since runs merge adjacent same-slot cells — also changes how
// many runs the row splits into, so React (keyed by run position) tears down and
// recreates the span instead of updating it in place, restarting any CSS animation on
// it. Leaving the slot alone keeps the same span alive across the whole wink.
const HEAD_ART_WINK = " ▐▛████▌ ";
const HEAD_MASK_WINK = HEAD_MASK;

// The outer tips of the wide row (col0/col8) are the only parts of the silhouette that
// stick out past the narrower head row above them, so they're tagged as arms; the mask
// is the same regardless of which up/down glyph variant occupies those columns, since
// masking is by column, not by which specific glyph is there.
const ARM_MASK = "abbbbbbba";

// The 4 up/down variants of the arm row, built with the same "swap glyph within its
// cell" technique used for legs (see the `step` pose below), just on the vertical axis
// instead of horizontal — ▛/▘ sit in the upper half of their cell, ▙/▖ in the lower half.
const ARM_NEUTRAL = "▝▜█████▛▘";
const ARM_LEFT_DOWN = "▗▟█████▛▘";
const ARM_BOTH_DOWN = "▗▟█████▙▖";
const ARM_RIGHT_DOWN = "▝▜█████▙▖";

function bodyFrame(armRow: string, legsArt: string, legsMask: string) {
  return frame([HEAD_ART, armRow, legsArt], [HEAD_MASK, ARM_MASK, legsMask]);
}

const baseFrame = bodyFrame(ARM_NEUTRAL, "  ▘▘ ▝▝  ", "  ll ll  ");

// Same neutral stance as `baseFrame`, just with the wink head row instead — used as the
// middle frame of the `wink` pose.
const winkFrame = frame(
  [HEAD_ART_WINK, ARM_NEUTRAL, "  ▘▘ ▝▝  "],
  [HEAD_MASK_WINK, ARM_MASK, "  ll ll  "],
);

/** @internal */
export const monster = {
  name: "monster",
  legend: {
    b: "body",
    e: "eyes",
    l: "legs",
    a: "arms",
  },
  poses: {
    base: {
      frames: [baseFrame],
      frameDurations: [0],
    },
    // 4-phase gait: legs 2&4 (right legs) lead out, then all legs sync, then legs 1&3
    // (left legs) lead the return, before the whole cycle snaps back to base — see the
    // legs comment history in git for how the leg glyph-flip technique was validated.
    // Arms stay neutral throughout — the arm-swing variants below read as celebrating/
    // dancing rather than walking, so they live on the `celebrate` pose instead.
    step: {
      frames: [
        baseFrame,
        bodyFrame(ARM_NEUTRAL, "  ▘▝ ▝▘  ", "  ll ll  "),
        bodyFrame(ARM_NEUTRAL, "  ▝▝ ▘▘  ", "  ll ll  "),
        bodyFrame(ARM_NEUTRAL, "  ▝▘ ▘▝  ", "  ll ll  "),
      ],
      frameDurations: [220, 220, 220, 220],
    },
    // Same arm up/down cycle originally tried for walking — legs stay planted at base
    // the whole time, only the arms swing, which reads as celebrating rather than a gait.
    celebrate: {
      frames: [
        baseFrame,
        bodyFrame(ARM_LEFT_DOWN, "  ▘▘ ▝▝  ", "  ll ll  "),
        bodyFrame(ARM_BOTH_DOWN, "  ▘▘ ▝▝  ", "  ll ll  "),
        bodyFrame(ARM_RIGHT_DOWN, "  ▘▘ ▝▝  ", "  ll ll  "),
      ],
      frameDurations: [220, 220, 220, 220],
    },
    // A blink of the right eye, held long enough to read as a deliberate wink rather
    // than a flicker. Meant to be triggered as a one-shot via `setPose("wink", { once:
    // true })` / `animatePose`'s `{ once: true }` — the last frame is `baseFrame`
    // itself, so the auto-revert back to base is seamless.
    wink: {
      frames: [baseFrame, winkFrame, baseFrame],
      frameDurations: [90, 380, 90],
    },
  },
} satisfies Character;
