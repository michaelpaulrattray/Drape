import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE STAFF WORLD'S CLOCK IS 24-HOUR — a house rule, not a section rule.
 *
 * The founder's ruling lives in `CrewWorkingNow`'s `clockTime` docblock:
 *
 * > *"the locale default here is `03:48 pm` … every other time in his world is
 * > 24-hour — the runner's close-stamps, the shift rows, his own #295 report
 * > quoting `19:46` and `20:17` — so the one clock he would be comparing
 * > against was the one written differently."*
 *
 * ⚠ **THIS FILE EXISTS BECAUSE THE SAME DEFECT HAS NOW SHIPPED THREE TIMES,
 * AND EACH SWEEP THAT FIXED IT WAS SHAPED LIKE A FOLDER (#900).**
 *
 * - **Instance 1** — `clockTime` itself, fixed with the reasoning written down.
 * - **Instance 2** — #329: the fix had reached one of three formatters on the
 *   crew page, so his own confirming quote rendered `07:17 pm` directly above a
 *   shift strip reading `20:17`. `shortDate` and `readStamp` were the siblings.
 * - **Instance 3** — #900: he read `10:30:33 pm` in the admin bar directly above
 *   content reading `25 Aug, 19:17`. **One screen, one frame, two notations.**
 *   `features/staff/StaffBar.tsx` renders a folder away from the crew page and
 *   both earlier sweeps stopped at that boundary. The page does not.
 *
 * **So the population here is the STAFF WORLD, derived**, and the file sits in
 * `foundation/` beside `token-guard` and `rawErrorToast` — the two other house
 * rules that already reach across feature roots for exactly this reason.
 *
 * ## ⚠ The matcher is WIDER than section 08's, and that is the second half of
 * the defect
 *
 * `section08-guard.test.ts` skips any call with no `hour:` in it. Driven
 * against the real shapes before this file was written:
 *
 * ```
 * stamp.toLocaleTimeString()                      section08 arm flags it: false
 * new Date(serverStartedAt).toLocaleString()      section08 arm flags it: false
 * ```
 *
 * Both render a 12-hour clock. **So even if the crew sweep's population HAD
 * reached the staff bar, its arm would have stayed green** — the bare form was
 * invisible to the matcher as well as out of its reach. Two independent holes,
 * and the card only named one.
 *
 * ## What counts as a clock
 *
 * Three offending shapes, each with a positive control below:
 *
 * 1. any `toLocale…String(…)` carrying `hour:` without `hour12: false`;
 * 2. a **bare `toLocaleTimeString()`** — the method exists only on `Date`, so a
 *    bare call is always a clock and always at the locale default;
 * 3. a **bare `toLocaleString()` on a `new Date(…)`** — date *and* time, locale
 *    default for both.
 *
 * And one shape that must NEVER be flagged, with a negative control: a bare
 * `toLocaleString()` on a NUMBER. `creditsBalance.toLocaleString()` is a
 * thousands separator, not a clock — section 08's floor arm records getting
 * this wrong once already (*"a number is not a clock"*).
 *
 * ⚠ **STATED LIMIT, because an absence arm's silence is the dangerous
 * direction:** shape 3 is recognised by its `new Date(` receiver. A bare
 * `toLocaleString()` on a `Date`-typed *variable* would read as a number and be
 * missed. Every such call in the tree today writes `new Date(` inline, so the
 * rule is complete as of this commit and is not complete by construction. The
 * honest repair if that changes is to ban the bare form on these roots outright.
 *
 * ## What a source read cannot answer
 *
 * Whether the rendered bar and the content beneath it actually agree, in both
 * themes, at his width. That was DRIVEN for #900 and the frames are on the card.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..");

const read = (file: string) => fs.readFileSync(file, "utf8");

/** Strip comments, so a docblock quoting a bad shape cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * ⚠ **THE ROOTS ARE THE STAFF WORLD, AND THE LIST IS DELIBERATELY NARROW.**
 *
 * The ruling's own reasoning is comparative — *"the one clock he would be
 * comparing against"* — so it binds surfaces where a 24-hour neighbour is on
 * screen. That is the staff world. **A customer's boards or wardrobe are NOT in
 * it**: `features/boards/components/VersionHistoryModal.tsx` renders a
 * 12-hour clock today and is deliberately left alone, because changing what a
 * paying customer reads is a design decision (working law 8) and not this
 * card's. It is filed rather than swept in silently.
 */
const ROOTS = ["features/staff", "features/admin", "features/moderator"];

/** Walk a root for every non-test source file. */
const walk = (dir: string, out: { name: string; text: string }[]) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes(".test.")) continue;
    out.push({ name: path.relative(CLIENT_SRC, full).replace(/\\/g, "/"), text: read(full) });
  }
};

/**
 * The staff pages, by prefix rather than by name — `pages/` is a flat directory
 * shared with the whole product, and a tenth admin page added tomorrow must be
 * measured without this file being edited.
 */
