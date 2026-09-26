import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import {
  type KeyExpression,
  carriesRandomness,
  keyExpressionsIn,
  usesMathRandom,
  withoutComments,
} from "./testing/storageKeyExpressions";

/**
 * EVERY STORAGE KEY IS MINTED FROM CRYPTOGRAPHIC RANDOMNESS (#1401).
 *
 * # WHY IT MATTERS, IN THE WORDS OF THE CODE IT GUARDS
 *
 * A cast's views sit at permanently public R2 URLs — `server/storage.ts`'s own
 * header says *not presigned*, because the URLs are persisted in database rows
 * and must never expire. So **a guessable key is the only thing between a
 * customer's face and anyone who guesses it**, and *a customer's cast is their
 * work* is a founder ruling.
 *
 * # ⚠ WHAT WAS WRONG WITH THIS GUARD UNTIL NOW: ITS POPULATION WAS ONE CALL
 * SYNTAX
 *
 * It read `/\bawait\s+storagePut\(/` over each file, and **the assertions only
 * ever run over the population**. Measured 2026-09-26: it saw **8 of the 15
 * files that call `storagePut`**, and the file it had just started seeing —
 * `castingV2/packageOrchestrator.ts`, which mints a cast's signed views — entered
 * its sight as a SIDE EFFECT of #1389 turning a `return` into an `await`.
 * Nothing about the write had moved.
 *
 * ⚠ **AND A POPULATION BUILT FROM `storagePut` AT ALL WOULD STILL HAVE BEEN
 * WRONG, WHICH IS THE FINDING BEYOND THE CARD.** The card proposed the 15
 * callers as the floor. Driven at the tree, **9 of the 23 files that MINT a key
 * never call `storagePut`** — `inkUploadDoor`, `referenceAttachDoor`,
 * `signService`, `thumbnails`, `diagnosticCapture`, `refusalLoopCapture` and the
 * three evidence modules are key BUILDERS whose callers do the writing. A
 * `storagePut`-shaped population cannot see any of them.
 *
 * # THE RULE, AND HOW THE GENERATOR-VERSUS-PASSER QUESTION IS DISSOLVED
 *
 * `testing/storageKeyExpressions.ts` owns it and states its own measurements.
 * The unit of judgement is the **key expression**, not the file — so a file that
 * takes a key somebody else made contributes nothing and needs no rule to
 * exclude it. It is visible in the answer: `inkReferenceMint.ts` and
 * `referenceAttachService.ts` both call `storagePut` and both drop out, because
 * each calls a key builder this population holds. The key is judged where it is
 * made, exactly once.
 *
 * # ⚠ THE SHAPE: A DERIVED POPULATION, A NAMED FLOOR, AND AN EXCEPTION LIST READ
 * BOTH WAYS
 *
 * The shape this repository already uses three times — the public-endpoint
 * allowlist, `db/storageCleanupHold.test.ts`'s `DELETION_ORDERS`, and
 * `ownerScopedModules.test.ts`'s tag. A stale entry reddens as loudly as a new
 * offender, which is what stops the list becoming a mirror of the tree (working
 * law 4).
 *
 * The floor is a NAMED SET rather than a count, and that is deliberate: a count
 * tolerates a reader that found 22 of 23, and the failure being guarded is a
 * reader that went blind. Naming the files means a reader that stops seeing
 * `packageOrchestrator.ts` reddens **by name**, while a new writer joining
 * reddens nothing.
 */

/* This suite walks the source tree, so it declares the contended timeout rather
   than racing vitest's 5 s default under a parallel run (#216 / #741). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const SERVER_ROOT = path.join(__dirname);

/**
 * Every runtime TypeScript file under `server/`, read through
 * `readListedSource` — this tree carries hundreds of untracked disposables and
 * one can leave between the listing and the read (#223).
 */
function runtimeSources(): Array<{ relative: string; source: string }> {
  const out: Array<{ relative: string; source: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (fs.statSync(full, { throwIfNoEntry: false })?.isDirectory()) walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      if (/\.(test|spec|d)\.ts$/.test(entry.name)) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      out.push({ relative: path.relative(SERVER_ROOT, full).replaceAll("\\", "/"), source });
    }
  };
  walk(SERVER_ROOT);
  return out;
}

