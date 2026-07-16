import type { Character, CharacterSummary, Pose } from "./types.js";

/**
 * Looks up a pose on a character by name.
 *
 * @remarks
 * Throws with the list of the character's available pose names on a miss, mirroring
 * `getCharacter`'s error message shape. Most callers reach `animatePose`/`useSidekick`
 * instead, which call this internally — use it directly when you need a pose's raw
 * `frames`/`frameDurations` without rendering it.
 *
 * @example
 * ```ts
 * const pose = getPose(getCharacter("monster"), "step");
 * pose.frames.length; // 4
 * ```
 *
 * @category Advanced
 */
export function getPose(character: Character, poseName: string): Pose {
  const pose = character.poses[poseName];
  if (!pose) {
    const available = Object.keys(character.poses).join(", ");
    throw new Error(
      `Unknown pose "${poseName}" on character "${character.name}". Available: ${available}`,
    );
  }
  return pose;
}

/**
 * Total ms to play through every frame of a pose once, in order.
 *
 * @remarks
 * Used to drive `{ iterations }` pose invocations (see `SetPoseOptions`): a frame's
 * duration of 0 ("hold indefinitely" in a loop) simply contributes 0ms here, so a
 * once-mode pose intended to be visible on its last frame before reverting needs a
 * real duration on that frame too, not the trailing-0 convention loop poses use.
 *
 * @example
 * ```ts
 * getPoseDuration(getCharacter("monster"), "step"); // 880
 * ```
 *
 * @category Advanced
 */
export function getPoseDuration(character: Character, poseName: string): number {
  const pose = getPose(character, poseName);
  return pose.frameDurations.reduce((total, duration) => total + duration, 0);
}

/**
 * Total ms to play a pose `iterations` times at `speed`×.
 *
 * @remarks
 * `{ iterations }` pose invocations need this (not just
 * `iterations * getPoseDuration(...)`) so the revert lands exactly on a fresh loop
 * boundary rather than mid-frame — it has to agree with whatever divided the same
 * frame durations by `speed` to actually schedule the frames, or the two would drift
 * apart over multiple iterations.
 *
 * @example
 * ```ts
 * // two slow-motion blinks, twice the normal frame duration each
 * getIterationsDuration(getCharacter("monster"), "wink", 2, 0.5);
 * ```
 *
 * @category Advanced
 */
export function getIterationsDuration(
  character: Character,
  poseName: string,
  iterations: number,
  speed = 1,
): number {
  return (getPoseDuration(character, poseName) / speed) * iterations;
}

/**
 * Turns a character's real pose keys into a self-mapped object, so call sites can write
 * `setPose(poseNames(dino).wink)` instead of the bare string `"wink"`.
 *
 * @remarks
 * Derived from `character.poses` at call time — there's nothing to hand-maintain, so it
 * can't drift out of sync the way a separately-authored constants object could.
 *
 * Plain JS callers get real editor autocomplete off this package's shipped `.d.ts`, same
 * as TS callers do. Full compile-time narrowing (each key typed as its own literal,
 * rather than widened to `string`) additionally requires the character itself to have
 * been declared with `satisfies Character` rather than `: Character`, so its `poses`
 * keys aren't widened away before they reach this function — see `monster.ts`/`dino.ts`.
 *
 * @example
 * ```ts
 * const P = poseNames(getCharacter("monster")); // { base: "base", step: "step", ... }
 * setPose(P.step, { duration: 2000 });
 * ```
 *
 * @category Common
 */
export function poseNames<C extends Character>(character: C): { [K in keyof C["poses"]]: K } {
  const names = {} as { [K in keyof C["poses"]]: K };
  for (const key of Object.keys(character.poses) as (keyof C["poses"])[]) {
    names[key] = key;
  }
  return names;
}

/**
 * A character's slot names (the values of its `legend`, deduplicated), in the order
 * they first appear.
 *
 * @remarks
 * Like `poseNames`, derived at call time so it can't drift out of sync with the
 * character's real data.
 *
 * @example
 * ```ts
 * slotNames(getCharacter("monster")); // ["body", "eyes", "legs", "arms"]
 * ```
 *
 * @category Advanced
 */
export function slotNames(character: Character): string[] {
  return [...new Set(Object.values(character.legend ?? {}))];
}

/**
 * Summarizes a character's poses and slots for display.
 *
 * @remarks
 * E.g. an auto-generated reference sheet a host page can render per character, instead
 * of a hand-maintained one that silently goes stale the next time a pose is added.
 * Everything here is derived from the character's actual `poses`/`legend`, so it's
 * always accurate.
 *
 * @example
 * ```ts
 * describeCharacter(getCharacter("monster"));
 * // { name: "monster", slots: ["body", "eyes", "legs", "arms"], poses: [...] }
 * ```
 *
 * @category Advanced
 */
export function describeCharacter(character: Character): CharacterSummary {
  return {
    name: character.name,
    slots: slotNames(character),
    poses: Object.entries(character.poses).map(([name, pose]) => ({
      name,
      frameCount: pose.frames.length,
      animated: pose.frames.length > 1,
      totalDurationMs: getPoseDuration(character, name),
    })),
  };
}
