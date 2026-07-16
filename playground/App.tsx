import { useLayoutEffect, useRef, useState } from "react";
import { Mascot, useMascotPose } from "mascot/react";
import { characters, poseNames } from "mascot";
import apiReferenceData from "./api-reference.generated.json";
import "./App.css";

interface ApiEntry {
  name: string;
  module: "core" | "react";
  common: boolean;
  signature: string;
  summary: string;
  description?: string;
  example?: string;
}

// Generated at dev/build time from src/**'s JSDoc via TypeDoc — see typedoc.json and
// playground/scripts/generate-api-reference.mjs. Nothing here is hand-maintained, so a
// new export (or a changed doc comment) shows up the next time the playground starts,
// same guarantee the character pose/slot sheet below already has.
const API_REFERENCE = apiReferenceData as ApiEntry[];

const SLOTS = ["body", "eyes", "legs", "arms"];

// Not on npm yet (see README) — every manager installs the same git ref, just with its
// own verb. Once this is a real npm package, swap the "github:..." segment for the
// package name here and the change is done everywhere at once.
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];
const INSTALL_COMMANDS: Record<PackageManager, string> = {
  npm: "npm install github:chrisrrowland/sidekick-kaiju",
  pnpm: "pnpm add github:chrisrrowland/sidekick-kaiju",
  yarn: "yarn add github:chrisrrowland/sidekick-kaiju",
  bun: "bun add github:chrisrrowland/sidekick-kaiju",
};

const REFERENCE_FONT_SIZE = 100;

// Characters have wildly different row counts (monster is 3 rows tall, dino is 18), so
// the same font-size reads as reasonable for one and enormous for the other. A fallback
// covers any future character that doesn't get a tuned entry here.
const DEFAULT_FONT_SIZE: Record<string, number> = { monster: 48, dino: 22 };
const FALLBACK_FONT_SIZE = 32;

/** True once, on mount — doesn't need to track live changes for this small demo. */
function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduced;
}

/**
 * Measures a character's natural footprint at a reference font-size, then
 * renders it a second time at a directly-computed font-size so it fits
 * inside a fixed `size`x`size` box without distortion — same idea as
 * `object-fit: contain`. Deliberately avoids CSS `transform: scale()`: a
 * transform doesn't affect layout, so flexbox would center the *oversized*
 * pre-transform box, which is exactly the kind of oversized-box centering
 * math that can round differently across browsers/engines. Setting the
 * real font-size keeps the centered box always the right natural size.
 * This is a playground-only prototype; it is not (yet) part of the
 * library's public API.
 */
function FitBox({ character, size }: { character: string; size: number }) {
  // Always renders at REFERENCE_FONT_SIZE, off-screen, purely to measure the
  // character's natural footprint — decoupled from the visible font-size
  // state below, so remeasuring never compounds against a previous result.
  const measureRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(REFERENCE_FONT_SIZE);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const scale = Math.min(size / width, size / height);
    setFontSize(REFERENCE_FONT_SIZE * scale);
  }, [character, size]);

  return (
    <div className="pg-fitbox-box" style={{ width: size, height: size }}>
      <div style={{ position: "absolute", visibility: "hidden", pointerEvents: "none" }}>
        <div ref={measureRef} style={{ display: "inline-block" }}>
          <Mascot character={character} theme={{ fontSize: `${REFERENCE_FONT_SIZE}px` }} />
        </div>
      </div>
      <Mascot character={character} theme={{ color: "#f3e8d2", fontSize: `${fontSize}px` }} />
    </div>
  );
}

interface SnippetProps {
  character: string;
  pose: string;
  color: string;
  fontSize: number;
  slotColors: Record<string, string>;
  useHostClass: boolean;
  hostClassSlot: string;
}

/** Renders the current control state back as the `<Mascot>` call that produces it. */
function reactUsageSnippet(props: SnippetProps): string {
  const { character, pose, color, fontSize, slotColors, useHostClass, hostClassSlot } = props;
  const themeParts = [`color: "${color}"`, `fontSize: "${fontSize}px"`];
  if (Object.keys(slotColors).length > 0) {
    themeParts.push(`slots: ${JSON.stringify(slotColors)}`);
  }
  const lines = [
    `import { Mascot } from "mascot/react";`,
    `import "mascot/styles.css";`,
    "",
    `<Mascot`,
    `  character="${character}"`,
    pose !== "base" ? `  pose="${pose}"` : undefined,
    `  theme={{ ${themeParts.join(", ")} }}`,
    useHostClass ? `  classNames={{ ${hostClassSlot}: "your-class" }}` : undefined,
    `/>`,
  ].filter((line): line is string => line !== undefined);
  return lines.join("\n");
}

