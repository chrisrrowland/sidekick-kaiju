import type { Character } from "../types.js";
import { frame } from "./frame.js";

const artRows = [
  "           ████████  ",
  "          ███▄███████",
  "          ███████████",
  "          ███████████",
  "          ██████     ",
  "          █████████  ",
  "█       ███████      ",
  "██    ████████████   ",
  "███  ██████████  █   ",
  "███████████████      ",
  "███████████████      ",
  " █████████████       ",
  "  ███████████        ",
  "    ████████         ",
  "     ███  ██         ",
  "     ██    █         ",
  "     █     █         ",
  "     ██    ██        ",
];

const maskRows = [
  "           bbbbbbbb  ",
  "          bbbebbbbbbb",
  "          bbbbbbbbbbb",
  "          bbbbbbbbbbb",
  "          bbbbbb     ",
  "          bbbbbbbbb  ",
  "b       bbbbbbb      ",
  "bb    bbbbbbbbbaaa   ",
  "bbb  bbbbbbbbbb  a   ",
  "bbbbbbbbbbbbbbb      ",
  "bbbbbbbbbbbbbbb      ",
  " bbbbbbbbbbbbb       ",
  "  bbbbbbbbbbb        ",
  "    bbbbbbbb         ",
  "     lll  ll         ",
  "     ll    l         ",
  "     l     l         ",
  "     ll    ll        ",
];

// Row 7's rightmost 3 columns (the shoulder) and row 8's single trailing column (the
// tucked-in hand) read as the little T-rex forearm once separated from the body mask —
// visible as its own detached blob because row 8's main torso silhouette narrows and
// leaves that column stranded.

const baseFrame = frame(artRows, maskRows);

// The eye (row 1, col 13) is a ▄ sitting in an otherwise solid run of the head — the
// same "negative-space notch" trick the monster's eyes use, just via a half block
// instead of a quadrant. Closing it swaps that glyph for a plain █, blending it into
// the head, same as the monster's wink; the mask stays "eyes" (not "body") for the same
// reason it does there — see monster.ts's wink comment for why that matters for
// consumers animating the eyes slot.
const winkArtRows = [...artRows];
winkArtRows[1] = "          ███████████";
const winkFrame = frame(winkArtRows, maskRows);

// Jaw rows (4 and 5) for the chomp cycle. ▄/▀ half-blocks give a sub-cell in-between
// step that a blunt full-glyph swap can't — a plain notch cut into row 4 or row 5 alone
// wasn't a big enough silhouette change to read as biting at this size, but stacking a
// "bottom half filled" row 4 directly over a "top half filled" row 5 reads as a thin
// ledge dropping out from the jaw before it swings open, instead of jumping straight
// from closed to open. MASK9/MASK6 track how far right each row's ink actually
// extends (9 or 6 cols), which is all that changes between the two — same "keep the
// glyph in the same slot the whole time" reasoning as the eyes/wink code above, just
// keyed to ink width here instead of a fixed column, since these rows resize instead of
// swapping a single glyph in place.
const MASK6 = "          bbbbbb     ";
const MASK9 = "          bbbbbbbbb  ";

function chompFrame(row4Art: string, row5Art: string, row4Mask: string, row5Mask: string) {
  const chompArtRows = [...artRows];
  chompArtRows[4] = row4Art;
  chompArtRows[5] = row5Art;
  const chompMaskRows = [...maskRows];
  chompMaskRows[4] = row4Mask;
  chompMaskRows[5] = row5Mask;
  return frame(chompArtRows, chompMaskRows);
}

// F2/F6: a thin ▄-over-▀ ledge starts to drop out of the closed jaw.
const chompDropping = chompFrame(
  "          ██████▄▄▄  ",
  "          ██████▀▀▀  ",
  MASK9,
  MASK9,
);
// F3/F5: fully open — row 4 and row 5's ink widths swap relative to the closed pose.
// Row 4's last 2 cols step down to ▀ instead of staying full-block, breaking the tip
// into a smaller staircase rather than one flat notch — reads a bit more like a tooth.
const chompOpen = chompFrame("          ███████▀▀  ", "          ██████     ", MASK9, MASK6);
// F4: the ledge retracting back toward closed, using ▀ instead of the ▄/▀ pair.
const chompClosing = chompFrame("          ██████▀▀▀  ", "          ██████     ", MASK9, MASK6);

/** @internal */
export const dino = {
  name: "dino",
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
    wink: {
      frames: [baseFrame, winkFrame, baseFrame],
      frameDurations: [90, 380, 90],
    },
    chomp: {
      frames: [baseFrame, chompDropping, chompOpen, chompClosing, chompOpen, chompDropping],
      frameDurations: [120, 90, 140, 90, 140, 90],
    },
  },
} satisfies Character;
