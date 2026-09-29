import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A SINGLE-CLASS RULE CANNOT STYLE AN ANCHOR IN THIS APP, AND THE STYLESHEET
 * NEVER SAYS SO (#1529, and #1528 the day before it).
 *
 * `foundation/tokens.css` owns every anchor in the product:
 *
 *   .dp-root a       { color: var(--ink); text-decoration: none; }   (0,2,0)
 *   .dp-root a:hover { color: var(--linkHover); }                    (0,2,1)
 *
 * So a feature rule written as `.dp-crew__link` — one class, (0,1,0) — loses
 * every `color` and `text-decoration*` declaration it makes. ⚠ **THE RULE STILL
 * MATCHES**, which is the whole reason this needs a guard: there is no unused
 * selector, no unknown property, no build warning and no failing test. It
 * photographs as "the CSS did not load".
 *
 * It has now cost two PRs in two days. #1528 wrote `.dp-ov__dashlink` and the
 * frames caught it before merge; #1529 was `.dp-crew__link`, shipped, and was
 * found by driving the page — **eight anchors on his Crew page, every one
 * computing `text-decoration-line: none` against a block that declares
 * `underline`**. Its sweep then found six more siblings nobody had looked for.
 * Two instances is a class (working law 7), and a class is a guard's job.
 *
 * # What this file holds
 *
 * ONE derived arm: every CSS rule in the app's stylesheets that declares a
 * `color` or a `text-decoration*` on a class the JSX puts on an anchor must
 * OUT-SPECIFY the blanket anchor rule it competes with. The population is READ
 * — the anchor classes out of the `.tsx`, the rules out of the `.css`, the
 * blanket rules out of `tokens.css` — so a rule written next month is judged the
 * day it lands, and none of the three lists is typed in here (working law 4).
 *
 * ⚠ **A TIE FAILS TOO, and that is deliberate.** `.dp-root a.dp-crew__link` and
 * `.dp-root a:hover` are both (0,2,1); at equal specificity the winner is
 * whichever stylesheet the bundler emitted last, which is not a thing a
 * stylesheet should depend on. #1528's own header says the same in prose. So a
 * `:hover` arm is written at (0,3,1), and this guard is what holds it there.
 *
 * # Its stated limits, because a clean run here is a floor and not coverage
 *
 * - **It reads LITERAL class names.** A `className` assembled at runtime from a
 *   variable is invisible to it. Every anchor in the tree today is literal or
 *   `cn("literal", cond && "literal")`, which it does read.
 * - ⚠ **IT ASSUMES EVERY ANCHOR IS INSIDE `.dp-root`, AND THREE OF ITS FIRST
 *   FOUR FINDINGS WERE NOT (#1531).** A surface rendered through `createPortal`
 *   hangs off `document.body`, so the blanket it is judged against never
 *   matches the element — the casting viewer and the plan modal are both
 *   portalled. There the unrooted rule is CORRECT, and "fixing" it by rooting
 *   makes the selector match nothing at all: the plan modal's support link lost
 *   its colour and its underline to that repair before a render caught it.
 *   **Check `el.closest(".dp-root")` in the running app before acting on a
 *   finding**; `PORTALLED` below is the measured remainder.
 * - **It cannot see a render.** A rule can out-specify the blanket and still be
 *   invisible — `--rule` (#F0F0F2) as an underline on white is ~1.08:1, which is
 *   exactly what #1528 photographed and rejected. Specificity is the half a
 *   source guard can hold; the colour is law 6's and law 9's.
 * - **It judges the rule's RIGHTMOST compound only.** `.dpc-viewer__caption
 *   .dp-chrome` is not held to the anchor rule because `.dp-chrome` there is on
 *   a `<span>`; the guard would have to resolve the DOM to know better, and a
 *   false red on a stylesheet is how a guard gets switched off.
 *
 * # The one exemption, and why it is not a fix
 *
 * `.dp-chrome` (`foundation/foundation.css`) is a typography utility on 30
 * elements, exactly ONE of which is an anchor — CrewPipeline's `#1234` chip —
 * and there it is stacked with `.dp-crew__ref`, whose own comment (#807) says it
 * is written to sit on top of `.dp-chrome`. `.dp-root a.dp-crew__ref` carries
 * that element's colour, so `.dp-chrome`'s `--muted` was never going to apply to
 * it either way. Rooting `.dp-chrome` would bind a foundation utility to being
 * an anchor and change 29 elements that are not.
 */

/* `import.meta.url` is a file:// URL; on Windows it arrives as /C:/… */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const CLIENT_SRC = path.resolve(HERE, "..");

/**
 * A class that is held to the anchor rule only through a companion class that
 * already carries the colour on the same element. See the header; each entry
 * names the element and the rule that wins there.
 */
const COMPANION_CARRIED = new Set([
  // foundation/foundation.css — on an <a> only at CrewPipeline.tsx's `#1234`
  // chip, where `.dp-root a.dp-crew__ref` supplies the colour.
  "dp-chrome",
]);

/**
 * THE ANCHORS THE BLANKET NEVER REACHES, BECAUSE THEY ARE NOT INSIDE `.dp-root`
 * (#1531) — AND THIS IS A FALSE-POSITIVE CLASS OF THIS GUARD, NOT A DEBT.
 *
 * #1529's sweep reached four classes outside the staff surfaces it was fixing
 * and #1531 was filed to pay them. **Driven in the running app, both themes,
 * with the stylesheets before and after, three of the four were not defects at
 * all**, and the fourth's stated reason was wrong. What the source cannot see:
 * `CandidateViewer` is `createPortal`'d to `document.body` (its own docblock
 * says so) and the plan modal is portalled too, so **`.dp-root a` is not in
 * play for either** — the rule it "loses to" never matches the element.
 *
 * Measured at `getComputedStyle`, light → dark, on the unfixed tree:
 *
 * - `dp-btn--onmedia` — the casting viewer's download glyph: `rgb(255,255,255)`
 *   in both themes, i.e. `--onScrim`, the value its block declares. The card
 *   said it rendered `#111112` and was "almost invisible" beside a white close
 *   button; both controls measure white, and rooting the rule changed nothing.
 * - `dp-plan__request-link` — the billing modal's support link:
 *   `rgb(17,17,18)` / `rgb(237,237,239)` with `text-decoration-line: underline`.
 *   The card said it had no underline. It has one. ⚠ **Rooting this rule as
 *   `.dp-root a.dp-plan__request-link` BROKE it** — outside `.dp-root` the
 *   rooted selector matches nothing, so the anchor fell back to Tailwind
 *   preflight's `a { color: inherit }` and painted its parent's `--metaStrong`
 *   with the underline gone. The fix was the defect.
 *
 * So these two keep their unrooted blocks, which are correct where they render,
 * and the guard is told why rather than being made to pass by a change that
 * makes the product worse. The other two of the four are resolved in the tree:
 * `dp-btn--quiet` was a REAL defect (it renders inside `.dp-root`) and is fixed
 * in `foundation.css`; `dpc-viewer__download`'s `text-decoration` was dead and
 * is deleted.
 *
 * ⚠ **THE EXEMPTION CANNOT WIDEN QUIETLY.** Each entry records every anchor
 * call site its class had when it was MEASURED, and the arm below reddens if
 * that set changes — a second `<a>` wearing `dp-btn--onmedia`, anywhere, may
 * well be inside `.dp-root`, where the blanket does reach it and the finding is
 * real again. Files rather than `file:line`, so an edit above the element does
 * not redden a guard for moving a line.
 */
const PORTALLED = new Map<string, readonly string[]>([
  // The viewer is portalled to document.body; measured white in both themes.
  ["dp-btn--onmedia", ["features/castingV2/components/CandidateViewer.tsx"]],
  // The plan modal is portalled; measured --ink + underline in both themes.
  ["dp-plan__request-link", ["features/billing/ChangePlanModal.tsx"]],
]);

/** Every source file under client/src, read once. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const FILES = walk(CLIENT_SRC);
const rel = (file: string) => path.relative(CLIENT_SRC, file).split(path.sep).join("/");

/** color / text-decoration and its longhands — the properties the blanket owns. */
const CONTESTED = /(?:^|[;{])\s*(?:color|text-decoration(?:-line|-color|-style|-thickness)?)\s*:/;

/**
 * CSS specificity as (ids, classes, types). Pseudo-ELEMENTS count as a type and
 * pseudo-CLASSES as a class, which is the difference that makes `.dp-root a`
 * (0,1,1) and `.dp-root a:hover` (0,2,1) two different bars to clear.
 */
export function specificity(selector: string): [number, number, number] {
  let s = selector.replace(/::[a-z-]+(?:\([^)]*\))?/g, " ELEMENT ");
  s = s.replace(/:[a-z-]+(?:\([^)]*\))?/g, " PSEUDOCLASS ");
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes =
    (s.match(/\.[\w-]+/g) ?? []).length +
    (s.match(/\[[^\]]+\]/g) ?? []).length +
    (s.match(/\bPSEUDOCLASS\b/g) ?? []).length;
  const types =
    (s.replace(/\.[\w-]+|#[\w-]+|\[[^\]]+\]|\bPSEUDOCLASS\b|\bELEMENT\b/g, " ").match(/\b[a-z][a-z0-9]*\b/g) ?? [])
      .length + (s.match(/\bELEMENT\b/g) ?? []).length;
  return [ids, classes, types];
}

const compare = (a: [number, number, number], b: [number, number, number]) =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The pseudo-class state a selector applies in, so a rest rule is not judged against a hover one. */
const stateOf = (selector: string) =>
  (selector.match(/:(?:hover|focus-visible|focus|active|visited)/g) ?? []).sort();

/**
 * Whether a blanket rule in state `house` is in play for an element the rule in
 * state `rule` is styling — i.e. is `house` a SUBSET of `rule`?
 *
 * ⚠ **A `:hover` RULE COMPETES WITH THE BASE BLANKET TOO, and the first shape of
 * this reader compared states for EQUALITY and so missed that.** `.dp-root a`
 * applies to a hovered anchor exactly as it applies to a resting one, which is
 * how `.dp-crew__link:hover`'s `text-decoration-color` came to be judged against
 * nothing. The other direction is not true: `.dp-root a:hover` does not reach an
 * anchor that is focus-visible and not hovered.
 */
const inPlay = (house: string[], rule: string[]) => house.every((p) => rule.includes(p));

type Rule = { file: string; selector: string; body: string; spec: [number, number, number] };

/** Every rule in every stylesheet, comments stripped — a guard must not read the prose about the bug. */
export function parseRules(files: readonly string[]): Rule[] {
  const rules: Rule[] = [];
  for (const file of files) {
    if (!file.endsWith(".css")) continue;
    const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const match of css.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
      const selectorList = match[1].trim();
      if (!selectorList || selectorList.startsWith("@") || /^\d/.test(selectorList)) continue;
      for (const selector of selectorList.split(",").map((s) => s.trim()).filter(Boolean)) {
        rules.push({ file: rel(file), selector, body: match[2], spec: specificity(selector) });
      }
    }
  }
  return rules;
}

/** A rule whose rightmost compound is the bare type `a` — the only kind that matches every anchor. */
const isBlanketAnchorRule = (selector: string) =>
  /(?:^|[\s>+~])a(?::[a-z-]+(?:\([^)]*\))*)*$/.test(selector);

/**
 * Class literals the JSX puts on an `<a>` or a wouter `<Link>` (which renders an
 * anchor), and where each was seen.
 *
 * ⚠ **IT READS THE WHOLE ELEMENT HEAD, NOT THE LINE — the first shape of this
 * read was per-line and found 6 classes where there are 14.** Every anchor with
 * more than two attributes in this tree is written across several lines, so a
 * line-based read missed `.dp-ov__dashlink` (#1528's own fix, and the negative
 * control this guard leans on), `.dp-crew__hold`, `.dp-plan__request-link`,
 * `.dpc-card` and the media download button. A guard whose population silently
 * halves is the shape that passes by finding nothing.
 */
export function anchorClasses(files: readonly string[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of files) {
    if (!file.endsWith(".tsx")) continue;
    const src = fs.readFileSync(file, "utf8");
    for (const open of src.matchAll(/<(a|Link)(?=[\s/>])/g)) {
      /* The element head: from the tag to the `>` that closes it, ignoring any
         `>` inside an attribute's braces, quotes or a nested arrow function. */
      let depth = 0;
      let end = -1;
      for (let i = open.index + open[0].length; i < src.length; i += 1) {
        const ch = src[i];
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
        else if (ch === ">" && depth === 0) {
          if (src[i - 1] === "=") continue; // an arrow inside a bare attribute
          end = i;
          break;
        }
      }
      if (end === -1) continue;
      const head = src.slice(open.index, end);
      const line = src.slice(0, open.index).split("\n").length;
      for (const match of head.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{([^]*?)\})/g)) {
        const raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
        for (const token of raw.split(/[\s"'`${}?:&|,()[\]]+/)) {
          /* Literal `dp*` class names only — the product's own prefix. A class
             assembled from a variable is invisible here; stated in the header. */
          if (!/^dp[\w-]*$/.test(token)) continue;
          const at = `${rel(file)}:${line}`;
          const seen = found.get(token) ?? [];
          if (!seen.includes(at)) seen.push(at);
          found.set(token, seen);
        }
      }
    }
  }
  return found;
}

/** The contested longhands a declaration block actually sets, `text-decoration` expanded. */
function contestedProps(body: string): Set<string> {
  const props = new Set<string>();
  for (const match of body.matchAll(/(?:^|[;{])\s*(color|text-decoration(?:-line|-color|-style|-thickness)?)\s*:/g)) {
    const prop = match[1];
    if (prop === "text-decoration") {
      /* The shorthand resets every longhand, which is exactly how `.dp-root a`
         came to discard a `text-decoration-color` declared one file away. */
      props.add("text-decoration-line");
      props.add("text-decoration-color");
      props.add("text-decoration-style");
      props.add("text-decoration-thickness");
    } else props.add(prop);
  }
  return props;
}

/** The rightmost compound's anchor classes, exemptions removed. */
function anchorClassesOn(rule: Rule, onAnchors: Map<string, string[]>): string[] {
  const rightmost = rule.selector.split(/[\s>+~]+/).filter(Boolean).pop() ?? "";
  return [...rightmost.matchAll(/\.([\w-]+)/g)]
    .map((m) => m[1])
    .filter((c) => onAnchors.has(c) && !COMPANION_CARRIED.has(c) && !PORTALLED.has(c));
}

/**
 * Every place an anchor class's colour or underline is decided BY THE BLANKET
 * rather than by the rule that means to decide it.
 *
 * ⚠ **THE VERDICT IS PER (class, state, PROPERTY), NOT PER RULE — and the first
 * shape of this reader was per rule, which reported a fix as a defect.** A class
 * may legitimately keep an unrooted block: `.dp-crew__ref` sits on four `<span>`s
 * and one `<a>`, so it cannot be rooted in place, and the anchor case is carried
 * by a second rule beside it. That second rule out-specifies the blanket and
 * therefore supplies the colour — nothing is lost, and flagging the first block
 * would have told a shift to break the four spans. So a losing declaration is a
 * finding only when NO rule on the same class, in the same state, wins the SAME
 * property.
 */
export function inertAnchorRules(files: readonly string[]) {
  const rules = parseRules(files);
  const blanket = rules.filter((r) => CONTESTED.test(r.body) && isBlanketAnchorRule(r.selector));
  const onAnchors = anchorClasses(files);

  /** `class|state|prop` for every declaration that BEATS the blanket it competes with. */
  const covered = new Set<string>();
  for (const rule of rules) {
    if (blanket.includes(rule) || !CONTESTED.test(rule.body)) continue;
    const classes = anchorClassesOn(rule, onAnchors);
    if (classes.length === 0) continue;
    const state = stateOf(rule.selector);
    const competing = blanket.filter((h) => inPlay(stateOf(h.selector), state));
    if (competing.length === 0) continue;
    if (!competing.every((h) => compare(rule.spec, h.spec) > 0)) continue;
    for (const cls of classes) {
      for (const prop of contestedProps(rule.body)) covered.add(`${cls}|${state.join("+")}|${prop}`);
    }
  }

  const findings: Array<{ rule: Rule; beaten: Rule; classes: string[]; props: string[] }> = [];
  for (const rule of rules) {
    if (blanket.includes(rule) || !CONTESTED.test(rule.body)) continue;
    const classes = anchorClassesOn(rule, onAnchors);
    if (classes.length === 0) continue;
    const state = stateOf(rule.selector);
    for (const house of blanket) {
      if (!inPlay(stateOf(house.selector), state)) continue;
      if (compare(rule.spec, house.spec) > 0) continue;
      /* Only the properties the blanket actually contests here, and only those
         no rooted rule has already claimed for this class and state. */
      const houseProps = contestedProps(house.body);
      const props = [...contestedProps(rule.body)].filter(
        (p) => houseProps.has(p) && !covered.has(`${classes[0]}|${state.join("+")}|${p}`),
      );
      if (props.length === 0) continue;
      findings.push({ rule, beaten: house, classes, props: props.sort() });
    }
  }
  return { findings, blanket, onAnchors, ruleCount: rules.length };
}

type Finding = ReturnType<typeof inertAnchorRules>["findings"][number];

/** One line per finding, naming the file, both weights, the properties and a call site. */
function describeFindings(findings: readonly Finding[], onAnchors: Map<string, string[]>): string[] {
  return findings.map(
    ({ rule, beaten, classes, props }) =>
      `${rule.file}  "${rule.selector}" (${rule.spec.join(",")}) ` +
      `${compare(rule.spec, beaten.spec) === 0 ? "ties" : "loses to"} "${beaten.selector}" ` +
      `(${beaten.spec.join(",")}) on ${props.join(", ")} — on an <a> at ` +
      classes.map((c) => `${c} ${(onAnchors.get(c) ?? [])[0] ?? "?"}`).join(", "),
  );
}

describe("a rule that styles an anchor out-specifies the blanket anchor rule", () => {
  const read = inertAnchorRules(FILES);

  it("reads a real population — the sweep cannot pass by finding nothing", () => {
    /* Working law 2's negative control. Each of these three reads has been the
       one that silently returned empty at some point while this was written:
       the stylesheet walk (a wrong root), the blanket read (a regex that wanted
       `.dp-root a` literally and so missed `a:hover`), and the JSX read. */
    expect(read.ruleCount).toBeGreaterThan(800);
    expect(read.blanket.map((r) => r.selector).sort()).toEqual([".dp-root a", ".dp-root a:hover"]);
    expect(read.blanket.every((r) => r.file === "foundation/tokens.css")).toBe(true);
    expect(read.onAnchors.size).toBeGreaterThan(10);
    expect([...read.onAnchors.keys()]).toContain("dp-crew__link");
    /* The population MUST reach a multi-line anchor, which the first reader could
       not see — #1528's own fix is the specimen, and it is also the rule that
       proves a correctly rooted block is not reported. */
    expect([...read.onAnchors.keys()]).toContain("dp-ov__dashlink");
    expect(read.findings.some((f) => f.classes.includes("dp-ov__dashlink"))).toBe(false);
  });

  it("no rule styling an anchor's colour or underline is overridden by the blanket", () => {
    expect(
      describeFindings(read.findings, read.onAnchors),
      "each rule above matches but has every colour/text-decoration declaration discarded — " +
        "root it as `.dp-root a.<class>`, and write its :hover arm rooted too (a tie is settled by " +
        "stylesheet order, not by intent). ⚠ FIRST check the element is actually inside `.dp-root`: " +
        /* Card 1531's number is deliberately NOT written with its `#` inside this
           string: `token-guard.test.ts` reads `#` + four hex digits as a hardcoded
           colour, and every issue number from 100 up is valid hex. It strips
           comments, so the header above may say `#1531` freely — a message a
           customer never sees is not worth an exemption in a colour guard. */
        "a portalled surface is not, and rooting its rule there BREAKS it (card 1531). See this file's header.",
    ).toEqual([]);
  });

  it("a PORTALLED class has not gained an anchor the measurement never saw", () => {
    /* The exemption is only as good as the population it was measured over. A
       new `<a>` wearing one of these classes may sit INSIDE `.dp-root`, where
       the blanket does reach it — so the set of files is pinned and a change
       sends a human back to `getComputedStyle` rather than passing quietly. */
    const drift = [...PORTALLED.entries()].flatMap(([cls, files]) => {
      const seen = (read.onAnchors.get(cls) ?? []).map((at) => at.split(":")[0]!).sort();
      const pinned = [...files].sort();
      return seen.length === pinned.length && seen.every((f, i) => f === pinned[i])
        ? []
        : [`${cls}: measured over [${pinned.join(", ")}], now on [${seen.join(", ")}]`];
    });
    expect(
      drift,
      "a class exempted as portalled is now on an anchor that was not there when it was measured — " +
        "drive the new one and read `getComputedStyle(el).color` with `el.closest('.dp-root')`. If it " +
        "IS inside the shell, the finding is real and the exemption must not cover it.",
    ).toEqual([]);
  });

  it("the guard can fail — the shape it exists to catch, a tie, and a fix it must NOT call a defect", () => {
    /* Positive controls, then a negative one. Without these the arm above proves
       only that a regex compiles — and the third fixture is here because the
       first shape of this reader FAILED it: it reported `.dp-crew__ref`'s span
       rule as a defect while the rooted rule beside it supplied the colour. */
    const dir = fs.mkdtempSync(path.join(process.env.TEMP ?? "/tmp", "anchor-cascade-"));
    const HOUSE = `
      .dp-root a { color: var(--ink); text-decoration: none; }
      .dp-root a:hover { color: var(--linkHover); }
    `;
    const fixture = (css: string, name: string) => {
      const cssPath = path.join(dir, `${name}.css`);
      const tsxPath = path.join(dir, `${name}.tsx`);
      fs.writeFileSync(cssPath, `${HOUSE}\n${css}`);
      fs.writeFileSync(tsxPath, `<a className="dp-crew__link dp-crew__ref" href={u}>t</a>`);
      return [cssPath, tsxPath];
    };

    /* 1 · #1529's block exactly as it stood.
       ⚠ ONLY THE REST HALF IS REPORTED, AND THAT IS THE CORRECT READING — the
       expectation here asserted both at first and the reader was right, not the
       fixture. `.dp-crew__link:hover` is (0,2,0), which BEATS `.dp-root a`
       (0,1,1), so its `text-decoration-color: var(--ink)` genuinely applied; the
       hover was pointless because the REST half had lost `text-decoration-line`,
       leaving no line to colour. A cascade guard sees overridden declarations,
       not pointless ones — "a longhand set with its `-line` at `none`" is a
       different class and is named as a limit in the header, not smuggled in
       here to make one fixture read more dramatically. */
    const before = inertAnchorRules(
      fixture(
        `.dp-crew__link { color: inherit; text-decoration: underline; text-decoration-color: var(--rule); }
         .dp-crew__link:hover { text-decoration-color: var(--ink); }`,
        "before",
      ),
    );
    expect(before.blanket).toHaveLength(2);
    expect(before.findings.map((f) => f.rule.selector)).toEqual([".dp-crew__link"]);
    expect(before.findings[0]!.props).toContain("text-decoration-line");
    expect(before.findings[0]!.props).toContain("color");

    /* 2 · A TIE, which #1528's header warns about and file order would settle:
       `a.dp-crew__link:hover` is (0,2,1), the same weight as `.dp-root a:hover`. */
    const tie = inertAnchorRules(
      fixture(
        `.dp-root a.dp-crew__link { text-decoration-line: underline; }
         a.dp-crew__link:hover { color: var(--ink); }`,
        "tie",
      ),
    );
    expect(tie.findings.map((f) => f.rule.selector)).toEqual(["a.dp-crew__link:hover"]);
    expect(compare(tie.findings[0]!.rule.spec, tie.findings[0]!.beaten.spec)).toBe(0);

    /* 3 · NEGATIVE CONTROL — the shape this tree actually ships for
       `.dp-crew__ref`: an unrooted block for the spans, plus a rooted rule that
       wins the anchor. Nothing is lost, so nothing is reported. */
    const companion = inertAnchorRules(
      fixture(
        `.dp-crew__ref { color: var(--faint); }
         .dp-root a.dp-crew__ref { color: var(--faint); text-decoration-line: underline; }`,
        "companion",
      ),
    );
    expect(companion.findings).toEqual([]);

    /* …and it is genuinely the rooted rule doing that work: drop it and the
       unrooted block is a finding again. */
    const withoutCompanion = inertAnchorRules(fixture(`.dp-crew__ref { color: var(--faint); }`, "alone"));
    expect(withoutCompanion.findings.map((f) => f.rule.selector)).toEqual([".dp-crew__ref"]);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("specificity counts pseudo-elements as types and pseudo-classes as classes", () => {
    expect(specificity(".dp-root a")).toEqual([0, 1, 1]);
    expect(specificity(".dp-root a:hover")).toEqual([0, 2, 1]);
    expect(specificity(".dp-root a.dp-crew__link")).toEqual([0, 2, 1]);
    expect(specificity(".dp-root a.dp-crew__link:hover")).toEqual([0, 3, 1]);
    expect(specificity(".dp-crew__link")).toEqual([0, 1, 0]);
    expect(specificity("a::after")).toEqual([0, 0, 2]);
    expect(specificity("#id .c a")).toEqual([1, 1, 1]);
  });

  it("the fix it was written for is in the tree, rooted on both states", () => {
    const crew = fs.readFileSync(
      path.join(CLIENT_SRC, "features/admin/components/crew/crew.css"),
      "utf8",
    );
    expect(crew).toMatch(/\.dp-root a\.dp-crew__link\s*\{[^}]*text-decoration-line:\s*underline/);
    /* `--rule` and `--border` are invisible as an underline on white — #1528's
       frames. currentColor is the answer that was looked at. */
    expect(crew).toMatch(/\.dp-root a\.dp-crew__link\s*\{[^}]*text-decoration-color:\s*currentColor/);
    expect(crew).toMatch(/\.dp-root a\.dp-crew__link:hover/);
    expect(crew).not.toMatch(/^\.dp-crew__link\s*[,{]/m);
  });
});
