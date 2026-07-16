import { describe, expect, it } from "vitest";
import { buildRenderModel } from "../src/buildRenderModel.js";
import { trimRenderModel, trimRenderModels } from "../src/trim.js";
import type { RenderModel } from "../src/types.js";

/** Builds an *untrimmed* RenderModel from plain row strings, for testing trim directly. */
function rawModel(rows: string[]): RenderModel {
  return {
    rows: rows.map((row) => Array.from(row, (char) => ({ char }))),
    width: Math.max(0, ...rows.map((row) => row.length)),
    height: rows.length,
  };
}

function chars(model: RenderModel): string[] {
  return model.rows.map((row) => row.map((c) => c.char).join(""));
}

describe("trimRenderModel", () => {
  it("strips fully-blank border rows and columns", () => {
    const model = buildRenderModel({
      art: ["      ", "  ab  ", "  cd  ", "      "].join("\n"),
    });

    expect(model.height).toBe(2);
    expect(model.width).toBe(2);
    expect(model.rows.map((row) => row.map((c) => c.char).join(""))).toEqual(["ab", "cd"]);
  });

  it("does not strip internal blank columns (e.g. a gap between legs)", () => {
    const model = buildRenderModel({ art: "a b" });

    expect(model.width).toBe(3);
    expect(model.rows[0].map((c) => c.char)).toEqual(["a", " ", "b"]);
  });

  it("returns an empty model for fully-blank art", () => {
    const model = trimRenderModel({
      rows: [
        [{ char: " " }, { char: " " }],
        [{ char: " " }, { char: " " }],
      ],
      width: 2,
      height: 2,
    });

    expect(model).toEqual({ rows: [], width: 0, height: 0 });
  });
});

describe("trimRenderModels", () => {
  it("preserves a horizontal shift between frames instead of re-centering each independently", () => {
    // Trimmed independently, both would collapse to the identical 3-wide "███" —
    // exactly the bug that made a translated ghost silhouette invisible after
    // per-frame trimming, since a solid/symmetric shape re-crops to the same box
    // regardless of where within its row it sits.
    const rest = rawModel(["  ███   "]);
    const shifted = rawModel(["   ███  "]);

    const [rTrimmedAlone, sTrimmedAlone] = [trimRenderModel(rest), trimRenderModel(shifted)];
    expect(chars(rTrimmedAlone)).toEqual(chars(sTrimmedAlone)); // the bug, reproduced

    const [rShared, sShared] = trimRenderModels([rest, shifted]);
    expect(rShared.width).toBe(sShared.width);
    expect(chars(rShared)).toEqual(["███ "]); // shared window starts 2 cols in (rest's own left edge)
    expect(chars(sShared)).toEqual([" ███"]); // ...revealing the 1-col shift relative to it
  });

  it("only trims a row/column that's blank in every model", () => {
    const a = rawModel(["  x  ", "     "]);
    const b = rawModel(["     ", "  y  "]);

    const [aShared, bShared] = trimRenderModels([a, b]);
    expect(chars(aShared)).toEqual(["x", " "]);
    expect(chars(bShared)).toEqual([" ", "y"]);
  });

  it("matches trimRenderModel's own output when given a single model", () => {
    const model = rawModel(["  ab  ", "  cd  "]);
    expect(trimRenderModels([model])).toEqual([trimRenderModel(model)]);
  });

  it("returns an empty model for every input when all are fully blank", () => {
    const blank = rawModel(["   ", "   "]);
    expect(trimRenderModels([blank, blank])).toEqual([
      { rows: [], width: 0, height: 0 },
      { rows: [], width: 0, height: 0 },
    ]);
  });
});