const staffPages = (): { name: string; text: string }[] => {
  const dir = path.resolve(CLIENT_SRC, "pages");
  return fs
    .readdirSync(dir)
    .filter((n) => /^(Admin|Moderator)[\w]*\.tsx$/.test(n) && !n.includes(".test."))
    .map((n) => ({ name: `pages/${n}`, text: read(path.join(dir, n)) }));
};

/**
 * ⚠ **AND THE FOUNDATION MODULES THE STAFF WORLD DRAWS FROM — the #898 lesson,
 * carried rather than re-learned.** Promoting a formatter out of a feature is
 * the promotion pass working as designed, and a root-shaped population cannot
 * see it afterwards: `shortDate` left `features/admin/components/crew/` for
 * `foundation/` and the crew guard's absence arm would have gone quietly green
 * with nothing left to examine.
 *
 * Derived from the `@/foundation/…` specifiers the staff world itself imports —
 * **not a path typed in beside the fix** (working law 4). Promote the next
 * formatter and it is measured the moment something staff-facing imports it;
 * delete the import and it correctly leaves again.
 */
const sharedModules = (): { name: string; text: string }[] => {
  const specifiers = new Set<string>();
  for (const file of [...roots(), ...staffPages()]) {
    for (const match of code(file.text).matchAll(/from\s+["']@\/foundation\/([\w./-]+)["']/g)) {
      specifiers.add(match[1].replace(/\.(ts|tsx)$/, ""));
    }
  }
  const found: { name: string; text: string }[] = [];
  for (const specifier of [...specifiers].sort()) {
    for (const extension of [".ts", ".tsx"]) {
      const file = path.resolve(CLIENT_SRC, "foundation", `${specifier}${extension}`);
      if (fs.existsSync(file)) {
        found.push({ name: `foundation/${specifier}${extension}`, text: read(file) });
        break;
      }
    }
  }
  return found;
};

const roots = (): { name: string; text: string }[] => {
  const out: { name: string; text: string }[] = [];
  for (const root of ROOTS) walk(path.resolve(CLIENT_SRC, root), out);
  return out;
};

/** Everything that can render a clock in his world. */
const population = () => [...roots(), ...staffPages(), ...sharedModules()];

/* ================================================================
   THE MATCHER
   ================================================================ */

const CALL = /(new Date\([\s\S]{0,120}?\)|[\w.?![\]]+)\.toLocale(Date|Time)?String\(([\s\S]{0,240}?)\)/g;

type Call = { receiver: string; kind: string; args: string; whole: string };

const calls = (text: string): Call[] => {
  const out: Call[] = [];
  for (const m of code(text).matchAll(CALL)) {
    out.push({ receiver: m[1], kind: m[2] ?? "", args: m[3], whole: m[0] });
  }
  return out;
};

/** Does this call render a time-of-day at all? */
const isClock = (c: Call): boolean => {
  if (c.kind === "Date") return false; // toLocaleDateString never prints a clock
  if (/hour:/.test(c.args)) return true; // explicit hour field
  if (c.args.trim() !== "") return false; // options given, and no hour asked for
  if (c.kind === "Time") return true; // bare toLocaleTimeString() — Date only
  return /^new Date\(/.test(c.receiver); // bare toLocaleString() on a Date
};

/** A clock that is not forced to 24-hour. */
const offends = (c: Call): boolean => isClock(c) && !/hour12:\s*false/.test(c.args);

/* ================================================================
   THE POPULATION IS REAL
   ================================================================ */

describe("the staff clock guard — the population", () => {
  it("reaches every staff root, the staff pages, and the promoted formatter BY NAME", () => {
    /*
      ⚠ **THE NAMES, NOT THE COUNT.** #898's own positive control records why:
      a floor of N is satisfied by any N survivors, so a broken specifier regex
      or a renamed file leaves the real subject unswept with every arm green.
      These six are the ones this card actually touched or depends on.
    */
    const names = population().map((f) => f.name);
    expect(names).toContain("features/staff/StaffBar.tsx");
    expect(names).toContain("features/admin/adminConstants.ts");
    expect(names).toContain("features/admin/overview/SystemStatusCard.tsx");
    expect(names).toContain("features/moderator/moderatorConstants.ts");
    expect(names).toContain("features/moderator/MyRequestsTab.tsx");
    expect(names).toContain("pages/AdminBugReports.tsx");
    /* The nested one, proving the walk recurses rather than reading a top level. */
    expect(names).toContain("features/admin/components/crew/CrewWorkingNow.tsx");
    /* The promoted one, proving the foundation hop resolves (#898). */
    expect(names).toContain("foundation/shortDate.ts");
  });

  it("does not reach the customer's surfaces", () => {
    /*
      NEGATIVE CONTROL. The ruling is about his world; `features/boards` renders
      a 12-hour clock today (`VersionHistoryModal`) and is deliberately out of
      scope. A population that quietly widened to the whole client would go red
      on it and the next hand would "fix" a customer surface to make a test
      pass — which is the reverse of working law 8.
    */
    const names = population().map((f) => f.name);
    expect(names.some((n) => n.startsWith("features/boards"))).toBe(false);
    expect(names.some((n) => n.startsWith("features/casting"))).toBe(false);
    expect(names).not.toContain("foundation/theme.ts");
  });

  it("sweeps only foundation modules the staff world actually imports", () => {
    /* NEGATIVE CONTROL — the resolver must not simply return `foundation/`. */
    const names = sharedModules().map((f) => f.name);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const specifier = name.replace(/^foundation\//, "").replace(/\.(ts|tsx)$/, "");
      const imported = [...roots(), ...staffPages()].some((f) =>
        code(f.text).includes(`@/foundation/${specifier}`),
      );
      expect(imported, `${name} is swept but nothing staff-facing imports it`).toBe(true);
    }
  });
});

/* ================================================================
   THE MATCHER CAN FAIL — controls before verdicts (working law 2)
   ================================================================ */

describe("the staff clock guard — the matcher", () => {
  const only = (src: string) => {
    const found = calls(src);
    expect(found, `expected exactly one call in: ${src}`).toHaveLength(1);
    return found[0];
  };

  /* The shape that shipped as instance 2 — card 329, the crew page's `07:17 pm`. */
  it("POSITIVE CONTROL 1 — an hour field with no hour12", () => {
    expect(offends(only('date.toLocaleString(undefined, { day: "numeric", hour: "2-digit" })'))).toBe(true);
  });

  /*
    The shape that shipped as instance 3 — card 900, the admin bar's
    `10:30:33 pm`. Section 08's arm does not flag it; that is asserted below
    rather than only claimed in the header.

    ⚠ The card numbers live in these comments and NOT in the `it()` titles:
    `token-guard` reads `#900` in a string literal as a hex colour and reddens.
    Its own failure message names this repair, and it cost the previous shift a
    local run to learn.
  */
  it("POSITIVE CONTROL 2 — a bare toLocaleTimeString, which section 08 misses", () => {
    const shipped = "stamp.toLocaleTimeString()";
    expect(offends(only(shipped))).toBe(true);
    /*
      ⚠ THE WHOLE REASON THIS FILE EXISTS, pinned as an assertion rather than
      left in the prose above: section 08's arm skips any call with no `hour:`,
      so this exact string passes it. If that arm is ever widened to catch this
      shape, this expectation goes red and someone reads why.
    */
    const section08WouldFlag = /hour:/.test(shipped) && !/hour12:\s*false/.test(shipped);
    expect(section08WouldFlag).toBe(false);
  });

  it("POSITIVE CONTROL 3 — a bare toLocaleString on a new Date (the SystemStatusCard shape)", () => {
    expect(offends(only("new Date(serverStartedAt).toLocaleString()"))).toBe(true);
  });

  it("NEGATIVE CONTROL — a number is not a clock", () => {
    /* Section 08's floor arm got this wrong once: the reply box's character
       counter uses the same method name. Flagging it would make this guard
       unrunnable and it would be turned off. */
    expect(offends(only("creditsBalance.toLocaleString()"))).toBe(false);
    expect(offends(only("CREW_REPLY_MAX.toLocaleString()"))).toBe(false);
    expect(offends(only('n.toLocaleString("en-US", { minimumFractionDigits: 2 })'))).toBe(false);
  });

  it("NEGATIVE CONTROL — a date with no clock in it is not a clock", () => {
    expect(offends(only("new Date(value).toLocaleDateString()"))).toBe(false);
    expect(offends(only('d.toLocaleString("en-US", { month: "short", day: "numeric" })'))).toBe(false);
  });

  it("NEGATIVE CONTROL — a forced 24-hour clock passes", () => {
    expect(
      offends(only('then.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })')),
    ).toBe(false);
  });
});

/* ================================================================
   THE VERDICT
   ================================================================ */

describe("every clock in his world is 24-hour", () => {
  it("no staff surface takes the locale default for a time", () => {
    const offenders: string[] = [];
    for (const file of population()) {
      for (const call of calls(file.text)) {
        if (offends(call)) offenders.push(`${file.name}: ${call.whole.slice(0, 70)}…`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /*
    ⚠ **THE FLOOR, and the direction it may move is stated so the next lowering
    is a decision rather than a habit.** Without it a sweep that matched nothing
    — a renamed API, a moved formatter, a regex broken by a refactor — reports
    "no offenders" and reads exactly like a clean product. That is the failure
    working law 2 is about, and #898 is the worked example: a promotion moved
    the crew page's principal formatter out of a directory-shaped population and
    the absence arm stayed GREEN with nothing left to examine.

    **The floor is stated as a spread across FILES, not a total**, because a
    total is satisfied by one file with many calls. Seven files carry a clock
    today; six is the floor, so collapsing one duplicate pair — which this
    change explicitly recommends and does not do — is not a red.

    ⚠ **A FALL BELOW IT IS THE ARM DOING ITS JOB. It means either a real
    collapse worth thinking about or the sweep breaking, and those two must not
    be told apart by editing this number.**
  */
  it("the sweep has a real population, spread across files", () => {
    const perFile = population()
      .map((f) => ({ name: f.name, n: calls(f.text).filter(isClock).length }))
      .filter((f) => f.n > 0);
    expect(perFile.length).toBeGreaterThanOrEqual(6);
  });
});
