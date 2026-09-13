import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "./testing/listedSource";
import {
  CHANGE_REQUEST_STATUSES,
  CHANGE_REQUEST_STATUS_LABELS,
  CHANGE_REQUEST_TYPES,
  CHANGE_REQUEST_TYPE_LABELS,
  changeRequestStatusLabel,
  changeRequestTypeLabel,
} from "@shared/changeRequestLabels";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/* Its arms do real work in process — a tree sweep, a sheet compile, a sharp
   encode — and under the parallel run that cost multiplies by fifteen or twenty
   against vitest's 5,000 ms default. The measurement, and the two roads that
   were rejected, are in `contendedTestTimeout.ts` (#741). File level, never
   per arm: a number typed onto one `it(…)` is not inherited by its neighbour. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

/**
 * ONE declaration of what a change-request type is called (#679).
 *
 * # What went wrong, so this guard is aimed at the defect and not at a style
 *
 * The type-to-label map was typed out by hand SEVEN times: `TYPE_CONFIG` and
 * `TYPE_LABELS` and nine `<SelectItem>` labels on the client, two
 * character-identical `typeLabels` on the server, and a copy inside
 * `changeRequests.test.ts` that asserted against itself.
 *
 * Nobody was careless. `stripe_refund` was added to the product, six places
 * were updated, and the seventh — the moderator's own *My requests* tab — was
 * not. That lookup falls back to the raw key, so a moderator who filed a Stripe
 * refund saw the literal text `stripe_refund` in their own list. The drift was
 * silent until somebody looked.
 *
 * # What is asserted, and why it is DERIVED
 *
 * A hand-written list of "files allowed to name these types" would share the
 * blind spot of whoever typed it — which is the same failure one size up. So
 * the population is *every TS/TSX file in the product*, and the signal is
 * derived from the shared map's own KEYS: a file that pairs two or more of
 * those keys with a human-looking label is declaring this map, wherever it
 * lives and whatever it calls the variable.
 *
 * ## Why "human-looking" is a quote followed by an uppercase letter
 *
 * `CHANGE_REQUEST_ACTION_BY_TYPE` (in the shared file itself since #800)
 * legitimately maps SIX of these keys onto executor action ids
 * (`refund_credits: "cr_refundCredits"`). That is a different fact about the
 * same type and it must stay. The discriminator is that a label starts with a
 * capital and an identifier does not — so that map is checked explicitly as a
 * NEGATIVE control rather than trusted to be excluded by luck.
 *
 * ## Why two keys and not one
 *
 * `shared/bugReportVocabulary.ts` contains `other: "Other"`, which is a
 * different vocabulary that happens to share one word. One key is a
 * coincidence; two is a map.
 */

const REPO = path.resolve(__dirname, "..");
const ROOTS = ["client/src", "server", "shared", "scripts"];
const SOURCE_OF_TRUTH = "shared/changeRequestLabels.ts";

const slash = (p: string) => p.split(path.sep).join("/");

/** Every .ts/.tsx file under the scanned roots, descending into directories. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  for (const root of ROOTS) {
    const abs = path.join(REPO, root);
    if (fs.existsSync(abs)) walk(abs);
  }
  return out;
}

/** Strip comments, so a docblock explaining the rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * How many of a given key set this text pairs with a human-looking label.
 *
 * ⚠ **IT TAKES THE KEY SET AS AN ARGUMENT SINCE #907**, because there are two
 * vocabularies to keep singular now — the types and the statuses — and the two
 * sets are disjoint, which an arm below pins. One MATCHER, two POPULATIONS: a
 * second copy of this function keyed on statuses would be working law 4 inside
 * the guard that exists to enforce working law 4.
 */
function labelPairsIn(text: string, keys: readonly string[]): string[] {
  const hit: string[] = [];
  for (const key of keys) {
    /* `key: "Uppercase..."` — an object literal mapping the key to a label.
       The key may be quoted (`"refund_credits": "Refund credits"`), which is
       what a map pasted out of JSON or written under a quote-props lint rule
       looks like; no copy in the tree is written that way today, and a matcher
       that can only see the spelling that happened to occur is one paste away
       from silence. */
    const asProperty = new RegExp(`(?:\\b|["'])${key}["']?\\s*:\\s*["'\`][A-Z]`);
    /* ⚠ **`key: { label: "Uppercase..." }` — THE SHAPE THIS GUARD WAS BLIND TO
       UNTIL #907, AND IT IS THE SHAPE THE DUPLICATE WAS ACTUALLY WRITTEN IN.**
       `STATUS_CONFIG` pairs each status with a label *inside a presentation
       object*, next to a className and an icon. Measured by driving the
       pre-change tree through both matchers: the shape above finds **nothing**
       in it, this one finds `ChangeRequestConstants.tsx` with all six keys. A
       guard shaped around the one copy that happened to exist in 2026-09 is an
       instrument that cannot fail on the next one. */
    const asConfig = new RegExp(
      `(?:\\b|["'])${key}["']?\\s*:\\s*\\{[^}]*\\blabel\\s*:\\s*["'\`][A-Z]`,
    );
    // `value="key">Uppercase` — the same pairing written as JSX.
    const asJsx = new RegExp(`value=["']${key}["']\\s*>\\s*[A-Z]`);
    if (asProperty.test(text) || asConfig.test(text) || asJsx.test(text)) hit.push(key);
  }
  return hit;
}

