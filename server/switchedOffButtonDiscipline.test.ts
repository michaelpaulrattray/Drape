import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";

/**
 * A SWITCHED-OFF BUTTON READS AS SWITCHED OFF (#1237).
 *
 * The founder's word, 2026-09-25, verbatim and entire: *"Give switched-off
 * buttons a quieter look and a normal pointer"*.
 *
 * ⚠ **What it is guarding against is a rule that says NOTHING**, which is why
 * every arm here is derived rather than a list of the places already fixed. The
 * defect it closes was not a wrong declaration anyone made — the shared button
 * block set `cursor: pointer` and never mentioned the switched-off state at
 * all, so 43 buttons in 22 files, two of them on the money pages, looked
 * exactly like buttons that work: measured in the running app in both themes
 * with `opacity: 1`, `cursor: pointer`, and the resting colour. A guard keyed on
 * those 43 would stop watching the moment they were fixed; these arms ask the
 * stylesheets the question instead, so a button family written next month is in
 * the population the day it is written.
 *
 * **Three properties, each derived:**
 *
 * 1. The shared button rules answer at all — a fade and an ordinary pointer.
 * 2. No hover rule in the product re-brightens a control that is switched off.
 *    A quieter look that un-quiets under the pointer is the same defect wearing
 *    a mouse.
 * 3. No switched-off BUTTON asks for the "no entry" pointer. His sentence says
 *    normal, and `not-allowed` is a special one.
 *
 * ⚠ **THE EXEMPTIONS ARE DERIVED, NOT ENUMERATED, EXCEPT ONE — and the one is
 * named with its reason.** A class may carry an explicit switched-off hover rule
 * of its own (the concept entry card resets its border and background that way
 * rather than suppressing the hover); that is a second legitimate shape and the
 * reader recognises it from the stylesheet rather than from a filename. The
 * single hard-coded exemption is a disabled TEXT INPUT on an unbuilt placeholder
 * — not a button, so outside the sentence — and it is listed below so that its
 * disappearance is visible rather than silent.
 *
 * **Stated limit, because a floor declared beats a floor discovered:** these are
 * SOURCE arms over the stylesheets. They cannot see an inline style, a
 * `style={{…}}` prop, or a page-level override, and they cannot see whether the
 * fade they prove is legible — the frames on the card and his eye are the other
 * half of this (law 9). What they can prove is that the question is answered
 * somewhere rather than nowhere, which is exactly what was missing.
 */

/* This suite lists a directory tree and reads what the listing named, so it is
   in #741's population and declares the class's timeout at file level. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const ROOT = path.resolve(import.meta.dirname, "..");
const CLIENT_SRC = path.join(ROOT, "client", "src");

/**
 * The one exemption that is a name rather than a shape, with its reason beside
 * it. A disabled `<input>` on the cast room's not-built-yet refine card: his
 * ruling is about BUTTONS, and the "no entry" pointer on a text field a customer
 * genuinely cannot type in is a different convention that was never asked about.
 */
const NOT_A_BUTTON: Readonly<Record<string, string>> = {
  ".dpc-rrefine__input":
    "a disabled <input> on the cast room's unbuilt refine card, not a button",
};

type Rule = { selectors: string[]; body: string; file: string };

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function clientStylesheets(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      /* `throwIfNoEntry: false` for the same reason the reader below is the
         listed-source one: a file may leave between the listing and the stat. */
      const stats = statSync(full, { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isDirectory()) walk(full);
      else if (entry.endsWith(".css")) found.push(full);
    }
  };
  walk(CLIENT_SRC);
  return found.sort();
}

/** Every top-level rule in a stylesheet, flattened. See the limit below. */
export function rulesIn(css: string, file: string): Rule[] {
  const rules: Rule[] = [];
  for (const match of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("@"));
    if (selectors.length === 0) continue;
    rules.push({ selectors, body: match[2], file });
  }
  return rules;
}

/**
 * ⚠ The regex above flattens an `@media` block's contents into top-level rules,
 * so a button rule inside a media query reads as unconditional. That is the
 * same stated remainder the outlined-box reader carries and for the same reason:
 * it errs toward READING a rule rather than skipping it, so the arms here stay
 * strict under it rather than going quiet.
 */

/**
 * ⚠ **`:not(:disabled)` CONTAINS `:disabled`, and reading it as one cost this
 * suite its first sabotage.** With the naive test, every hover rule guarded by
 * this very fix registered as a switched-off rule: the classes so guarded
 * landed in the "already answers" set, the cross-reading arm exempted them, and
 * deleting a real switched-off rule left all ten arms green. So the negation
 * groups come OUT before the question is asked — and the control that found it
 * is the reason this is a comment rather than a defect.
 */
