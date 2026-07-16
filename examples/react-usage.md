# Using `sidekick-kaiju/react`

```tsx
import { Sidekick } from "sidekick-kaiju/react";
import "sidekick-kaiju/styles.css";
import styles from "./widget.module.css";

export function AssistantAvatar() {
  return (
    <Sidekick
      character="monster"
      className={styles.avatar}
      classNames={{ eyes: styles.glow }}
      theme={{ color: "#6cf" }}
    />
  );
}
```

- `className` sets a class on the root wrapper, in addition to the base `sidekick` class.
- `classNames` maps slot names (`body`, `eyes`, `legs`) to classes your app already has —
  no new CSS required.
- `theme` sets CSS custom properties (`--sidekick-color`, `--sidekick-eyes-color`, ...) inline,
  for cases where you'd rather pass a color than define a class.

If you don't want the React wrapper, `useSidekick(character, pose)` returns the same render
model `Sidekick` uses, so you can render your own markup:

```tsx
import { useSidekick } from "sidekick-kaiju/react";
```

## Poses & animation

`useSidekickPose` tracks a pose name with an optional timed revert, decoupled from
rendering — compose it with `<Sidekick pose>` or `useSidekick`:

```tsx
import { Sidekick, useSidekickPose } from "sidekick-kaiju/react";
import { monster, poseNames } from "sidekick-kaiju";

const P = poseNames(monster); // { base: "base", step: "step", ... } — no hardcoded strings

function Widget() {
  const [pose, setPose, speed] = useSidekickPose("base", "monster");
  return (
    <Sidekick
      character="monster"
      pose={pose}
      speed={speed}
      onClick={() => setPose(P.step, { duration: 2000 })} // reverts to "base" after 2s
    />
  );
}
```

`<Sidekick>` forwards extra props like `onClick` straight to its root `<div>`, so it
behaves like any other element for event handlers and ARIA attributes.

Omit `duration` to hold a pose indefinitely, or pass `{ iterations: 2 }` to play through
a pose's frames twice before reverting — reverts cleanly on a loop boundary instead of an
arbitrary wall-clock time, unlike `duration` (`{ iterations: 1 }` is "play once"). Pass
`useSidekickPose`'s second argument (`character`) to use `iterations`, since it needs the
character's frame durations to know how long that takes. `{ speed: 0.5 }` plays every
frame of that invocation at twice the duration (`2` for half); `setPose("wink", {
iterations: 2, speed: 0.5 })` is two slow-motion blinks. `useSidekickPose` returns the
active `speed` as its third value — pass it to `<Sidekick speed>` (shown above) so the
render actually reflects it; it resets to `1` once the pose reverts. See the main
README's "Poses & animation" section for the vanilla-DOM equivalent (`animatePose`).

## Wrapping the core for another framework

`sidekick-kaiju/react` is a thin layer over the framework-agnostic core. The same pattern works
for Vue, Svelte, Solid, etc.:

1. Call `buildRenderModel(getPose(character, poseName).frames[frameIndex], character.legend)`
   for the frame you want to show (memoize on character/pose/frame).
2. Call `toRuns(row)` per row to get slot-grouped text runs.
3. Render each run as text, or as a tagged element (`data-slot`, plus your framework's
   class binding) when `run.slot` is set.

Or skip steps 2–3 entirely and call `renderToElement(model, target, options)` from the
core directly against a ref/mounted element — it's plain DOM and works anywhere.