/**
 * THE FLOOR: files that mint a storage key today and must never silently leave
 * the population.
 *
 * Measured 2026-09-26 by driving the reader over the tree. **Fourteen of these
 * were invisible to this guard before #1401**, and the eight it did see are here
 * too — including `packageOrchestrator.ts`, which is the specimen.
 */
const KEY_MINTING_FILES_FLOOR: readonly string[] = [
  "casting/aiService.ts",
  "casting/evidence/evidenceDelivery.ts",
  "casting/evidence/evidenceFork.ts",
  "casting/evidence/inkCandidatePublicStorage.ts",
  "castingV2/diagnosticCapture.ts",
  "castingV2/hairReferenceCutter.ts",
  "castingV2/inkDeliveryMint.ts",
  "castingV2/inkUploadDoor.ts",
  "castingV2/keptFaceScan.ts",
  "castingV2/packageOrchestrator.ts",
  "castingV2/referenceAttachDoor.ts",
  "castingV2/referenceMint.ts",
  "castingV2/refineService.ts",
  "castingV2/refusalLoopCapture.ts",
  "castingV2/rollService.ts",
  "castingV2/signService.ts",
  "castingV2/thumbnails.ts",
  "routes/crewEyeFrames.ts",
  "routes/moderatorAttachments.ts",
  "routes/profile.ts",
  "routes/wardrobe.ts",
  "wardrobe/outfitDecomposition.ts",
  "wardrobe/utils.ts",
];

/**
 * THE REMAINDER: key expressions carrying no randomness of their own, each with
 * the reason READ AT ITS OWN BYTES rather than assumed.
 *
 * ⚠ **Keyed on the expression's own TEXT, not a line number.** A line moves
 * whenever anything above it does, and a stale line number is a guard reddening
 * for the wrong reason. Rewriting a listed key reddens too, and that is correct:
 * the entry is about a key somebody read, so a rewrite is asking to be read
 * again.
 *
 * ⚠ **NONE OF THESE IS A WAIVER — every one is a key whose randomness comes from
 * somewhere this text reader cannot follow, and the somewhere is named.** A key
 * that genuinely had no randomness would be a defect, not a row.
 */
const KEYS_WITHOUT_RANDOMNESS_IN_THE_TEXT: ReadonlyArray<{
  file: string;
  text: string;
  because: string;
}> = [
  {
    file: "casting/evidence/evidenceDelivery.ts",
    text: "`users/${input.userId}/models/${input.modelId}/evidence/${segment}/${input.entityId}.webp`",
    because:
      "`entityId` is constrained to a UUID by `EVIDENCE_KEY_PATTERN` in this same file, and these"
      + " bytes go to the PRIVATE evidence bucket through `putCanonical` (its error codes are all"
      + " `private_storage_*`), not to the public one this guard's reason is about.",
  },
  {
    file: "casting/evidence/evidenceFork.ts",
    text: "`users/${input.userId}/models/${input.modelId}/${PUBLIC_FORK_PREFIX}/${input.operationId}/${input.objectId}.webp`",
    because:
      "`objectId` comes from `dependencies.generateId ?? randomUUID` (read at the default, this file),"
      + " and `operationId` is a generation-operation id. The randomness is one hop away, injectable"
      + " so the suite can plant ids — which is exactly what this text reader cannot follow.",
  },
  {
    file: "casting/evidence/inkCandidatePublicStorage.ts",
    text: "`users/${input.userId}/models/${input.modelId}/generated/ink/${input.candidateId}/${input.operationId}.webp`",
    because:
      "it THROWS unless both `candidateId` and `operationId` match `UUID_PATTERN`, two statements"
      + " above the key. A refusal in the same function is a stronger guarantee than a `randomUUID()`"
      + " call in the template, because it also rejects a caller's bad id.",
  },
  {
    file: "castingV2/diagnosticCapture.ts",
    text: "`${DIAGNOSTIC_KEY_PREFIX}/${input.userId}/${input.operationId}/${input.name}.png`",
    because:
      "`operationId` is a UUID, and this file's own line says it out loud —"
      + " *\"diagnostics never go to the public bucket\"*. Guessability is not this key's risk.",
  },
  {
    file: "castingV2/refusalLoopCapture.ts",
    text: "`${REFUSAL_LOOP_KEY_PREFIX}/${input.userId}/${input.operationId}/${input.candidatePublicId}.${input.outcome}.json`",
    because:
      "the same diagnostics family: `operationId` is a UUID (this file mints one with `randomUUID()`),"
      + " and the bytes are a refusal record rather than a customer's picture.",
  },
  {
    file: "routes/crewEyeFrames.ts",
    text: "`crew-eye/${frameName}`",
    because:
      "it is a READ, not a mint. `frameName` must be one of the keys the DEPLOYED briefing's"
      + " `eyeItems` name — anything else is a 404 whatever the bucket holds — so this expression"
      + " never creates an object and has no key to make unguessable.",
  },
];

