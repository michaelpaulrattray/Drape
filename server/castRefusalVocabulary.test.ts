/**
 * A REFUSAL CALLS A PERSON A CAST, NEVER A MODEL (#1565).
 *
 * # These are customer copy, not logs — read at the code
 *
 * `client/src/lib/failureSentence.ts`'s `readableFailure` returns the SERVER's
 * `message` **verbatim** whenever the failure is ours, and falls back to the
 * caller's own sentence only when it is not. "Ours" is a tRPC code on its own
 * `OURS` list — `NOT_FOUND` among them. So a refusal written here is a sentence
 * a person reads on their screen, word for word.
 *
 * **Forty of them said "Model not found."** In a product where a person is a
 * *cast* and *model* means an engine, that is the one word this product decided
 * not to use for people (#1545, his rule).
 *
 * # What this guard holds, and how its population is DERIVED
 *
 * The card's own measurement was a grep for `message: "…"`, which found 51. This
 * reader takes the shape one step wider — **any string literal that is the value
 * of a property or variable whose name is `message` or ends in `Message`** — and
 * finds **54**, because three live on `placementMessage`, the field `boardOps`
 * and `operationRecovery` use to explain a cast that was charged for and not
 * placed. Two of those said *"Your cast was saved in Models. Reopen it from the
 * library…"*: the page name in one clause and the rail's real name in the next,
 * contradicting itself inside one sentence.
 *
 * ⚠ **A CLEAN READING HERE IS A FLOOR AND NOT A CENSUS, and the sweep proved it
 * on itself.** `server/casting/effectiveCastState.ts:69` passes its sentence to
 * `super(...)` in an `Error` subclass — no `message` key anywhere — and it
 * carries `NOT_FOUND`, so it reached customers exactly like the other forty. No
 * property-shaped reader can see it. It was found by sweeping the OLD SPELLINGS
 * after the rewrite rather than by this population, and the honest conclusion is
 * that this guard holds a shape, not a promise about every sentence in the tree.
 *
 * # THE EXCEPTIONS ARE DERIVED FROM THE CODE, NOT DECLARED
 *
 * Two sentences still say *model* and both are correct: `"Failed to create the
 * model."` and `"Failed to iterate model"` are thrown as `INTERNAL_SERVER_ERROR`,
 * which is NOT on the client's `OURS` list, so `readableFailure` replaces them
 * with the caller's own copy and no customer ever sees them. The card's own
 * done-when says those are *confirmed at the code and left*.
 *
 * ⚠ **So the exception is not a list of two strings somebody typed.** This suite
 * reads `OURS` **out of the client module's source** and excuses a sentence only
 * where every throw site carrying it has a code outside that set. Change one of
 * those two throws to `NOT_FOUND` and it stops being excused in the same commit,
 * with no list to remember to update. A hand-kept exception list is how a guard
 * comes to bless the thing it was written to catch.
 *
 * # What is NOT this guard
 *
 * Code, table, router and variable names (`models`, `modelsRouter`, `modelId`) —
 * his own rule on #1545. `server/db/models.ts`'s `error: "Model not found"` is a
 * WIRE CONTRACT between two server modules, keyed on its spelling at
 * `server/routes/models.ts:254` and pinned by two arms in the final-cast-deletion
 * suite; it is not a `message` and is out of this population by construction.
 * And `modelDisplayTruth`'s `DRAFT_AUTO_NAME` is a sentinel the client filters
 * out, so renaming it would make those exact words start appearing.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";

import { withoutComments } from "./testing/withoutComments";

/* ⚠ THIS SUITE IS IN BOTH TIMEOUT POPULATIONS AND DECLARES THE CHILD-PROCESS
   ONE, which is the same answer `contendedTestTimeouts.test.ts` gives for
   itself in its own header: it runs `git ls-files` (#548's population) and then
   reads every tracked server module through the sanctioned reader (#741's), and
   EITHER constant lifts a file off vitest's 5 s default, which is the whole
   property both guards are about. Both are 30_000. File level, never per arm. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const REPO = path.resolve(__dirname, "..");

/** The client module that decides whether a server sentence reaches a screen. */
const FAILURE_SENTENCE = path.join(REPO, "client", "src", "lib", "failureSentence.ts");

/** Strip comments, so a docblock quoting a retired sentence is not an offence. */
const code = (text: string) => withoutComments(text);