/**
 * The framework-agnostic equivalent of reactUsageSnippet — `mascot` (no "/react") has no
 * runtime dependencies at all; `mascot/react` is an optional thin layer on top of it, not
 * the only way in. animatePose is the vanilla stand-in for useMascotPose: same
 * duration/iterations/speed options, just a returned controller instead of hook state.
 */
function vanillaUsageSnippet(props: SnippetProps): string {
  const { character, pose, color, fontSize, slotColors, useHostClass, hostClassSlot } = props;
  const themeParts = [`color: "${color}"`, `fontSize: "${fontSize}px"`];
  if (Object.keys(slotColors).length > 0) {
    themeParts.push(`slots: ${JSON.stringify(slotColors)}`);
  }
  const lines = [
    `import { getCharacter, animatePose, applyTheme } from "mascot";`,
    `import "mascot/styles.css";`,
    "",
    `const el = document.getElementById("app");`,
    `applyTheme(el, { ${themeParts.join(", ")} });`,
    "",
    `const character = getCharacter("${character}");`,
    `const controller = animatePose(character, "${pose}", el${
      useHostClass ? `, {\n  classNames: { ${hostClassSlot}: "your-class" },\n}` : ""
    });`,
    "",
    `// controller.setPose(name, { duration?, iterations?, speed? }) to switch poses later`,
    `// controller.stop() when done`,
    `// server-side? animatePose needs a live DOM + timers — for SSR, call`,
    `// buildRenderModel + renderToHTMLString directly instead`,
  ];
  return lines.join("\n");
}

// Illustrative — not derived from playground state like the other snippets. The point
// isn't this exact rule set, it's that setPose is a plain function you call from
// wherever your own event source lives, not something wired to a click on the mascot.
const TRIGGER_SNIPPET = [
  `import { Mascot, useMascotPose } from "mascot/react";`,
  "",
  `const [pose, setPose, speed] = useMascotPose("base", "monster");`,
  "",
  `// Anywhere in your own code — a websocket handler, a state machine,`,
  `// any event source. setPose isn't tied to a click.`,
  `myEventEmitter.on("status", (status) => {`,
  `  if (status === "loading") {`,
  `    setPose("step", { duration: 3000 });`,
  `  } else if (status === "success") {`,
  `    setPose("celebrate", { iterations: 3 });`,
  `  } else if (status === "error") {`,
  `    setPose("wink", { iterations: 2, speed: 0.5 }); // two slow blinks`,
  `  }`,
  `});`,
  "",
  `<Mascot character="monster" pose={pose} speed={speed} />`,
].join("\n");

// The three literal values the [ react to app state ] input actually recognizes
// (see handleEventText) — highlighted below so it's obvious at a glance which tokens
// in the snippet you can type into the input to trigger, without reaching for a full
// syntax highlighter (nothing else on this page uses one; keeps the plain-<pre> look).
const TRIGGER_SNIPPET_STATUS_VALUES = ["loading", "success", "error"];
const TRIGGER_SNIPPET_STATUS_PATTERN = new RegExp(
  `("(?:${TRIGGER_SNIPPET_STATUS_VALUES.join("|")})")`,
  "g",
);
const TRIGGER_SNIPPET_NODES = TRIGGER_SNIPPET.split(TRIGGER_SNIPPET_STATUS_PATTERN).map(
  (part, i) =>
    TRIGGER_SNIPPET_STATUS_VALUES.some((value) => part === `"${value}"`) ? (
      <span key={i} className="pg-status-highlight">
        {part}
      </span>
    ) : (
      part
    ),
);

/**
 * The eyes are the one slot whose glyph is mostly solid ink with a small negative-space
 * notch (the "pupil") — background-color shows through that notch as a glow without
 * recoloring the ink. Every other slot is closer to the opposite case: there's ink to
 * recolor directly, so color + text-shadow reads as a glow there instead. Not a precise
 * per-glyph analysis (some parts, like the legs, lean gappy too) — just the rule of
 * thumb that makes each preset actually look like a glow rather than a flat patch.
 */