describe("every storage key is minted from cryptographic randomness", () => {
  const sources = runtimeSources();
  const expressions: KeyExpression[] = [];
  const sourceOf = new Map<string, string>();
  for (const { relative, source } of sources) {
    sourceOf.set(relative, source);
    expressions.push(...keyExpressionsIn(relative, source));
  }
  const mintingFiles = [...new Set(expressions.map((e) => e.file))].sort();

  it("⚠ the reader can SEE — the named floor is all present", () => {
    /* A walk that quietly found nothing and a tree with nothing to find look
       identical. This is the arm that tells them apart, and it names the file
       rather than comparing a total. */
    expect(sources.length, "the walk itself found almost nothing").toBeGreaterThan(200);
    const missing = KEY_MINTING_FILES_FLOOR.filter((file) => !mintingFiles.includes(file));
    expect(
      missing,
      "these files minted a storage key when this floor was measured and no longer appear in the"
      + " population — either the writer moved (update the floor and say why) or the reader has"
      + " gone blind, and only one of those is safe",
    ).toEqual([]);
  });

  it("every key expression carries randomness, or is on the list with a reason", () => {
    const unexplained: string[] = [];
    for (const expression of expressions) {
      const source = sourceOf.get(expression.file) ?? "";
      if (carriesRandomness(expression, source)) continue;
      const listed = KEYS_WITHOUT_RANDOMNESS_IN_THE_TEXT.some(
        (row) => row.file === expression.file && row.text === expression.text,
      );
      if (!listed) unexplained.push(`${expression.file}  ${expression.text}`);
    }
    expect(
      unexplained.sort(),
      "these storage keys carry no cryptographic randomness this reader can find. A guessable key is"
      + " the only thing between a customer's face and anyone who guesses it — either mint it with"
      + " `crypto.randomUUID()`, or add a row to KEYS_WITHOUT_RANDOMNESS_IN_THE_TEXT saying where the"
      + " randomness actually comes from",
    ).toEqual([]);
  });

  it("⚠ and the exception list is read the OTHER way — a stale entry reddens", () => {
    /* An entry naming a key that no longer exists is how a list rots into a
       mirror, and it is the failure this shape exists to prevent: the sentence
       stays and is later believed about the wrong thing. */
    const stale = KEYS_WITHOUT_RANDOMNESS_IN_THE_TEXT.filter(
      (row) => !expressions.some((e) => e.file === row.file && e.text === row.text),
    ).map((row) => `${row.file}  ${row.text}`);
    expect(
      stale,
      "these rows name a key expression the reader no longer finds — the key was rewritten or moved,"
      + " so its reason needs re-reading rather than keeping",
    ).toEqual([]);

    for (const row of KEYS_WITHOUT_RANDOMNESS_IN_THE_TEXT) {
      expect(row.because.length, `${row.file} needs a real reason, not a placeholder`).toBeGreaterThan(60);
    }
  });

  it("no key-minting file reaches for Math.random in CODE", () => {
    /* ⚠ COMMENTS STRIPPED, AND THAT IS THE WHOLE POINT OF THIS ARM'S REWRITE.
       The old test was `not.toContain("Math.random")` over raw source, and two
       files in the widened population — `hairReferenceCutter.ts` and
       `keptFaceScan.ts` — contain that string in a COMMENT reading
       "`randomUUID`, never `Math.random`". So widening the population without
       this would have reddened the guard on prose praising the rule it
       enforces: the negation-contains-the-token class. */
    const offenders = mintingFiles.filter((file) => usesMathRandom(sourceOf.get(file) ?? ""));
    expect(offenders, "Math.random is not cryptographic randomness").toEqual([]);
  });

  it("every file with an inline randomUUID() imports it from node:crypto", () => {
    /* Scoped to files that actually MINT a UUID. `inkCandidatePublicStorage.ts`
       validates UUIDs it was handed and mints none, so demanding the import of
       it would be asserting a fact about the wrong file. */
    const minting = mintingFiles.filter((file) =>
      expressions.some((e) => e.file === file && e.text.includes("randomUUID()")));
    expect(minting.length, "no file mints a UUID inline — the reader has gone blind").toBeGreaterThan(10);
    for (const file of minting) {
      expect(
        withoutComments(sourceOf.get(file) ?? ""),
        `${file} interpolates randomUUID() into a storage key and must import it from node:crypto`,
      ).toContain('from "node:crypto"');
    }
  });
});

