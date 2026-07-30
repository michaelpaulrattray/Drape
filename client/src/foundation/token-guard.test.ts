import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No-hex source guard (plan §D.1, §D.2, §M "source/contract guards").
 *
 * The foundation's first non-negotiable is that a colour may only exist in
 * `tokens.css`. Nothing behavioural can see a violation — a hardcoded hex looks
 * right in one theme and wrong in the other, which is exactly the class of bug
 * the three parallel token systems produced. So this is a grep, modelled on
 * server/storage-key-generation.test.ts.
 *
 * It guards the foundation and V2 trees only. It grows with adoption rather
 * than trying to boil the ~600 lines of legacy utility CSS on day one.
 */

const clientSrc = path.resolve(__dirname, "..");

/** Directories and files under guard. Missing paths are fine — they arrive later. */
const GUARDED_PATHS = [
  "foundation",
  "features/casting-v2",
  "pages/CastingFoundation.tsx",
];

/**
 * The only files allowed a hex literal, each for a documented reason
 * (foundation README rule 1, plan §D.1). Adding a row here is a design
 * decision, not a convenience.
 */
const HEX_CARVE_OUTS: Record<string, string> = {
  "foundation/tokens.css": "the token source itself — the one place a colour may exist",
  "foundation/brand-orb.css":
    "the brand orb's gradient is artwork, identical in both themes, not a semantic colour",
};

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/g;
/** Tailwind's arbitrary-value escape hatch — the drift vector the README warns about. */
const ARBITRARY_COLOR = /\[#[0-9a-fA-F]{3,8}/g;

const GUARDED_EXTENSIONS = [".css", ".ts", ".tsx"];

function collect(target: string): string[] {
  const absolute = path.join(clientSrc, target);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [absolute];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) return collect(path.relative(clientSrc, child));
    return GUARDED_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [child] : [];
  });
}

const guardedFiles = GUARDED_PATHS.flatMap(collect).map((file) => ({
  relative: path.relative(clientSrc, file).replaceAll("\\", "/"),
  source: fs.readFileSync(file, "utf8"),
}));

describe("foundation colours live only in tokens.css", () => {
  it("guards a non-empty set of files", () => {
    // A guard that matches nothing does not exist.
    expect(guardedFiles.length).toBeGreaterThan(0);
    expect(guardedFiles.map((f) => f.relative)).toContain("foundation/tokens.css");
  });

  it("allows a hex only in the carved-out files", () => {
    const offenders = guardedFiles
      .filter(({ relative }) => !(relative in HEX_CARVE_OUTS))
      .flatMap(({ relative, source }) =>
        (source.match(HEX_LITERAL) ?? []).map((hex) => `${relative}: ${hex}`),
      );

    expect(
      offenders,
      "Use a token from foundation/tokens.css instead of a hex literal",
    ).toEqual([]);
  });

  it("rejects Tailwind arbitrary colour values", () => {
    const offenders = guardedFiles.flatMap(({ relative, source }) =>
      (source.match(ARBITRARY_COLOR) ?? []).map((match) => `${relative}: ${match}`),
    );

    expect(
      offenders,
      "Arbitrary-value colours bypass the token system — add a token instead",
    ).toEqual([]);
  });

  it("keeps every carve-out honest — each one must exist and still need it", () => {
    for (const [relative, reason] of Object.entries(HEX_CARVE_OUTS)) {
      const file = guardedFiles.find((candidate) => candidate.relative === relative);
      expect(file, `Carve-out ${relative} no longer exists — remove it (${reason})`).toBeDefined();
      expect(
        file!.source.match(HEX_LITERAL),
        `Carve-out ${relative} has no hex left — remove the exception (${reason})`,
      ).not.toBeNull();
    }
  });
});

describe("no stylesheet shadows a Tailwind utility name", () => {
  /**
   * The marketing stylesheet defined unlayered `.text-primary`,
   * `.text-secondary` and `.text-muted`. Being unlayered, they beat Tailwind's
   * layered utilities of the same name *everywhere in the app*, not just on
   * the pages that stylesheet exists to style. Removed at M2 — this stops the
   * class of bug rather than those three instances.
   */
  const SHADOWABLE = [
    "text-primary",
    "text-secondary",
    "text-muted",
    "text-foreground",
    "text-background",
    "bg-primary",
    "bg-secondary",
    "bg-muted",
    "bg-background",
    "border-border",
    "border-input",
  ];

  // Every global stylesheet still in the tree. styles/tokens.css was deleted —
  // it was wholly dead, yet its unlayered :root block shadowed Tailwind's grey,
  // leading and shadow scales app-wide.
  const stylesheets = ["styles/animations.css", "styles/canvas-tokens.css"]
    .filter((relative) => fs.existsSync(path.join(clientSrc, relative)))
    .map((relative) => ({
      relative,
      source: fs.readFileSync(path.join(clientSrc, relative), "utf8"),
    }));

  it("declares no class whose name is a Tailwind semantic utility", () => {
    const offenders = stylesheets.flatMap(({ relative, source }) =>
      SHADOWABLE.filter((name) =>
        new RegExp(`^\\s*\\.${name}\\s*(,|\\{)`, "m").test(source),
      ).map((name) => `${relative}: .${name}`),
    );

    expect(
      offenders,
      "An unlayered class with a utility's name overrides that utility app-wide",
    ).toEqual([]);
  });
});

describe("foundation tokens define every token in both themes", () => {
  const tokens = fs.readFileSync(path.join(clientSrc, "foundation", "tokens.css"), "utf8");

  function declaredIn(selector: string): Set<string> {
    const block = tokens.slice(tokens.indexOf(selector));
    const body = block.slice(block.indexOf("{") + 1, block.indexOf("\n}"));
    return new Set([...body.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((match) => match[1]));
  }

  const light = declaredIn(":root {");
  const dark = declaredIn('[data-theme="dark"] {');

  /**
   * Structure, not colour: geometry, radii, spacing, type and motion are the
   * same in both themes by design, and the scrim group is identical on purpose
   * because media does not have a theme (README §6).
   */
  const THEME_INVARIANT = /^--(s-|r-|t-|font-|rail-w|topbar-h|content-max|blur-bar|ease|scrim|onScrim|onWash|error)/;

  it("overrides every themeable colour in dark", () => {
    const missing = [...light].filter(
      (token) => !THEME_INVARIANT.test(token) && !dark.has(token),
    );
    expect(
      missing,
      "A token missing from the dark block forces a component to branch on theme",
    ).toEqual([]);
  });

  it("declares no dark token that light does not define", () => {
    const orphans = [...dark].filter((token) => !light.has(token));
    expect(orphans).toEqual([]);
  });

  it("declares the tokens at :root so they reach portaled content", () => {
    // M2 promoted these out of the shell subtree. Radix portals mount on
    // <body>; a scoped block would leave every dialog and menu untokenised.
    expect(tokens).toMatch(/^:root\s*\{/m);
    expect(tokens).toMatch(/^\[data-theme="dark"\]\s*\{/m);
    expect(tokens).not.toContain('[data-theme="dark"] .dp-root');
  });

  it("keeps the shell reset off `body` so marketing keeps its own type", () => {
    // §D.7: the brochure stays on Inter. A global body font-family here would
    // put Archivo on it — the reset belongs to the shell, not the document.
    expect(tokens).not.toMatch(/^body\s*\{/m);
    expect(tokens).toContain(".dp-root {\n  background: var(--surface);");
  });
});