/** Every tracked, non-test `.ts` under `server/`. */
function serverModules(): string[] {
  return execFileSync("git", ["ls-files", "server"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .filter((file) => /\.ts$/.test(file) && !/\.test\.ts$/.test(file));
}

/**
 * A string literal that is the value of something message-shaped.
 *
 * `message: "…"`, `publicMessage: "…"`, `errorMessage: "…"`, `placementMessage =
 * "…"` — the `[:=]` half is what reaches the third of these that is an
 * assignment rather than a property, which the card's own grep could not see.
 */
const MESSAGE_SHAPED = /\b([A-Za-z]*[Mm]essage)\s*[:=]\s*"((?:[^"\\]|\\.)*)"/g;

type Sentence = { file: string; key: string; text: string };

function messageSentences(): Sentence[] {
  const out: Sentence[] = [];
  for (const file of serverModules()) {
    const source = readListedSource(path.join(REPO, file));
    /* A tracked file that vanished mid-run: skipped, and the floor arm below is
       what stops the skip from quietly becoming the whole sweep (#223). */
    if (source === null) continue;
    for (const match of code(source).matchAll(MESSAGE_SHAPED)) {
      out.push({ file, key: match[1], text: match[2] });
    }
  }
  return out;
}

/** The tRPC codes whose messages our own server authors — read from the client. */
function oursCodes(): string[] {
  const source = readListedSource(FAILURE_SENTENCE);
  if (source === null) throw new Error(`${FAILURE_SENTENCE} could not be read`);
  const block = source.match(/const OURS = new Set\(\[([\s\S]*?)\]\)/);
  if (!block) {
    throw new Error(
      "client/src/lib/failureSentence.ts no longer declares `const OURS = new Set([…])` — this guard's whole exception rule is derived from it and cannot be answered",
    );
  }
  return [...block[1].matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]);
}

/**
 * Does every throw site carrying this sentence use a code OUTSIDE `OURS`?
 *
 * Read on the `new TRPCError({ … })` construct that contains the sentence, both
 * key orders, so the answer comes from the same bytes as the throw rather than
 * from a list of sentences somebody believed were safe.
 */
function unreachableByCustomer(text: string, ours: readonly string[]): boolean {
  const quoted = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const construct = new RegExp(`new TRPCError\\(\\{[^}]*"${quoted}"[^}]*\\}\\)`, "g");
  let found = 0;
  for (const file of serverModules()) {
    const source = readListedSource(path.join(REPO, file));
    if (source === null) continue;
    const stripped = code(source);
    if (!stripped.includes(`"${text}"`)) continue;
    for (const match of stripped.matchAll(construct)) {
      found += 1;
      const codeName = match[0].match(/code:\s*"([A-Z_]+)"/);
      if (!codeName || ours.includes(codeName[1])) return false;
    }
    /* The sentence is in this file but NOT inside a TRPCError construct — a
       placementMessage, a pushed failure row, an Error subclass. Nothing proves
       it unreachable, so it is not excused. */
    if (found === 0) return false;
  }
  return found > 0;
}

/** `model` / `models` as a WORD — `modelId` and `modelsRouter` are names, not copy. */
const SAYS_MODEL = /\bmodels?\b/i;