/**
 * ⚠ THE JUDGEMENT DRIVEN ON PLANTED SOURCES — because a tree where every key is
 * correct produces a green verdict whether the reader works or not.
 *
 * Every arm below is unreachable from the real tree. That is working law 2: a
 * green suite proves nothing if the checker cannot fail.
 */
describe("⚠ the reader itself, driven both ways", () => {
  const key = (text: string) => ({ file: "planted.ts", text, by: "test" });

  it("finds a key bound to a key-name, a key: property, a prefix constant, a put argument and a return", () => {
    expect(keyExpressionsIn("p.ts", "const fileKey = `a/b/${randomUUID()}.png`;")).toHaveLength(1);
    expect(keyExpressionsIn("p.ts", "store({ key: `a/b/${randomUUID()}.png` });")).toHaveLength(1);
    expect(keyExpressionsIn("p.ts", "const x = `${A_KEY_PREFIX}/${randomUUID()}.png`;")).toHaveLength(1);
    expect(keyExpressionsIn("p.ts", "await storagePut(`a/b/${randomUUID()}.png`, b, m);")).toHaveLength(1);
    expect(keyExpressionsIn("p.ts", "return `a/b/${randomUUID()}.png`;")).toHaveLength(1);
  });

  it("⚠ NEGATIVE CONTROL — it does not read PROSE as a key", () => {
    /* Both of these are real templates from this tree that got into the
       population before the `/` filter was added, and they are why it exists. */
    expect(keyExpressionsIn("p.ts", "return `${spoken}, apparent age ${years} years.${guard}`;")).toEqual([]);
    expect(keyExpressionsIn("p.ts", "return `The style named is ${a}: ${b}.${not}`;")).toEqual([]);
    /* And a data URI, an API URL and a CSV quote — the shapes that flooded in
       when the filename filter was removed (47 expressions in 37 files). */
    expect(keyExpressionsIn("p.ts", 'return `data:image/png;base64,${b.toString("base64")}`;')).toEqual([]);
    expect(keyExpressionsIn("p.ts", "return `https://api.github.com/repos/${repo}/issues?${q}`;")).toEqual([]);
  });

  it("⚠ NEGATIVE CONTROL — a key template inside a COMMENT is not a key", () => {
    expect(keyExpressionsIn("p.ts", "// const fileKey = `a/b/${randomUUID()}.png`;")).toEqual([]);
    expect(keyExpressionsIn("p.ts", "/* const fileKey = `a/b/${randomUUID()}.png`; */")).toEqual([]);
  });

  it("reads randomness inline AND through a binding in the same file", () => {
    expect(carriesRandomness(key("`a/${randomUUID()}.png`"), "")).toBe(true);
    const bound = "const suffix = randomUUID();\nconst fileKey = `a/${suffix}.png`;";
    expect(carriesRandomness(key("`a/${suffix}.png`"), bound)).toBe(true);
  });

  it("⚠ NEGATIVE CONTROL — a binding to something else is NOT randomness", () => {
    const weak = "const suffix = Math.random().toString(36);\nconst fileKey = `a/${suffix}.png`;";
    expect(carriesRandomness(key("`a/${suffix}.png`"), weak)).toBe(false);
    expect(carriesRandomness(key("`a/${Date.now()}.png`"), "")).toBe(false);
    /* A binding in a COMMENT does not count either. */
    expect(carriesRandomness(key("`a/${suffix}.png`"), "// const suffix = randomUUID();")).toBe(false);
  });

  it("⚠ NEGATIVE CONTROL — the Math.random reader fires on code and not on prose", () => {
    expect(usesMathRandom("const k = Math.random();")).toBe(true);
    /* The exact comment the two real files carry. A substring test over raw
       source would call this an offence. */
    expect(usesMathRandom("/* `randomUUID`, never `Math.random` — the name is the only thing. */")).toBe(false);
    expect(usesMathRandom("// randomUUID, never Math.random")).toBe(false);
  });
});