describe("the change-request type labels are declared once (#679)", () => {
  const files = sourceFiles();

  it("scans a population big enough to be a real sweep", () => {
    // A population control: a walk that silently stopped descending would
    // report zero offenders and look exactly like a clean tree.
    expect(files.length).toBeGreaterThan(500);
    expect(files.some((f) => slash(f).endsWith(SOURCE_OF_TRUTH))).toBe(true);
  });

  it("finds the pairing in NO file but the shared declaration", () => {
    const offenders: string[] = [];
    let read = 0;
    for (const file of files) {
      const rel = slash(path.relative(REPO, file));
      if (rel === SOURCE_OF_TRUTH) continue;
      if (rel === "server/changeRequestLabels.test.ts") continue; // this file
      /* A listed entry can be gone by the time it is read — `scripts/` carries
         hundreds of disposables that come and go while the suites run (#223).
         Absence is skipped; anything else still throws. */
      const source = readListedSource(file);
      if (source === null) continue;
      read += 1;
      const pairs = labelPairsIn(code(source), CHANGE_REQUEST_TYPES);
      if (pairs.length >= 2) offenders.push(`${rel} (${pairs.join(", ")})`);
    }
    /* …and the skip above cannot become the whole sweep silently. */
    expect(read).toBeGreaterThan(500);
    expect(offenders).toEqual([]);
  });

  it("POSITIVE CONTROL: the matcher sees each of the three shapes it must catch", () => {
    // The object-literal shape — what both server routes held.
    expect(
      labelPairsIn(
        `const typeLabels = { refund_credits: "Refund Credits", block_ip: "Block IP" };`,
        CHANGE_REQUEST_TYPES,
      ),
    ).toEqual(["refund_credits", "block_ip"]);

    // The JSX shape — what the moderator's create form held.
    expect(
      labelPairsIn(
        `<SelectItem value="suspend_user">Suspend user</SelectItem>\n<SelectItem value="other">Other</SelectItem>`,
        CHANGE_REQUEST_TYPES,
      ),
    ).toEqual(["suspend_user", "other"]);

    /* ⚠ **The CONFIG shape — the one #907 found this matcher blind to.** A
       label living inside a presentation object beside a className and an icon
       is still a declaration of the words, and until #907 it read as clean. */
    expect(
      labelPairsIn(
        `const c = { refund_credits: { label: "Refund credits", icon: A }, block_ip: { label: "Block IP", icon: B } };`,
        CHANGE_REQUEST_TYPES,
      ),
    ).toEqual(["refund_credits", "block_ip"]);

    // And it reads the REAL declaration as a map, which is the arm that would
    // go quiet if the shared file were renamed or emptied.
    const truth = fs.readFileSync(path.join(REPO, SOURCE_OF_TRUTH), "utf8");
    expect(labelPairsIn(code(truth), CHANGE_REQUEST_TYPES).length).toBe(CHANGE_REQUEST_TYPES.length);
  });

  it("NEGATIVE CONTROL: the action map keyed on six of these types is not a label map", () => {
    // Since #800 the action map lives in the shared file itself; the control
    // isolates it and proves the matcher does not count identifier pairs.
    const truth = fs.readFileSync(path.join(REPO, SOURCE_OF_TRUTH), "utf8");
    const mapStart = truth.indexOf("export const CHANGE_REQUEST_ACTION_BY_TYPE");
    expect(mapStart).toBeGreaterThan(-1);
    const actions = truth.slice(mapStart, truth.indexOf("} as const", mapStart));
    // It pairs the same keys, with identifiers rather than labels.
    expect(actions).toContain("refund_credits");
    expect(labelPairsIn(code(actions), CHANGE_REQUEST_TYPES)).toEqual([]);

    // And a single shared word is not a map either.
    expect(labelPairsIn(`const v = { other: "Other" };`, CHANGE_REQUEST_TYPES)).toEqual(["other"]);
  });

  it("POSITIVE CONTROL: a copy written with QUOTED keys is caught too", () => {
    expect(
      labelPairsIn(
        `{ "refund_credits": "Refund credits", "block_ip": "Block IP" }`,
        CHANGE_REQUEST_TYPES,
      ),
    ).toEqual(["refund_credits", "block_ip"]);
  });

  /**
   * THE ADMIN FILTER'S LIST IS THE EIGHTH COPY OF THE KEYS, AND NOTHING ELSE
   * HERE WATCHES IT (PR #680 review, finding 1).
   *
   * `ALL_TYPES` orders the types money-first, which is a real design choice, so
   * it is not simply `CHANGE_REQUEST_TYPES` — it is a second LIST of the same
   * SET. Typing it `ChangeRequestType[]` stops a name that is not a type; this
   * arm stops a type that is not in the list.
   *
   * Without the pair: a tenth type is added to the shared map, the wire enum
   * and the icon table — all three forced by the compiler — every guard above
   * stays green, and the admin filter silently never offers it. That is the
   * one-list-not-visited class this whole change is about, one shape over.
   */
  it("the admin filter offers exactly the types that exist, in its own order", async () => {
    const { ALL_TYPES } = await import("../client/src/features/admin/ChangeRequestConstants");
    expect([...ALL_TYPES].sort()).toEqual([...CHANGE_REQUEST_TYPES].sort());
    /* …and the order really is its own, so this arm is not quietly asserting
       the two lists are identical. */
    expect(ALL_TYPES).not.toEqual([...CHANGE_REQUEST_TYPES]);
  });

  /**
   * THE ARM THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT.
   *
   * The map above and the wire contract are two independent readers of the
   * same fact: the map says what a type is called, and the moderator's create
   * procedure says which types exist at all. `stripe_refund` was added to the
   * second and missed by one copy of the first, which is the whole incident.
   *
   * The types are read off the router's own zod schema rather than re-typed
   * here, so this arm cannot drift the way the thing it guards did — and it
   * carries the same population control the neighbouring suite uses: a reader
   * that reads nothing agrees with everything.
   */
  /* Importing the router pulls a large graph — ~2 s alone, and it reddened once
     on the 5 s default under a loaded full-suite run. #216's class; the arm is
     about the contract, never about the clock. */
  it("labels exactly the types the create procedure accepts, no more and no fewer", { timeout: 60_000 }, async () => {
    const { moderatorRouter } = await import("./routes/moderator");
    const procedures = (moderatorRouter as unknown as {
      _def: { procedures: Record<string, { _def: { inputs: unknown[] } }> };
    })._def.procedures;
    const schema = procedures.createChangeRequest!._def.inputs[0] as {
      shape: { type: { options: string[] } };
    };
    const accepted = schema.shape.type.options;
    if (!accepted?.length) throw new Error("read no change-request types off the router");

    expect([...accepted].sort()).toEqual([...CHANGE_REQUEST_TYPES].sort());
  });

  it("every type has a label, and the fallback returns the key", () => {
    for (const type of CHANGE_REQUEST_TYPES) {
      expect(CHANGE_REQUEST_TYPE_LABELS[type]).toMatch(/^[A-Z]/);
      expect(changeRequestTypeLabel(type)).toBe(CHANGE_REQUEST_TYPE_LABELS[type]);
    }
    expect(changeRequestTypeLabel("not_a_type")).toBe("not_a_type");
  });
});