describe("the studio's refusals speak the customer's vocabulary (#1565)", () => {
  it("sweeps a real population — a clean answer over no sentences is not an answer", () => {
    const sentences = messageSentences();
    /* Measured at 475 message-shaped literals across 520 modules the day this
       landed. The floor sits far below, because this arm exists to catch a
       reader that has stopped reading rather than to pin a number that moves
       every week — and the same for the modules, since `git ls-files` returning
       nothing would empty every arm below. */
    expect(serverModules().length).toBeGreaterThan(300);
    expect(sentences.length).toBeGreaterThan(300);
    /* All four message-shaped keys the tree actually uses, so a reader that
       silently narrowed to `message:` again would be seen. */
    expect(new Set(sentences.map((row) => row.key))).toContain("placementMessage");
  });

  it("reads OURS out of the client, because the exception rule depends on it", () => {
    const ours = oursCodes();
    /* Seven the day this landed. NOT_FOUND is the one that matters — it carried
       forty of the retired sentences to a customer's screen. */
    expect(ours).toContain("NOT_FOUND");
    expect(ours.length).toBeGreaterThanOrEqual(5);
  });

  it("calls a person a cast, in every sentence a customer can reach", () => {
    const ours = oursCodes();
    const offenders = messageSentences()
      .filter((row) => SAYS_MODEL.test(row.text))
      .filter((row) => !unreachableByCustomer(row.text, ours))
      .map((row) => `${row.file} [${row.key}] "${row.text}"`);
    expect(
      offenders,
      "a person is a CAST — 'model' means an engine here (#1545, his rule). If this sentence genuinely cannot reach a customer, it will excuse itself once its throw carries a code outside the client's OURS set; there is no list to add it to",
    ).toEqual([]);
  });

  it("names no page the product does not have", () => {
    /* The two money sentences this card led on said "in your model library" and
       "saved in Models" while the rail has read Library since the foundation
       landed (`client/src/foundation/Rail.tsx`). A sentence that sends somebody
       to a page by a name they cannot see is wrong whatever word it uses for a
       person, which is why it is its own arm. */
    const offenders = messageSentences()
      .filter((row) => /\bmodel library\b|\bsaved in Models\b|\bin Models\b/i.test(row.text))
      .map((row) => `${row.file} [${row.key}] "${row.text}"`);
    expect(offenders, "the rail calls that page Library").toEqual([]);
  });

  it("CAN FAIL — the retired sentences are caught, each by the arm that caught it", () => {
    /*
      THE POSITIVE CONTROL (working law 2). Both arms above assert an EMPTY list,
      and an empty list is what a broken reader returns too — a `git ls-files`
      that found nothing, a regex that stopped matching, a `code()` that ate the
      file. So the two predicates are driven against the real sentences this card
      retired, quoted from the tree at 03d3c1cad.
    */
    expect(SAYS_MODEL.test("Model not found")).toBe(true);
    expect(SAYS_MODEL.test("This model has no headshot to refresh against")).toBe(true);
    expect(SAYS_MODEL.test("This identity is minted and immutable — fork it as a new model instead.")).toBe(true);
    expect(SAYS_MODEL.test("Canvas Cast landing changed its model identity")).toBe(true);

    /* …and does NOT fire on what replaced them, which is the other half: a
       predicate that caught everything would make the sweep unpassable and push
       the next author into working around it. */
    expect(SAYS_MODEL.test("Cast not found")).toBe(false);
    expect(SAYS_MODEL.test("This cast has no headshot to refresh against")).toBe(false);
    expect(SAYS_MODEL.test("Created and charged — placing it on the board failed. Find the draft in your Library; it was not charged twice.")).toBe(false);

    /* A NAME is not copy — his own rule on #1545, and the reader must agree. */
    expect(SAYS_MODEL.test("modelId is required")).toBe(false);
    expect(SAYS_MODEL.test("modelsRouter")).toBe(false);
  });

  it("CAN FAIL — the page arm catches the two money sentences it was written for", () => {
    const page = /\bmodel library\b|\bsaved in Models\b|\bin Models\b/i;
    expect(page.test("Created and charged — placing it on the board failed. Find the draft in your model library; it was not charged twice.")).toBe(true);
    expect(page.test("Your cast was saved in Models. Reopen it from the library to place it on the Canvas.")).toBe(true);
    expect(page.test("Created and charged — placing it on the board failed. Find the draft in your Library; it was not charged twice.")).toBe(false);
  });

  it("excuses a sentence only on the evidence, never on its wording", () => {
    const ours = oursCodes();
    /*
      THE CONTROL ON THE EXCEPTION ITSELF, which is the arm most worth having:
      an exception rule that excused too much would turn every arm above green
      while the defect shipped.

      The two live exceptions are real and are named in this suite's header.
      Beside them, the predicate must REFUSE to excuse a sentence carried by a
      code that IS on the client's list — driven on the real tree, where
      "Cast not found" is thrown forty times as NOT_FOUND.
    */
    expect(unreachableByCustomer("Failed to iterate model", ours)).toBe(true);
    expect(unreachableByCustomer("Failed to create the model.", ours)).toBe(true);
    expect(unreachableByCustomer("Cast not found", ours)).toBe(false);
    /* A sentence the tree does not hold excuses nothing — the shape that would
       let an unreachable reader bless everything it cannot find. */
    expect(unreachableByCustomer("a sentence no module contains", ours)).toBe(false);
  });
});
