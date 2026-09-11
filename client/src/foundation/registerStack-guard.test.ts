import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE REGISTER-STACK GUARD (#524) — a foundation register class beside a page
 * class is deterministic only while the page's stylesheet follows
 * `foundation.css` in the cascade. This pins the thing that makes it so.
 *
 * # What is stacked, and why
 *
 * The mono law (`scripts/lib/designLaws.mts`, law 3) exempts machine-register
 * text BY CLASS — `.dp-eyebrow` and `.dp-chrome` — and the founder ruled that
 * the exemption list does not grow: *"Use the two labels the rule already
 * knows on all nine … Don't add class names to the exemption list."* So a
 * staff page's own machine-fact class (`.dp-crew__mono`, `.dp-ov__blocklabel`,
 * `.dp-inv__flaggedmeta`) wears the foundation class BESIDE it — the
 * foundation class states the register, the page class tunes the size and
 * colour, exactly the shape casting already had in `dp-chrome dpc-echo__when`.
 *
 * # The trap this guard exists for
 *
 * `.dp-chrome` and `.dp-crew__mono` are both single-class selectors, so they
 * have EQUAL specificity and SOURCE ORDER decides which `font` wins. Nothing
 * in CSS itself says which stylesheet is later. What does say it is the
 * MODULE that imports the page stylesheet: an ES module evaluates its imports
 * in order, Vite emits CSS in module-evaluation order, and a stylesheet is
 * emitted once, at its first import — so a page file that imports the
 * `@/foundation` barrel BEFORE its own `.css` has put `foundation.css` ahead
 * of it for every bundle, dev and prod alike. That is the whole guarantee,
 * and it is one line of import order in one file, which is exactly the kind
 * of fact that is true today and silently false after a tidy-up reorders the
 * imports. A stacked element would then take the foundation's 10px, 0.1em
 * tracking and `--muted` over the page's 10.5px `--faint`, on every element
 * at once, with no failing test.
 *
 * # What is asserted
 *
 * The population is DERIVED: every string literal in a non-test `.tsx` under
 * `client/src` that carries `dp-chrome` or `dp-eyebrow` alongside another
 * `dp-`/`dpc-` class. For each partner class, the stylesheet declaring it is
 * found, and then:
 *   - if that stylesheet is `foundation.css` itself, the partner's rule must
 *     be declared AFTER `.dp-chrome` / `.dp-eyebrow`;
 *   - otherwise EVERY module that imports the stylesheet must import the
 *     foundation barrel earlier in the same file.
 * "Every importer" rather than "some importer", because which module loads
 * first is a routing accident and a guarantee that depends on one is none.
 */

const CLIENT = new URL("../", import.meta.url);
const REGISTER_CLASSES = ["dp-chrome", "dp-eyebrow"] as const;

const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

async function walk(dir: URL): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) out.push(...(await walk(child)));
    else out.push(fileURLToPath(child));
  }
  return out;
}

type Stack = { file: string; literal: string; partners: string[] };

/** Every `"… dp-chrome … dp-x …"` literal in the tsx sources, with its partners. */
export function readStacks(sources: Array<{ file: string; text: string }>): Stack[] {
  const stacks: Stack[] = [];
  for (const { file, text } of sources) {
    for (const match of code(text).matchAll(/"([^"\n]*)"/g)) {
      const classes = match[1].trim().split(/\s+/);
      if (!classes.some((c) => (REGISTER_CLASSES as readonly string[]).includes(c))) continue;
      const partners = classes.filter(
        (c) => /^(dp|dpc)-/.test(c) && !(REGISTER_CLASSES as readonly string[]).includes(c),
      );
      if (partners.length === 0) continue;
      stacks.push({ file, literal: match[1], partners });
    }
  }
  return stacks;
}

/** The index at which `.cls` is first declared as a selector, or -1. */
export function declarationIndex(css: string, cls: string): number {
  const rule = new RegExp(`(^|[\\s,}])\\.${cls}(?=[\\s,{.:\\[>~+])`, "m");
  const match = rule.exec(code(css));
  return match ? match.index : -1;
}

/**
 * True when the module imports the foundation barrel before the named
 * stylesheet — the one fact the cascade order rests on.
 */