/**
 * THE SAME RULE OVER THE SECOND VOCABULARY — the change-request STATUSES (#907).
 *
 * # What a moderator was reading
 *
 * The admin panel has said `Outcome unconfirmed` for `pending_execution` since
 * #800. The moderator's *My requests* tab passed `request.status` straight into
 * its pill, so the same request read **`PENDING_EXECUTI`** — the raw enum, in
 * machine case, hard-clipped mid-word by a fixed-width column. One fact, two
 * surfaces, and only one of them had the words.
 *
 * # Why this is a second POPULATION and not a second RULE
 *
 * #903's lesson was that a guard sometimes needs a second rule rather than a
 * wider one — because a date and a clock are genuinely different things and
 * merging their predicates makes one word mean two. **This is the opposite
 * case**: "a file that declares these words is a second declaration" is the
 * SAME rule, and the only thing that changes is which key set it is asked
 * about. So `labelPairsIn` takes the keys as an argument and there is exactly
 * one matcher. The two key sets are disjoint, which an arm below pins, so
 * neither population can silently start answering for the other.
 */
describe("the change-request status labels are declared once (#907)", () => {
  const files = sourceFiles();

  it("the two vocabularies share no key, so one matcher over two key sets is safe", () => {
    const overlap = CHANGE_REQUEST_STATUSES.filter((s) =>
      (CHANGE_REQUEST_TYPES as readonly string[]).includes(s),
    );
    expect(overlap).toEqual([]);
    // …and both sets are non-empty, so the emptiness above means disjoint and
    // not "one of the lists failed to load".
    expect(CHANGE_REQUEST_STATUSES.length).toBeGreaterThan(0);
    expect(CHANGE_REQUEST_TYPES.length).toBeGreaterThan(0);
  });

  it("finds the pairing in NO file but the shared declaration", () => {
    const offenders: string[] = [];
    let read = 0;
    for (const file of files) {
      const rel = slash(path.relative(REPO, file));
      if (rel === SOURCE_OF_TRUTH) continue;
      if (rel === "server/changeRequestLabels.test.ts") continue; // this file
      const source = readListedSource(file);
      if (source === null) continue;
      read += 1;
      const pairs = labelPairsIn(code(source), CHANGE_REQUEST_STATUSES);
      if (pairs.length >= 2) offenders.push(`${rel} (${pairs.join(", ")})`);
    }
    expect(read).toBeGreaterThan(500);
    expect(offenders).toEqual([]);
  });

  /**
   * ⚠ **THE ARM THAT PROVES THIS SWEEP IS NOT DECORATIVE.**
   *
   * The status keys are ordinary English words — `pending`, `approved`,
   * `denied`. A sweep over 1,844 files that returns an empty offender list
   * could mean "one declaration" or it could mean "the matcher is dead", and on
   * the day this was written the second was TRUE of the shape that mattered:
   * driven against the pre-change tree, the #679 matcher (key -> string alone)
   * found **nothing**, because `STATUS_CONFIG` wrote its labels inside
   * presentation objects. This arm re-runs the real duplicate through the real
   * matcher so the sweep above cannot go quiet without going red.
   */
  it("POSITIVE CONTROL: the duplicate that #907 removed is caught by this matcher", () => {
    const theDuplicate = `
      export const STATUS_CONFIG = {
        pending: { label: "Pending", className: "bg-amber-50", icon: Clock },
        approved: { label: "Approved", className: "bg-emerald-50", icon: CheckCircle },
        pending_execution: { label: "Outcome unconfirmed", className: "bg-purple-50", icon: Timer },
      };`;
    expect(labelPairsIn(theDuplicate, CHANGE_REQUEST_STATUSES)).toEqual([
      "pending",
      "approved",
      "pending_execution",
    ]);

    // And it reads the REAL declaration as a map — the arm that goes red if the
    // shared map is renamed or emptied.
    const truth = fs.readFileSync(path.join(REPO, SOURCE_OF_TRUTH), "utf8");
    expect(labelPairsIn(code(truth), CHANGE_REQUEST_STATUSES).length).toBe(
      CHANGE_REQUEST_STATUSES.length,
    );
  });

  it("NEGATIVE CONTROL: a single shared word, and a presentation-only map, are not declarations", () => {
    // One key is a coincidence, two is a map (the #679 threshold).
    expect(labelPairsIn(`const v = { pending: "Pending" };`, CHANGE_REQUEST_STATUSES)).toEqual([
      "pending",
    ]);
    /* A map that pairs the statuses with COLOURS and ICONS and no words is
       exactly what `STATUS_PRESENTATION` is now, and it must stay legal — or
       this guard bans the very shape the fix introduced. */
    expect(
      labelPairsIn(
        `const p = { pending: { className: "bg-amber-50", icon: Clock }, denied: { className: "bg-red-50", icon: XCircle } };`,
        CHANGE_REQUEST_STATUSES,
      ),
    ).toEqual([]);
  });

  /**
   * THE WIRE — the statuses a request can actually be IN.
   *
   * The map above says what a status is called; the `change_requests` table's
   * own enum says which statuses exist. They are two independent readers of one
   * fact, and the enum is read off the column rather than re-typed here, so
   * this arm cannot drift the way the thing it guards did. A seventh status
   * added to the column with no word here reddens in the file that owns words.
   */
  it("labels exactly the statuses the column accepts, no more and no fewer", async () => {
    const { changeRequests } = await import("../drizzle/schema");
    const accepted = (changeRequests.status as unknown as { enumValues: string[] }).enumValues;
    if (!accepted?.length) throw new Error("read no statuses off the change_requests column");

    expect([...accepted].sort()).toEqual([...CHANGE_REQUEST_STATUSES].sort());
  });

  /**
   * THE ADMIN FILTER'S OWN LIST, which is a second list of the same set plus an
   * `all` sentinel — `ALL_TYPES`'s exposure one vocabulary over (PR #680's
   * finding 1, and it applied here too until #907 typed and guarded it).
   */
  it("the admin status filter offers exactly the statuses that exist, plus its sentinel", async () => {
    const { ALL_STATUSES } = await import("../client/src/features/admin/ChangeRequestConstants");
    expect([...ALL_STATUSES].sort()).toEqual([...CHANGE_REQUEST_STATUSES, "all"].sort());
    /* …and the order really is its own, so this arm is not quietly asserting
       the two lists are identical. */
    expect(ALL_STATUSES).not.toEqual([...CHANGE_REQUEST_STATUSES, "all"]);
  });

  /**
   * THE ARM THAT WOULD HAVE CAUGHT THE DEFECT ITSELF.
   *
   * Everything above stops the words being written TWICE. The bug was the
   * opposite — a surface that never read them at all — so this drives the two
   * surfaces' label sources over every status and asserts they agree. Before
   * the fix, `changeRequestStatusLabel` did not exist and the moderator's pill
   * rendered the key, so `pending_execution` differed here by construction.
   */
  it("the admin panel and the moderator's list name every status identically", async () => {
    const { STATUS_CONFIG } = await import("../client/src/features/admin/ChangeRequestConstants");
    for (const status of CHANGE_REQUEST_STATUSES) {
      expect(STATUS_CONFIG[status]?.label).toBe(changeRequestStatusLabel(status));
    }
    // The one that was broken, named out loud so a rename cannot quietly pass.
    expect(changeRequestStatusLabel("pending_execution")).toBe("Outcome unconfirmed");
    expect(changeRequestStatusLabel("pending_execution")).not.toBe("pending_execution");
  });

  /**
   * ⚠ **AND THE ARM THAT SEES THE CALL SITE, WHICH IS WHERE THE DEFECT WAS.**
   *
   * Everything above keeps the WORDS singular. None of it can see a surface
   * that never asks for them — and that was the bug: `MyRequestsTab` put
   * `request.status` into a pill and no map was involved, so every
   * declaration-level arm stayed green while a moderator read `PENDING_EXECUTI`.
   *
   * The population is DERIVED rather than named: every `label={…}` in the
   * client whose body mentions a change request's `.status`. Today that is
   * exactly two props in two files, and both must route through the
   * vocabulary. A third surface rendering the raw enum reddens here on the day
   * it is written, and a revert of either existing one reddens too.
   *
   * ⚠ **Its limit, stated rather than implied:** it reads the SHAPE
   * `request.status`, so a component that renames the row (`row.status`,
   * `cr.status`) is outside it. That is the price of a source-shape arm and it
   * is why the declaration arms above exist beside it — this one catches the
   * defect that happened, they catch the drift that keeps happening.
   */
  it("no client surface puts a change request's raw status into a label", () => {
    const offenders: string[] = [];
    let props = 0;
    for (const file of files) {
      const rel = slash(path.relative(REPO, file));
      if (!rel.startsWith("client/src/")) continue;
      const source = readListedSource(file);
      if (source === null) continue;
      for (const match of code(source).matchAll(/label=\{([^}]*\brequest\.status\b[^}]*)\}/g)) {
        props += 1;
        const body = match[1]!;
        const routed =
          body.includes("changeRequestStatusLabel") || body.includes("STATUS_CONFIG");
        if (!routed) offenders.push(`${rel}: label={${body.trim()}}`);
      }
    }
    /* A population control: a matcher that has stopped matching reports no
       offenders and looks exactly like a clean tree. Two props today. */
    expect(props).toBeGreaterThanOrEqual(2);
    expect(offenders).toEqual([]);
  });

  it("every status has a label, and the fallback returns the key", () => {
    for (const status of CHANGE_REQUEST_STATUSES) {
      expect(CHANGE_REQUEST_STATUS_LABELS[status]).toMatch(/^[A-Z]/);
      expect(changeRequestStatusLabel(status)).toBe(CHANGE_REQUEST_STATUS_LABELS[status]);
      /* No status may reach a person as a machine word — no underscore, no
         SCREAMING_CASE. This is the defect stated as a property. */
      expect(CHANGE_REQUEST_STATUS_LABELS[status]).not.toMatch(/_/);
    }
    expect(changeRequestStatusLabel("not_a_status")).toBe("not_a_status");
  });
});