function defaultHostClassCss(slot: string): string {
  if (slot === "eyes") {
    return [
      "/* filter (e.g. hue-rotate) repaints everything in the element — ink",
      "   included — so it would cycle the glyph's own color too, not just the",
      "   background peeking through the notch. Animating background-color",
      "   directly keeps the change confined to that property, so only the",
      "   notch's color moves and the ink stays exactly as mascot.css set it. */",
      "@keyframes glow-shift {",
      "  0%, 100% { background-color: #ff2fd0; }",
      "  33% { background-color: #2fd0ff; }",
      "  66% { background-color: #d0ff2f; }",
      "}",
      "",
      "/* Eyes are mostly solid ink with a small negative-space notch — the",
      "   \"pupil\". background-color shows through that notch without recoloring",
      "   the ink itself, so it reads as a small glowing dot rather than a big",
      "   colored patch — and it keeps working even if the notch closes up",
      "   entirely (e.g. during a wink), since there's nothing left to peek",
      "   through. Skip text-shadow here too: its blur radius doesn't know",
      "   about the notch, so it bleeds glow across the ink and washes the",
      "   dot out. */",
      ".your-class {",
      "  display: inline-block;",
      "  background-color: #ff2fd0;",
      "  animation: glow-shift 3s linear infinite;",
      "}",
    ].join("\n");
  }
  return [
    "@keyframes glow-spin {",
    "  to { filter: hue-rotate(360deg); }",
    "}",
    "",
    "/* For most other parts, color is the more predictable choice — it",
    "   recolors the glyph itself, and text-shadow adds a glow around it.",
    "   filter is safe to use here (unlike on the eyes) because there's no",
    "   separate background peeking through to keep isolated — the ink is",
    "   the whole effect, so recoloring everything in the element together",
    "   is exactly what we want. */",
    ".your-class {",
    "  display: inline-block;",
    "  color: #ff2fd0;",
    "  text-shadow: 0 0 6px currentColor;",
    "  animation: glow-spin 2s linear infinite;",
    "}",
  ].join("\n");
}

function ApiEntryRow({ entry }: { entry: ApiEntry }) {
  return (
    <details className="pg-api-entry">
      <summary className="pg-api-entry-summary">
        <code className="pg-api-name">{entry.name}</code>
        <span className="pg-api-brief">{entry.summary}</span>
      </summary>
      <div className="pg-api-body">
        <pre className="pg-snippet pg-api-fullsig">{entry.signature}</pre>
        {entry.description && <p className="pg-api-desc">{entry.description}</p>}
        {entry.example && <pre className="pg-snippet">{entry.example}</pre>}
      </div>
    </details>
  );
}

function ApiModuleSection({ title, entries }: { title: string; entries: ApiEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="pg-api-module">
      <h2 className="pg-api-module-title">{title}</h2>
      {entries.map((entry) => (
        <ApiEntryRow key={entry.name} entry={entry} />
      ))}
    </div>
  );
}

function FooterMascot() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <Mascot
      character="monster"
      pose={reducedMotion ? "base" : "step"}
      theme={{ color: "var(--phosphor-dim)", fontSize: "14px" }}
    />
  );
}

