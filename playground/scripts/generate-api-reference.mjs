// Generates playground/api-reference.generated.json from the real source JSDoc, via
// TypeDoc's programmatic API (see typedoc.json for entry points / options). This is
// what drives the playground's [ api ] section — the reference can't drift from the
// actual exports/docs the way a hand-maintained list could, because there's nothing
// hand-maintained: every name, signature, description, and example is read straight
// off `src/`.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Application, ReflectionKind, TSConfigReader, TypeDocReader } from "typedoc";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const outputPath = fileURLToPath(new URL("../api-reference.generated.json", import.meta.url));

// Everything except interfaces/type aliases/namespaces — i.e. the callable surface
// (functions, the Mascot component, hooks) and simple constant exports (CSS_VARS),
// not the type-only exports consumers import separately for annotations.
const INCLUDED_KINDS = ReflectionKind.Function | ReflectionKind.Variable;

function joinParts(parts) {
  return (parts ?? []).map((part) => part.text).join("");
}

// @example blocks are authored as fenced markdown (```tsx ... ```) so editors get
// syntax highlighting while writing them; strip the fence for display since the
// playground already renders it inside its own <pre> code block.
function stripCodeFence(text) {
  return text.replace(/^```[^\n]*\n/, "").replace(/\n?```\s*$/, "");
}

function formatParam(param) {
  const optional = param.flags.isOptional ? "?" : "";
  const type = param.type ? param.type.toString() : "unknown";
  const name = param.name === "__namedParameters" ? "props" : param.name;
  const defaultValue = param.defaultValue ? ` = ${param.defaultValue}` : "";
  return `${name}${optional}: ${type}${defaultValue}`;
}

function formatSignature(reflection) {
  const sig = reflection.signatures?.[0];
  if (sig) {
    const params = sig.parameters?.map(formatParam).join(", ") ?? "";
    return `${reflection.name}(${params}): ${sig.type?.toString() ?? "void"}`;
  }
  // Plain value export (e.g. CSS_VARS) — show its type instead of a call signature.
  return `${reflection.name}: ${reflection.type?.toString() ?? "unknown"}`;
}

function extractEntry(reflection, moduleName) {
  const comment = reflection.signatures?.[0]?.comment ?? reflection.comment;
  if (!comment) return undefined;

  const category = comment.getTag("@category");
  const remarks = comment.getTag("@remarks");
  const example = comment.getTag("@example");

  return {
    name: reflection.name,
    module: moduleName.includes("react") ? "react" : "core",
    common: joinParts(category?.content).trim() === "Common",
    signature: formatSignature(reflection),
    summary: joinParts(comment.summary).trim(),
    description: remarks ? joinParts(remarks.content).trim() : undefined,
    example: example ? stripCodeFence(joinParts(example.content).trim()) : undefined,
  };
}

async function main() {
  const app = await Application.bootstrapWithPlugins(
    { basePath: repoRoot },
    [new TypeDocReader(), new TSConfigReader()],
  );

  const project = await app.convert();
  if (!project) throw new Error("TypeDoc conversion failed");

  const entries = [];
  for (const mod of project.children ?? []) {
    for (const child of mod.children ?? []) {
      if (!(child.kind & INCLUDED_KINDS)) continue;
      const entry = extractEntry(child, mod.name);
      if (entry) entries.push(entry);
    }
  }

  entries.sort((a, b) => {
    if (a.module !== b.module) return a.module === "core" ? -1 : 1;
    if (a.common !== b.common) return a.common ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  await writeFile(outputPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`Wrote ${entries.length} API reference entries to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
