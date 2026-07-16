import type { Character } from "../types.js";
import { monster } from "./monster.js";
import { dino } from "./dino.js";
import { ghost } from "./ghost.js";

/** @internal */
export const characters: Record<string, Character> = {
  monster,
  dino,
  ghost,
};

/**
 * Looks up a character by name.
 *
 * @remarks
 * Throws with the list of registered character names on a miss, so a typo surfaces
 * immediately instead of silently rendering nothing.
 *
 * @example
 * ```ts
 * const character = getCharacter("monster");
 * ```
 *
 * @category Common
 */
export function getCharacter(name: string): Character {
  const character = characters[name];
  if (!character) {
    const available = Object.keys(characters).join(", ");
    throw new Error(`Unknown character "${name}". Available: ${available}`);
  }
  return character;
}

export { monster, dino, ghost };