export function foundationPrecedesStylesheet(moduleText: string, stylesheetBase: string): boolean {
  const text = code(moduleText);
  const sheet = new RegExp(`^\\s*import\\s+["'][^"']*${stylesheetBase.replace(/\./g, "\\.")}["']`, "m").exec(
    text,
  );
  if (!sheet) return true; // does not import it — nothing to order
  const barrel = /^\s*import\s+(?:[^"']*\s+from\s+)?["'](?:@\/foundation|\.\.?\/(?:\.\.\/)*foundation)(?:\/index)?["']/m.exec(
    text,
  );
  return barrel !== null && barrel.index < sheet.index;
}

/* Issue 524 — the number stays out of string literals for the token guard. */
describe("a foundation register class stacked on a page class is ordered by construction (issue 524)", () => {
  it("every stack's page stylesheet follows foundation.css in the cascade", async () => {
    const files = await walk(CLIENT);
    const tsx = files.filter((f) => f.endsWith(".tsx") && !/\.test\.tsx?$/.test(f));
    const css = files.filter((f) => f.endsWith(".css"));
    const sources = await Promise.all(tsx.map(async (file) => ({ file, text: await readFile(file, "utf8") })));
    const sheets = await Promise.all(css.map(async (file) => ({ file, text: await readFile(file, "utf8") })));
    const modules = await Promise.all(
      files
        .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
        .map(async (file) => ({ file, text: await readFile(file, "utf8") })),
    );

    const stacks = readStacks(sources);
    /* The population must be real — #524 added at least the crew, overview,
       moderator and foundation stacks, and casting had four before it. */
    expect(stacks.length, "no stacked register classes found — the reader is broken").toBeGreaterThanOrEqual(8);

    const foundationCss = sheets.find((s) => s.file.endsWith(path.join("foundation", "foundation.css")));
    expect(foundationCss, "foundation.css must be readable").toBeDefined();
    const registerIndex = Math.max(...REGISTER_CLASSES.map((c) => declarationIndex(foundationCss!.text, c)));
    expect(registerIndex, ".dp-chrome and .dp-eyebrow must be declared in foundation.css").toBeGreaterThan(-1);

    const problems: string[] = [];
    for (const stack of stacks) {
      for (const partner of stack.partners) {
        const declaring = sheets.filter((s) => declarationIndex(s.text, partner) > -1);
        if (declaring.length === 0) {
          problems.push(`${path.basename(stack.file)}: "${stack.literal}" — .${partner} is declared in no stylesheet`);
          continue;
        }
        for (const sheet of declaring) {
          if (sheet.file === foundationCss!.file) {
            if (declarationIndex(sheet.text, partner) < registerIndex) {
              problems.push(
                `${path.basename(stack.file)}: .${partner} is declared in foundation.css BEFORE .dp-chrome/.dp-eyebrow`,
              );
            }
            continue;
          }
          const base = path.basename(sheet.file);
          const importers = modules.filter((m) => new RegExp(`import\\s+["'][^"']*${base.replace(/\./g, "\\.")}["']`).test(code(m.text)));
          if (importers.length === 0) {
            problems.push(`${path.basename(stack.file)}: ${base} declares .${partner} but no module imports it`);
          }
          for (const importer of importers) {
            if (!foundationPrecedesStylesheet(importer.text, base)) {
              problems.push(
                `${path.basename(importer.file)} imports ${base} before (or without) the @/foundation barrel — ` +
                  `"${stack.literal}" in ${path.basename(stack.file)} is then ordered by accident`,
              );
            }
          }
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("the reader can see the violation it guards against — a stylesheet imported ahead of the barrel", () => {
    const wrongWay = `import "./crew.css";\nimport { Button } from "@/foundation";\n`;
    const rightWay = `import { Button } from "@/foundation";\nimport "./crew.css";\n`;
    const noBarrel = `import "./crew.css";\nimport { x } from "./other";\n`;
    expect(foundationPrecedesStylesheet(wrongWay, "crew.css")).toBe(false);
    expect(foundationPrecedesStylesheet(noBarrel, "crew.css")).toBe(false);
    expect(foundationPrecedesStylesheet(rightWay, "crew.css")).toBe(true);
    /* A comment quoting the wrong order must not count as the wrong order. */
    expect(foundationPrecedesStylesheet(`/* import "./crew.css"; */\n${rightWay}`, "crew.css")).toBe(true);
  });

  it("and the stack reader sees a stack, and ignores a bare register class", () => {
    const stacks = readStacks([
      { file: "a.tsx", text: `<span className="dp-chrome dp-crew__mono">x</span>` },
      { file: "b.tsx", text: `<span className="dp-chrome">x</span>` },
      { file: "c.tsx", text: `const k = seen ? "dp-chrome dp-crew__seen" : "dp-crew__unseen";` },
    ]);
    expect(stacks.map((s) => `${s.file}:${s.partners.join(",")}`)).toEqual(["a.tsx:dp-crew__mono", "c.tsx:dp-crew__seen"]);
  });

  it("the declaration reader finds a selector in a list and not inside another name", () => {
    const css = `.dp-ov__blocklabel,\n.dp-ov__tilelabel {\n  font: 500 8.5px var(--font-mono);\n}\n.dp-chrome-ish { }\n`;
    expect(declarationIndex(css, "dp-ov__tilelabel")).toBeGreaterThan(-1);
    expect(declarationIndex(css, "dp-ov__blocklabel")).toBe(0);
    expect(declarationIndex(css, "dp-chrome")).toBe(-1);
  });
});
