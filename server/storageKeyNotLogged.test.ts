import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";

/* It shells out to `git ls-files` to derive its population, so it is in the
   child-process class rather than the merely-contended one — vitest's 5 s
   default would go red under load on somebody's machine and not in CI (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const repoRoot = path.resolve(__dirname, "..");

/**
 * A STORAGE KEY IS A CREDENTIAL AND DOES NOT GO IN A LOG — N4b-2 (#2470).
 *
 * `server/storage.ts` writes to a permanently PUBLIC bucket and its header says
 * what that means: served URLs are not presigned and never expire. CLAUDE.md
 * spells out the consequence — an object there is *"protected only by the URL
 * being hard to guess, and anyone who ever obtains one keeps access until the
 * object is deleted"*. **So the key IS the credential**, and a log line
 * carrying one widens that object's reach to wherever logs travel.
 *
 * # ⚠ THIS IS A CLASS GUARD, NOT A FIX'S RECEIPT — WHICH IS WHY IT IS DERIVED
 *
 * The relay's review of #2469 found ONE such line — `deleteClipQuietly`'s, and
 * it carried a **voice clip**, which is a cloning source rather than a picture.
 * Working law 7 is the reason this file exists rather than a one-line diff:
 * *"a bug found once is a pattern until proven unique"*, and the sweep is part
 * of the fix. The population is read off the tree every run, so a line added
 * next month in any module reddens without anybody remembering this rule.
 *
 * **Measured when it was written: ZERO.** The voice line was the only one in
 * the server, and it is fixed — so the honest reading today is an empty
 * population, which is exactly the reading that needs a control before it
 * counts for anything (working law 2: *a green suite proves nothing if the
 * checker cannot fail*). The positive control below plants each shape and
 * requires the reader to find it.
 *
 * ⚠ **AND `REFUSING_KEYS` IS THE WRONG TOOL FOR THIS, MEASURED RATHER THAN
 * ASSUMED.** `shared/errorEventScrub.ts`'s own docblock records what a refusing
 * key for a field that cannot appear costs: *"a refusing key for a field that
 * can no longer appear is not harmless — it is a list nobody can trust"* (its
 * ninth key, removed after an hour). The scrub list guards what leaves for a
 * third party; this guards what is written at all.
 */

/**
 * The field names that hold a storage key in this product.
 *
 * Read from the column names the stores actually use rather than imagined: the
 * voice clip (`clipStorageKey`), the generic one every writer passes
 * (`storageKey`), and the two the model-asset rows carry (`imageKey`,
 * `thumbKey`) — CLAUDE.md's metadata-only boundary names `imageKey` by hand as
 * a field that must not cross a serialization boundary, and a log is a boundary
 * too.
 */
const KEY_FIELDS = ["storageKey", "clipStorageKey", "imageKey", "thumbKey"] as const;

/**
 * A log call whose FIRST argument object mentions one of those fields.
 *
 * It reads the pino shape this product logs in — `log.warn({ … }, "message")` —
 * and deliberately only the object, because the message is prose a key cannot
 * hide in without being spelled as a field.
 *
 * ⚠ **Its limit is stated rather than discovered**: a key put into a VARIABLE
 * first and logged under another name (`log.error({ where: key }, …)`) is
 * invisible here, so a clean reading is a FLOOR and not coverage. What it does
 * catch is the shape every instance so far has taken — the field passed
 * straight through — which is the shape a hurried diagnosis reaches for.
 */
function logCallsCarryingAKey(source: string): string[] {
  const hits: string[] = [];
  const call = /\blog\.(?:error|warn|info|debug|fatal|trace)\(\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = call.exec(source))) {
    /* Walk to the matching brace rather than regexing the object: a nested
       `{ err: { … } }` ends a lazy pattern early and the rest of the object —
       where a key would sit — goes unread. */
    let depth = 0;
    let index = match.index + match[0].length - 1;
    const start = index;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const objectText = source.slice(start, index + 1);
    for (const field of KEY_FIELDS) {
      if (new RegExp(`\\b${field}\\b`).test(objectText)) {
        hits.push(`${match[0]}…${field}…}`);
        break;
      }
    }
  }
  return hits;
}

function trackedServerSources(): string[] {
  const tracked = execFileSync("git", ["ls-files", "server/*.ts", "server/**/*.ts"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.endsWith(".test.ts"));

  if (tracked.length === 0) {
    /* A sweep over no files answers every question with "clean". */
    throw new Error(
      "storageKeyNotLogged: git ls-files returned no server sources. " +
        "A population of zero is a broken reading, not a clean tree.",
    );
  }
  return tracked;
}

describe("the reader can see a logged storage key (the positive control)", () => {
  it("finds each key field passed straight into a log call", () => {
    for (const field of KEY_FIELDS) {
      const planted = `log.error({ err: error, ${field} }, "[x] could not delete");`;
      expect(
        logCallsCarryingAKey(planted),
        `the reader must see ${field} in a log call`,
      ).toHaveLength(1);
    }
  });

  it("sees a key sitting AFTER a nested object, which a lazy pattern would miss", () => {
    /* The shape the real line had: `{ err: error, storageKey }` — the nested
       `err` is why the reader walks braces instead of matching `\\{[^}]*\\}`. */
    const planted = `log.error({ err: { type: "E", meta: { a: 1 } }, storageKey }, "m");`;
    expect(logCallsCarryingAKey(planted)).toHaveLength(1);
  });

  it("does not fire on a key that is merely nearby (the negative control)", () => {
    const innocent = [
      `const storageKey = voiceClipKey(userId, modelId);`,
      `await storageDelete(storageKey);`,
      `log.error({ err: error, userId, modelId }, "[Voice] could not delete");`,
    ].join("\n");
    expect(logCallsCarryingAKey(innocent)).toEqual([]);
  });
});

describe("no server log line carries a storage key", () => {
  it("reads the whole server tree and finds none", () => {
    const offenders: string[] = [];
    for (const file of trackedServerSources()) {
      const source = readListedSource(path.join(repoRoot, file));
      if (source === null) continue;
      for (const hit of logCallsCarryingAKey(source)) offenders.push(`${file}: ${hit}`);
    }
    expect(
      offenders,
      "A storage key is a credential on this product's public bucket. Log the cast "
        + "(userId + modelId) and read the key from its row — see "
        + "server/castingV2/voiceService.ts's deleteClipQuietly for the worked example.",
    ).toEqual([]);
  });
});