export function App() {
  const [character, setCharacter] = useState("monster");
  const [pose, setPose, activeSpeed] = useMascotPose("base", character);
  const [iterationsInput, setIterationsInput] = useState(2);
  const [speedInput, setSpeedInput] = useState(0.5);
  const posesForCharacter = Object.keys(characters[character].poses);
  const [color, setColor] = useState("#f3e8d2");
  const [background, setBackground] = useState("#241c12");
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE.monster ?? FALLBACK_FONT_SIZE);
  const [slotColors, setSlotColors] = useState<Record<string, string>>({});
  const [useHostClass, setUseHostClass] = useState(false);
  const [hostClassSlot, setHostClassSlot] = useState("eyes");
  const [boxSize, setBoxSize] = useState(160);
  const [hostClassCss, setHostClassCss] = useState(() => defaultHostClassCss("eyes"));
  const [eventText, setEventText] = useState("");
  const [snippetMode, setSnippetMode] = useState<"react" | "vanilla">("react");
  const [pmMode, setPmMode] = useState<PackageManager>("npm");
  const [installCopied, setInstallCopied] = useState(false);

  function copyInstallCommand() {
    navigator.clipboard.writeText(INSTALL_COMMANDS[pmMode]).then(() => {
      setInstallCopied(true);
      setTimeout(() => setInstallCopied(false), 1500);
    });
  }
  const [apiTab, setApiTab] = useState<"common" | "advanced">("common");

  // Not part of the mascot's own UI — stands in for an arbitrary external event source
  // (a websocket message, an OTEL span, ...). The point is that setPose gets called from
  // here, nowhere near a click handler on <Mascot> itself.
  function handleEventText(value: string) {
    setEventText(value);
    const P = poseNames(characters[character]);
    const text = value.toLowerCase();
    if (/error|fail/.test(text)) {
      setPose(P.wink, { iterations: 2, speed: 0.5 });
    } else if (/success|done/.test(text)) {
      setPose(P.celebrate ?? P.wink, { iterations: 1 });
    } else if (/busy|loading/.test(text)) {
      setPose(P.step ?? P.chomp ?? P.base, { duration: 3000 });
    } else {
      setPose(P.base);
    }
  }

  return (
    <div className="pg-page">
      <main className="pg-shell">
        <h1 className="pg-sr-only">mascot playground — try the library live before you install it</h1>
        <div className="pg-titlebar">
          <div className="pg-dots">
            <span />
            <span />
            <span />
          </div>
          <span className="pg-titlebar-path">~/mascot</span>
        </div>

        <div className="pg-hero">
          <div className="pg-btn-group">
            {PACKAGE_MANAGERS.map((pm) => (
              <button
                key={pm}
                type="button"
                className="pg-btn"
                onClick={() => setPmMode(pm)}
                disabled={pmMode === pm}
              >
                {pm}
              </button>
            ))}
          </div>
          <div className="pg-hero-command-row">
            <p className="pg-hero-command">
              {INSTALL_COMMANDS[pmMode]}
              <span className="pg-cursor" aria-hidden="true" />
            </p>
            <button
              type="button"
              className="pg-btn pg-icon-btn"
              onClick={copyInstallCommand}
              aria-label={installCopied ? "Copied install command" : "Copy install command"}
              title={installCopied ? "Copied!" : "Copy to clipboard"}
            >
              {installCopied ? (
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    d="M13.5 3.5 6 11l-3.5-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <rect
                    x="5.5"
                    y="5.5"
                    width="8"
                    height="9"
                    rx="1.25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                  <path
                    d="M3.5 10.5v-7a1 1 0 0 1 1-1h6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
          <p className="pg-tagline">
            Terminal-art creatures for any Node or React app — a zero-dependency core, an
            optional React wrapper, and a theming contract built for apps that already
            ship their own CSS. Fully typed either way; plain JS works too, same code
            minus the type annotations. Everything below is the real library, running
            live.
          </p>
          <p className="pg-caveat">
            Not on npm yet — installs straight from this repo; see the README for details.
          </p>
        </div>

        <div className="pg-main">
          <div className="pg-preview">
            <div className="pg-preview-stage" style={{ background }}>
              <Mascot
                character={character}
                pose={pose}
                speed={activeSpeed}
                theme={{ color, fontSize: `${fontSize}px`, slots: slotColors }}
                classNames={useHostClass ? { [hostClassSlot]: "your-class" } : undefined}
              />
            </div>
            <div className="pg-btn-group">
              <button
                type="button"
                className="pg-btn"
                onClick={() => setSnippetMode("react")}
                disabled={snippetMode === "react"}
              >
                react
              </button>
              <button
                type="button"
                className="pg-btn"
                onClick={() => setSnippetMode("vanilla")}
                disabled={snippetMode === "vanilla"}
              >
                vanilla
              </button>
            </div>
            <pre className="pg-snippet">
              {(snippetMode === "react" ? reactUsageSnippet : vanillaUsageSnippet)({
                character,
                pose,
                color,
                fontSize,
                slotColors,
                useHostClass,
                hostClassSlot,
              })}
            </pre>

            <div className="pg-trigger">
              <span className="pg-section-title">[ react to app state ]</span>
              <p className="pg-section-caption" style={{ marginTop: 0 }}>
                Every pose button above happens to call <code>setPose</code> from a
                click handler, but that's incidental — it's just a function, not
                something wired to the mascot's own UI. Typing below calls the exact
                same <code>setPose</code> you'd call from a websocket handler, a state
                machine, or any other event source — watch the mascot above react.{" "}
                <span style={{ color: "var(--phosphor)" }}>↑</span>
              </p>
              <div className="pg-field" style={{ marginTop: "0.7rem" }}>
                <label className="pg-label" htmlFor="pg-eventtext">
                  status
                </label>
                <input
                  id="pg-eventtext"
                  className="pg-select"
                  type="text"
                  value={eventText}
                  onChange={(e) => handleEventText(e.target.value)}
                  placeholder='try "error", "success", or "loading"'
                />
              </div>
              <pre className="pg-snippet" style={{ marginTop: "0.75rem" }}>
                {TRIGGER_SNIPPET_NODES}
              </pre>
            </div>
          </div>

          <div className="pg-controls">
            <div className="pg-field">
              <label className="pg-label" htmlFor="pg-character">
                character
              </label>
              <select
                id="pg-character"
                className="pg-select"
                value={character}
                onChange={(e) => {
                  setCharacter(e.target.value);
                  setPose("base"); // avoid crashing if the current pose doesn't exist on the new character
                  setFontSize(DEFAULT_FONT_SIZE[e.target.value] ?? FALLBACK_FONT_SIZE);
                }}
              >
                {Object.keys(characters).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pg-section">
              <span className="pg-section-title">[ pose ] — current: {pose}</span>
              <div className="pg-pose-play-controls">
                <label>
                  iterations
                  <input
                    className="pg-select pg-number"
                    type="number"
                    min={1}
                    step={1}
                    value={iterationsInput}
                    onChange={(e) => setIterationsInput(Math.max(1, Number(e.target.value)))}
                  />
                </label>
                <label>
                  speed
                  <span className="pg-speed-field">
                    <input
                      className="pg-select pg-number"
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={speedInput}
                      onChange={(e) => setSpeedInput(Math.max(0.1, Number(e.target.value)))}
                    />
                    <span title="Multiplier applied to the pose's normal frame durations — 0.5 plays at half speed">
                      ×
                    </span>
                  </span>
                </label>
              </div>
              {posesForCharacter.map((name) => (
                <div className="pg-pose-row" key={name}>
                  <span className="pg-pose-name">{name}</span>
                  <div className="pg-btn-group">
                    <button
                      type="button"
                      className="pg-btn"
                      onClick={() => setPose(name)}
                      disabled={pose === name}
                    >
                      hold
                    </button>
                    {name !== "base" && (
                      <>
                        <button
                          type="button"
                          className="pg-btn"
                          onClick={() => setPose(name, { duration: 2000 })}
                        >
                          2s
                        </button>
                        <button
                          type="button"
                          className="pg-btn"
                          onClick={() =>
                            setPose(name, { iterations: iterationsInput, speed: speedInput })
                          }
                        >
                          play
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <p className="pg-section-caption">
                <strong>hold</strong> keeps a pose until you change it again.{" "}
                <strong>2s</strong> reverts automatically after a fixed delay.{" "}
                <strong>play</strong> runs it for the iterations/speed set above, then
                reverts cleanly on a loop boundary — set iterations to 2 and speed to 0.5
                for two slow-motion blinks.
              </p>
            </div>

            <div className="pg-section">
              <span className="pg-section-title">[ theme ]</span>
              <div className="pg-swatch-row">
                <input
                  type="color"
                  aria-label="background color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                />
                <span>background</span>
              </div>
              <div className="pg-swatch-row" style={{ marginTop: "0.5rem" }}>
                <input
                  type="color"
                  aria-label="mascot color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span>color</span>
              </div>
              <div className="pg-field" style={{ marginTop: "0.7rem" }}>
                <label className="pg-label" htmlFor="pg-fontsize">
                  font size — {fontSize}px
                </label>
                <input
                  id="pg-fontsize"
                  className="pg-range"
                  type="range"
                  min={12}
                  max={96}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>
              <p className="pg-section-caption">
                Maps directly onto the `theme` prop — CSS custom properties, applied
                inline. Reach for this first: it covers colors and sizing without writing
                any CSS. Reach for classNames below instead when you need something
                `theme` can't express — an animation, a gradient, a glow.
              </p>
            </div>

            <div className="pg-section">
              <span className="pg-section-title">[ theme.slots ]</span>
              {SLOTS.map((slot) => {
                const applied = slot in slotColors;
                return (
                  <div className="pg-slot-row" key={slot}>
                    <label>
                      <input
                        className="pg-checkbox"
                        type="checkbox"
                        checked={applied}
                        onChange={(e) =>
                          setSlotColors((prev) => {
                            if (e.target.checked) return { ...prev, [slot]: prev[slot] ?? "#4fd1c5" };
                            const { [slot]: _omit, ...rest } = prev;
                            return rest;
                          })
                        }
                      />
                      {slot}
                    </label>
                    <input
                      type="color"
                      aria-label={`${slot} color`}
                      disabled={!applied}
                      value={slotColors[slot] ?? "#4fd1c5"}
                      onChange={(e) => setSlotColors((prev) => ({ ...prev, [slot]: e.target.value }))}
                    />
                  </div>
                );
              })}
              <p className="pg-section-caption">
                Recolor individual parts — body, eyes, legs, arms — without touching the
                character's art.
              </p>
            </div>

            <div className="pg-section">
              <span className="pg-section-title">[ classNames ]</span>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                <input
                  className="pg-checkbox"
                  type="checkbox"
                  checked={useHostClass}
                  onChange={(e) => setUseHostClass(e.target.checked)}
                />
                apply a custom class to
                <select
                  className="pg-select"
                  value={hostClassSlot}
                  onChange={(e) => {
                    setHostClassSlot(e.target.value);
                    setHostClassCss(defaultHostClassCss(e.target.value));
                  }}
                  disabled={!useHostClass}
                >
                  {SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
              <p className="pg-section-caption">
                Hand any part its own class name to attach real CSS — animation,
                gradients, glow, anything your app already ships. mascot never reads the
                rule, it only stamps the class onto the part you pick. The textarea below
                stands in for a stylesheet you'd normally ship separately — switching
                parts swaps in a matching example; edit it and watch the change live.
              </p>
              <textarea
                className="pg-textarea"
                aria-label="example stylesheet for the selected slot's custom class"
                value={hostClassCss}
                onChange={(e) => setHostClassCss(e.target.value)}
                rows={12}
              />
            </div>
          </div>
        </div>

        <div className="pg-apisheet">
          <span className="pg-section-title">[ api ]</span>
          <p className="pg-section-caption" style={{ marginTop: 0, marginBottom: "1rem" }}>
            Every function <code>mascot</code> and <code>mascot/react</code> export,
            generated straight from each one's doc comment in <code>src/</code>, so it
            can't drift the way a hand-maintained list could. <strong>common</strong> is
            the handful you'll reach for first; <strong>advanced</strong> isn't
            unstable or risky to use, just less often needed — expand a row for its
            full signature and a usage example.
          </p>
          <div className="pg-btn-group" style={{ marginBottom: "1rem" }}>
            <button
              type="button"
              className="pg-btn"
              onClick={() => setApiTab("common")}
              disabled={apiTab === "common"}
            >
              common
            </button>
            <button
              type="button"
              className="pg-btn"
              onClick={() => setApiTab("advanced")}
              disabled={apiTab === "advanced"}
            >
              advanced
            </button>
          </div>
          <ApiModuleSection
            title="mascot — framework-agnostic core"
            entries={API_REFERENCE.filter(
              (entry) => entry.module === "core" && entry.common === (apiTab === "common"),
            )}
          />
          <ApiModuleSection
            title="mascot/react"
            entries={API_REFERENCE.filter(
              (entry) => entry.module === "react" && entry.common === (apiTab === "common"),
            )}
          />
        </div>

        <div className="pg-fitbox">
          <span className="pg-section-title">[ auto-fit ]</span>
          <p className="pg-tagline" style={{ fontSize: "0.85rem" }}>
            Every character trims its own blank space and scales to fill a box you pick —
            drop any character into a fixed avatar slot without hand-tuning sizes per
            shape. Nothing here is cropped or stretched; differently proportioned
            characters just fill the box differently.
          </p>
          <div className="pg-field" style={{ maxWidth: 320 }}>
            <label className="pg-label" htmlFor="pg-boxsize">
              box size — {boxSize}px
            </label>
            <input
              id="pg-boxsize"
              className="pg-range"
              type="range"
              min={60}
              max={320}
              value={boxSize}
              onChange={(e) => setBoxSize(Number(e.target.value))}
            />
          </div>
          <div className="pg-fitbox-grid">
            {Object.keys(characters).map((name) => (
              <div key={name} className="pg-fitbox-card">
                <FitBox character={name} size={boxSize} />
                <div className="pg-fitbox-label">{name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pg-footer">
          <FooterMascot />
          <span>made with mascot · MIT licensed</span>
        </div>
      </main>

      <style>{hostClassCss}</style>
    </div>
  );
}
