import type { Character } from "../types.js";
import { frame } from "./frame.js";

// Dome, built as a 3-step staircase (cap -> neck -> shoulder), each step 4 cols wider
// than the last — same "grow the silhouette by rounding corners with ▄" technique as
// monster/dino's heads, just spread across more rows since the ghost's head is the
// whole upper body rather than a single row.
const CAP_ART = "      ▄██████▄      ";
const NECK_ART = "    ▄██████████▄    ";
const SHOULDER_ART = "   ▄████████████▄   ";
const CAP_MASK = "      bbbbbbbb      ";
const NECK_MASK = "    bbbbbbbbbbbb    ";
const SHOULDER_MASK = "   bbbbbbbbbbbbbb   ";

// Eyes are plain gaps (space glyphs) rather than a glyph like monster/dino's corner
// notches — there's nothing to color, so the "eyes" slot here only matters for the
// background-color half of sidekick.css's eyes rule (a themed host sees two solid eye
// windows; the default is transparent, same as leaving them untouched).
const EYES_ART = "   ███  ████  ███   ";
const EYES_MASK = "   bbbeebbbbeebbb   ";

const TORSO_ART = "   ██████████████   ";
const TORSO_MASK = "   bbbbbbbbbbbbbb   ";

// Closing an eye fills its gap with solid ink, merging it into the surrounding
// silhouette — same "blend into the solid shape" idea as monster/dino's wink, just
// via a filled gap instead of swapping a corner glyph. The mask stays EYES_MASK
// unchanged in both cases (same "keep the slot stable through the blend" reasoning as
// monster's wink — see its comment for why that matters to consumers animating the
// eyes slot).
const EYES_WINK_ART = "   ███  █████████   "; // right eye closed
// Both eyes closed happens to be pixel-identical to a plain torso row (both span the
// same 14-col silhouette), so blink reuses TORSO_ART directly rather than duplicating
// the string.

const HEM_REST_ART = "   ▜▛▜▛▜▛▜▛▜▛▜▛▜▛   ";
// Masking is by column, not by which glyph (▜/▛) currently sits there — same
// column-not-glyph masking monster's arm row uses, since the hem's ink columns never
// move within a frame, only which glyph occupies each one.
const HEM_REST_MASK = "   llllllllllllll   ";

const baseFrame = frame(
  [CAP_ART, NECK_ART, SHOULDER_ART, EYES_ART, TORSO_ART, TORSO_ART, TORSO_ART, HEM_REST_ART],
  [CAP_MASK, NECK_MASK, SHOULDER_MASK, EYES_MASK, TORSO_MASK, TORSO_MASK, TORSO_MASK, HEM_REST_MASK],
);

// The `float` pose: the whole body (dome + eyes + torso) darts 1 column right as a
// rigid unit while the hem lags a beat behind, then the hem catches up and they're
// briefly aligned "out", then the body snaps back to rest while the hem again trails
// a beat behind (now on the other side) before catching back up to rest on the loop's
// wrap-around. This reads as momentum/drag on the sheet rather than the body and hem
// moving in lockstep.
//
// Every row below is a literal string, not a computed shift — earlier attempts to
// derive all of these from one shared "shift by N columns" helper kept breaking a
// different row family every time another was fixed (the dome's ▄ rounding, the eyes'
// small isolated segments, and the hem's independent lag all need different sub-cell
// treatment), so each frame is authored and visually verified independently instead.
const leadFrame = frame(
  [
    "       ▄██████▄     ",
    "     ▄██████████▄   ",
    "    ▄████████████▄  ",
    "    ███  ████  ███  ",
    "    ██████████████  ",
    "    ██████████████  ",
    "    ██████████████  ",
    // hem still at rest position: left edge stripped (no overhang past the torso's
    // new, further-right left edge), right edge padded with ▀ to stay flush with the
    // torso's new right edge.
    "    ▛▜▛▜▛▜▛▜▛▜▛▜▛▀  ",
  ],
  [
    "       bbbbbbbb     ",
    "     bbbbbbbbbbbb   ",
    "    bbbbbbbbbbbbbb  ",
    "    bbbeebbbbeebbb  ",
    "    bbbbbbbbbbbbbb  ",
    "    bbbbbbbbbbbbbb  ",
    "    bbbbbbbbbbbbbb  ",
    "    llllllllllllll  ",
  ],
);