const withoutNegations = (selector: string): string =>
  selector.replace(/:not\([^)]*\)/g, "");
const isSwitchedOff = (selector: string): boolean =>
  /(?::disabled|\[disabled\])/.test(withoutNegations(selector));
const SWITCHED_OFF = { test: isSwitchedOff };
const classesIn = (selector: string): string[] =>
  [...selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => `.${m[1]}`);
const declaration = (body: string, property: string): string | null => {
  const hit = body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`));
  return hit ? hit[1].trim() : null;
};

const ALL_RULES = clientStylesheets().flatMap((file) =>
  rulesIn(readListedSource(file) ?? "", path.relative(ROOT, file)),
);

describe("the reader can fail (working law 2)", () => {
  it("POSITIVE — it finds an unguarded hover and a hand pointer in a fixture", () => {
    const fixture = rulesIn(
      ".x { cursor: pointer; } .x:hover { opacity: 0.8; } .x:disabled { cursor: not-allowed; }",
      "fixture.css",
    );
    expect(fixture).toHaveLength(3);
    expect(classesIn(fixture[1].selectors[0])).toEqual([".x"]);
    expect(fixture[1].selectors[0].includes(":not(:disabled)")).toBe(false);
    expect(declaration(fixture[2].body, "cursor")).toBe("not-allowed");
    expect(SWITCHED_OFF.test(fixture[2].selectors[0])).toBe(true);
  });

  it("NEGATIVE — a guarded hover and an ordinary pointer read as clean", () => {
    const fixture = rulesIn(
      ".x:hover:not(:disabled) { opacity: 0.8; } .x:disabled { cursor: default; }",
      "fixture.css",
    );
    expect(fixture[0].selectors[0].includes(":not(:disabled)")).toBe(true);
    expect(declaration(fixture[1].body, "cursor")).toBe("default");
  });

  it("sweeps a real population — a clean answer over no stylesheets is not an answer", () => {
    expect(clientStylesheets().length).toBeGreaterThan(5);
    expect(ALL_RULES.length).toBeGreaterThan(500);
    expect(ALL_RULES.filter((r) => r.selectors.some((s) => SWITCHED_OFF.test(s))).length)
      .toBeGreaterThan(10);
  });
});

describe("the shared button rules answer the question (#1237)", () => {
  /* Named rather than derived on purpose: THAT these two exist is the fix, so
     the arm has to be able to notice one being deleted. Everything about their
     content below is read, not transcribed. */
  for (const selector of [".dp-btn:disabled", ".dp-iconbtn:disabled"]) {
    it(`${selector} fades and hands back an ordinary pointer`, () => {
      const rule = ALL_RULES.find((r) => r.selectors.includes(selector));
      expect(rule, `${selector} has no rule — a switched-off button reads as live`).toBeTruthy();
      const opacity = Number(declaration(rule!.body, "opacity"));
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
      expect(declaration(rule!.body, "cursor")).toBe("default");
    });
  }
});

describe("nothing re-brightens a switched-off control under the pointer (#1237)", () => {
  it("every hover rule on a class that can be switched off is guarded", () => {
    const canBeSwitchedOff = new Set(
      ALL_RULES.filter((r) => r.selectors.some((s) => SWITCHED_OFF.test(s))).flatMap((r) =>
        r.selectors.filter((s) => SWITCHED_OFF.test(s)).flatMap(classesIn),
      ),
    );
    /* A class that states its OWN switched-off hover has answered the question
       its own way; the entry card resets border and background there rather
       than suppressing the hover. Derived from the stylesheet, never a name. */
    const answersInItsOwnHover = new Set(
      ALL_RULES.flatMap((r) => r.selectors)
        .filter((s) => s.includes(":hover") && SWITCHED_OFF.test(s))
        .flatMap(classesIn),
    );

    const unguarded = ALL_RULES.flatMap((r) =>
      r.selectors
        .filter((s) => s.includes(":hover") && !s.includes(":not(:disabled)") && !SWITCHED_OFF.test(s))
        .filter((s) =>
          classesIn(s).some((c) => canBeSwitchedOff.has(c) && !answersInItsOwnHover.has(c)),
        )
        .map((s) => `${r.file}  ${s}`),
    );

    expect(canBeSwitchedOff.size).toBeGreaterThan(10);
    expect(unguarded, "a switched-off control still lights up on hover").toEqual([]);
  });
});

describe("no control promises a press it cannot keep (#1237 — the original defect)", () => {
  /*
    ⚠ THIS IS THE ARM THAT WOULD HAVE CAUGHT IT, and it is the only one that
    crosses from the stylesheets into the markup. The other arms prove that what
    IS declared is right; a rule that says nothing declares nothing, so they
    would all stay green while a new button family shipped with the same hole.

    It asks the one question the shared block failed: is there a class that
    hands out the hand pointer, is worn by something a customer can find
    switched off, and never says what switched off looks like?

    An element is answered if ANY class it wears carries a switched-off rule, or
    resets the cursor at rest — the rail's and the lobby menu's unbuilt stubs
    take the second road, wearing a `--stub` modifier that is quiet by
    construction, and reading the base class alone reports them as defects.
    That is a real reading this arm got wrong before it was corrected against
    the running markup, which is why the exemption is a property of the ELEMENT
    rather than of the class.
  */
  const quietingClasses = new Set<string>();
  for (const rule of ALL_RULES) {
    const cursor = declaration(rule.body, "cursor");
    for (const selector of rule.selectors) {
      if (SWITCHED_OFF.test(selector)) classesIn(selector).forEach((c) => quietingClasses.add(c));
      else if (cursor && cursor !== "pointer") classesIn(selector).forEach((c) => quietingClasses.add(c));
    }
  }

  const handPointerClasses = new Set(
    ALL_RULES.filter((r) => declaration(r.body, "cursor") === "pointer").flatMap((r) =>
      r.selectors.filter((s) => !s.includes(":hover")).flatMap(classesIn),
    ),
  );

  /** Every opening tag in the client that carries a switched-off attribute. */
  const switchedOffTags = (): { file: string; tag: string }[] => {
    const out: { file: string; tag: string }[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stats = statSync(full, { throwIfNoEntry: false });
        if (!stats) continue;
        if (stats.isDirectory()) walk(full);
        else if (/\.tsx$/.test(entry)) {
          const src = readListedSource(full);
          if (!src) continue;
          for (const match of src.matchAll(/<[A-Za-z][^>]*?>/gs)) {
            if (/\bdisabled[=}\s/>]|\baria-disabled/.test(match[0])) {
              out.push({ file: path.relative(ROOT, full), tag: match[0] });
            }
          }
        }
      }
    };
    walk(CLIENT_SRC);
    return out;
  };

  it("reads a real population of switched-off elements", () => {
    expect(handPointerClasses.size).toBeGreaterThan(20);
    expect(switchedOffTags().length).toBeGreaterThan(50);
  });

  it("every hand-pointer class a customer can find switched off says what that looks like", () => {
    const offenders: string[] = [];
    for (const { file, tag } of switchedOffTags()) {
      const worn = classesIn(
        (tag.match(/className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/) ?? [])
          .slice(1)
          .filter(Boolean)
          .join(" ")
          .split(/\s+/)
          .map((c) => `.${c}`)
          .join(" "),
      );
      if (worn.some((c) => quietingClasses.has(c))) continue;
      for (const cls of worn) {
        if (handPointerClasses.has(cls)) offenders.push(`${file}  ${cls}`);
      }
    }
    expect([...new Set(offenders)], "a switched-off control still promises a press").toEqual([]);
  });
});

describe("a switched-off button gets a NORMAL pointer, never the no-entry one (#1237)", () => {
  it("no switched-off rule asks for not-allowed", () => {
    const offenders = ALL_RULES.flatMap((r) => {
      if (!r.selectors.some((s) => SWITCHED_OFF.test(s))) return [];
      if (declaration(r.body, "cursor") !== "not-allowed") return [];
      const exempt = r.selectors.some((s) =>
        classesIn(s).some((c) => c in NOT_A_BUTTON),
      );
      return exempt ? [] : [`${r.file}  ${r.selectors.join(", ")}`];
    });
    expect(offenders, "his word is a NORMAL pointer").toEqual([]);
  });

  it("the one exemption is still there, and still the thing it says it is", () => {
    /* An exemption nobody can see leaving is how a list stops being the list.
       If this reddens, the input was fixed or deleted — take the row out. */
    for (const [cls, reason] of Object.entries(NOT_A_BUTTON)) {
      const rule = ALL_RULES.find(
        (r) =>
          r.selectors.some((s) => SWITCHED_OFF.test(s) && classesIn(s).includes(cls)) &&
          declaration(r.body, "cursor") === "not-allowed",
      );
      expect(rule, `${cls} no longer matches its exemption: ${reason}`).toBeTruthy();
    }
  });
});
