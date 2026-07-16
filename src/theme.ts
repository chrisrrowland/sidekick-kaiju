import type { Theme } from "./types.js";

/**
 * The published theming contract: every CSS custom property `mascot.css` consumes.
 *
 * @remarks
 * Exported as constants so hosts can reference the real names instead of copying
 * strings out of docs.
 *
 * @example
 * ```ts
 * document.documentElement.style.setProperty(CSS_VARS.color, "#39ff88");
 * ```
 *
 * @category Advanced
 */
export const CSS_VARS = {
  color: "--mascot-color",
  background: "--mascot-bg",
  fontFamily: "--mascot-font-family",
  fontSize: "--mascot-font-size",
  lineHeight: "--mascot-line-height",
} as const;

/**
 * Name of the per-slot color override variable, e.g. `--mascot-eyes-color`.
 *
 * @example
 * ```ts
 * slotColorVar("eyes"); // "--mascot-eyes-color"
 * ```
 *
 * @category Advanced
 */
export function slotColorVar(slot: string): string {
  return `--mascot-${slot}-color`;
}

/**
 * Converts a `Theme` into a CSS custom property map.
 *
 * @remarks
 * What `<Mascot theme>` uses internally to build its inline `style`; reach for it
 * directly outside React (Vue, Svelte, ...) when `applyTheme`'s element-mutation isn't
 * the right shape for your framework.
 *
 * @example
 * ```ts
 * themeToStyle({ color: "#39ff88", fontSize: "48px" });
 * // { "--mascot-color": "#39ff88", "--mascot-font-size": "48px" }
 * ```
 *
 * @category Advanced
 */
export function themeToStyle(theme: Theme): Record<string, string> {
  const style: Record<string, string> = {};
  if (theme.color) style[CSS_VARS.color] = theme.color;
  if (theme.background) style[CSS_VARS.background] = theme.background;
  if (theme.fontFamily) style[CSS_VARS.fontFamily] = theme.fontFamily;
  if (theme.fontSize) style[CSS_VARS.fontSize] = theme.fontSize;
  if (theme.lineHeight) style[CSS_VARS.lineHeight] = theme.lineHeight;
  for (const [slot, color] of Object.entries(theme.slots ?? {})) {
    style[slotColorVar(slot)] = color;
  }
  return style;
}

/**
 * Applies a `Theme` directly to an element's inline style, for vanilla DOM use.
 *
 * @example
 * ```ts
 * applyTheme(document.getElementById("app"), { color: "#39ff88", fontSize: "48px" });
 * ```
 *
 * @category Common
 */
export function applyTheme(element: HTMLElement, theme: Theme): void {
  for (const [prop, value] of Object.entries(themeToStyle(theme))) {
    element.style.setProperty(prop, value);
  }
}