const outFrame = frame(
  [
    "       ▄██████▄     ",
    "     ▄██████████▄   ",
    "    ▄████████████▄  ",
    "    ███  ████  ███  ",
    "    ██████████████  ",
    "    ██████████████  ",
    "    ██████████████  ",
    "    ▜▛▜▛▜▛▜▛▜▛▜▛▜▛  ", // hem has caught up, aligned with the body again
  ],
  [
    "       bbbbbbbb     ",
    "     bbbbbbbbbbbb   ",
    "    bbbbbbbbbbbbbb  ",
    "    bbbeebbbbeebbb  ",
    "    bbbbbbbbbbbbbb  ",
    "    bbbbbbbbbbbbbb  ",
    "    bbbbbbbbbbbbbb  ",
    "    llllllllllllll  ",
  ],
);

const trailFrame = frame(
  [
    "      ▄██████▄      ",
    "    ▄██████████▄    ",
    "   ▄████████████▄   ",
    "   ███  ████  ███   ",
    "   ██████████████   ",
    "   ██████████████   ",
    "   ██████████████   ",
    // body has snapped back to rest; hem still trailing at its "out" position: right
    // edge stripped (no overhang past the torso's new, further-left right edge), left
    // edge padded with ▀ to stay flush with the torso's new left edge.
    "   ▀▜▛▜▛▜▛▜▛▜▛▜▛▜   ",
  ],
  [
    "      bbbbbbbb      ",
    "    bbbbbbbbbbbb    ",
    "   bbbbbbbbbbbbbb   ",
    "   bbbeebbbbeebbb   ",
    "   bbbbbbbbbbbbbb   ",
    "   bbbbbbbbbbbbbb   ",
    "   bbbbbbbbbbbbbb   ",
    "   llllllllllllll   ",
  ],
);

const winkFrame = frame(
  [CAP_ART, NECK_ART, SHOULDER_ART, EYES_WINK_ART, TORSO_ART, TORSO_ART, TORSO_ART, HEM_REST_ART],
  [CAP_MASK, NECK_MASK, SHOULDER_MASK, EYES_MASK, TORSO_MASK, TORSO_MASK, TORSO_MASK, HEM_REST_MASK],
);

const blinkFrame = frame(
  [CAP_ART, NECK_ART, SHOULDER_ART, TORSO_ART, TORSO_ART, TORSO_ART, TORSO_ART, HEM_REST_ART],
  [CAP_MASK, NECK_MASK, SHOULDER_MASK, EYES_MASK, TORSO_MASK, TORSO_MASK, TORSO_MASK, HEM_REST_MASK],
);

/** @internal */
export const ghost = {
  name: "ghost",
  legend: {
    b: "body",
    e: "eyes",
    l: "legs",
  },
  poses: {
    base: {
      frames: [baseFrame],
      frameDurations: [0],
    },
    // Loops rest -> lead -> out -> trail -> (wraps back to rest), a 4-frame cycle with
    // no duplicate adjacent frames — the wrap from trail back to rest is itself the
    // final "hem catches up" step, so no 5th frame is needed. Durations are ~1/3
    // slower than the initially-tuned 260/180/260/180, since the faster pace read as
    // too twitchy for a floating (rather than walking) motion.
    float: {
      frames: [baseFrame, leadFrame, outFrame, trailFrame],
      frameDurations: [350, 240, 350, 240],
    },
    // One eye closes and reopens — same timing shape as monster/dino's wink (quick
    // close, held beat, quick open), reusing their exact durations for consistency.
    wink: {
      frames: [baseFrame, winkFrame, baseFrame],
      frameDurations: [90, 380, 90],
    },
    // Both eyes close at once, faster and without the held beat a one-eyed wink gets
    // — a real blink is a quick reflex, not a deliberate gesture held for effect.
    blink: {
      frames: [baseFrame, blinkFrame, baseFrame],
      frameDurations: [80, 100, 80],
    },
  },
} satisfies Character;
