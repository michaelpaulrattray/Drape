import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "./testing/listedSource";
import {
  CHANGE_REQUEST_TYPES,
  CHANGE_REQUEST_TYPE_LABELS,
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
 * `server/lib/adminActions/index.ts` legitimately maps SIX of these keys onto
 * approval action ids (`refund_credits: "cr_refundCredits"`). That is a
 * different fact about the same type and it must stay. The discriminator is
 * that a label starts with a capital and an identifier does not — so that file
 * is checked explicitly as a NEGATIVE control rather than trusted to be
 * excluded by luck.
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

/** How many of the shared keys this text pairs with a human-looking label. */
function labelPairsIn(text: string): string[] {
  const hit: string[] = [];
  for (const key of CHANGE_REQUEST_TYPES) {
    /* `key: "Uppercase..."` — an object literal mapping the type to a label.
       The key may be quoted (`"refund_credits": "Refund credits"`), which is
       what a map pasted out of JSON or written under a quote-props lint rule
       looks like; no copy in the tree is written that way today, and a matcher
       that can only see the spelling that happened to occur is one paste away
       from silence. */
    const asProperty = new RegExp(`(?:\\b|["'])${key}["']?\\s*:\\s*["'\`][A-Z]`);
    // `value="key">Uppercase` — the same pairing written as JSX.
    const asJsx = new RegExp(`value=["']${key}["']\\s*>\\s*[A-Z]`);
    if (asProperty.test(text) || asJsx.test(text)) hit.push(key);
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
      const pairs = labelPairsIn(code(source));
      if (pairs.length >= 2) offenders.push(`${rel} (${pairs.join(", ")})`);
    }
    /* …and the skip above cannot become the whole sweep silently. */
    expect(read).toBeGreaterThan(500);
    expect(offenders).toEqual([]);
  });

  it("POSITIVE CONTROL: the matcher sees each of the two shapes it must catch", () => {
    // The object-literal shape — what both server routes held.
    expect(
      labelPairsIn(`const typeLabels = { refund_credits: "Refund Credits", block_ip: "Block IP" };`),
    ).toEqual(["refund_credits", "block_ip"]);

    // The JSX shape — what the moderator's create form held.
    expect(
      labelPairsIn(
        `<SelectItem value="suspend_user">Suspend user</SelectItem>\n<SelectItem value="other">Other</SelectItem>`,
      ),
    ).toEqual(["suspend_user", "other"]);

    // And it reads the REAL declaration as a map, which is the arm that would
    // go quiet if the shared file were renamed or emptied.
    const truth = fs.readFileSync(path.join(REPO, SOURCE_OF_TRUTH), "utf8");
    expect(labelPairsIn(code(truth)).length).toBe(CHANGE_REQUEST_TYPES.length);
  });

  it("NEGATIVE CONTROL: the action map keyed on six of these types is not a label map", () => {
    const actions = fs.readFileSync(
      path.join(REPO, "server", "lib", "adminActions", "index.ts"),
      "utf8",
    );
    // It pairs the same keys, with identifiers rather than labels.
    expect(actions).toContain("refund_credits");
    expect(labelPairsIn(code(actions))).toEqual([]);

    // And a single shared word is not a map either.
    expect(labelPairsIn(`const v = { other: "Other" };`)).toEqual(["other"]);
  });

  it("POSITIVE CONTROL: a copy written with QUOTED keys is caught too", () => {
    expect(
      labelPairsIn(`{ "refund_credits": "Refund credits", "block_ip": "Block IP" }`),
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
