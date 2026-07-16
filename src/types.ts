/** A single frame's glyph grid plus an optional slot mask. */
export interface Frame {
  /** Multiline string of the literal glyphs to render. Lines should share a width. */
  art: string;
  /**
   * Multiline string, same dimensions as `art`. Each non-space character is a key
   * into the character's `legend` naming the slot that glyph belongs to (e.g. eyes, body).
   */
  mask?: string;
}

export interface Pose {
  frames: Frame[];
  /**
   * ms to hold each frame before advancing to the next (loops back to frame 0 at the
   * end). Same length as `frames`. A duration of 0 means "never auto-advance" — used
   * by static single-frame poses, or a frame meant to hold indefinitely.
   */
  frameDurations: number[];
}

/** A character is authored as a registry of named poses, each with one or more frames. */
export interface Character {
  name: string;
  /** Slot legend shared across all of this character's poses. */
  legend?: Record<string, string>;
  /** Must include a "base" pose. */
  poses: Record<string, Pose>;
}

export interface Cell {
  char: string;
  slot?: string;
}

export interface RenderModel {
  rows: Cell[][];
  width: number;
  height: number;
}

/** A run of consecutive cells in a row that share the same slot (or lack one). */
export interface CellRun {
  text: string;
  slot?: string;
}

/**
 * Maps slot names (plus the special "root" key) to classes the host app already
 * owns, so parts of the mascot can be styled without inventing new classes.
 */
export interface ClassNames {
  root?: string;
  [slot: string]: string | undefined;
}

/** Programmatic theme overrides, applied as CSS custom properties. */
export interface Theme {
  color?: string;
  background?: string;
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  /** Per-slot color overrides, e.g. `{ eyes: 'lime' }`. */
  slots?: Record<string, string>;
}

/** One pose's shape, summarized for display rather than rendering — see `describeCharacter`. */
export interface PoseSummary {
  name: string;
  frameCount: number;
  /** Whether this pose loops through more than one frame, vs. a static single-frame pose. */
  animated: boolean;
  /** Total ms to play through the pose's frames once — see `getPoseDuration`. */
  totalDurationMs: number;
}

/** A character's poses and slots, summarized for display — see `describeCharacter`. */
export interface CharacterSummary {
  name: string;
  slots: string[];
  poses: PoseSummary[];
}
