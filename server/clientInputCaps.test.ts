/**
 * NO CLIENT INPUT TYPES ITS OWN COPY OF A SERVER CAP.
 *
 * # What this is for
 *
 * A `maxLength={N}` on a client input is a second copy of a number the server's
 * zod schema owns — working law 4, a list shadowing a source of truth. The
 * product had eighteen of them and sixteen were hand-typed, with nothing in the
 * suite comparing a single one against the schema it shadows.
 *
 * It was filed as a drift RISK (§10 row 3f). It is not a risk. Two of them had
 * already drifted when the row was written:
 *
 *   - `RedeemCodeModal` capped at 16 against a schema accepting 20, free only
 *     by luck about a format nobody had opened;
 *   - and opening that format found `Expected: FORMA-XXXXXX` in the refusal a
 *     customer sees — a prefix retired six months earlier by a rebrand commit
 *     that had both files open and reported *"All 952 tests passing"*.
 *
 * # ⚠ WHY THIS SWEEPS RATHER THAN WALKING A LIST
 *
 * Because a list cannot know what it does not contain. The census that bought
 * this build found `renameCast`'s cap of 60 typed in **two** client files for
 * **one** server procedure — a three-place cap that any 1:1 pairing of sites to
 * schemas would have half-fixed, leaving the other standing.
 *
 * So the population is DERIVED: every `.tsx`/`.ts` under `client/src`, read off
 * disk. A new surface with a hand-typed cap reddens this on the day it is
 * written, without anybody remembering to add it here.
 *
 * # Prose is stripped, and that is load-bearing
 *
 * Several of the files this reads quote the old literal on purpose, in the
 * docblocks recording what went wrong. An unstripped sweep reddens on its own
 * repair — which it did, in the referral arm one file over, and is why the
 * stripper was already written.
 */
import { describe, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const CLIENT_SRC = new URL("../client/src/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** The code with its prose removed — a comment about a rule is not a breach of it. */
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

async function everyClientSource(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await everyClientSource(path)));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

describe("no client input types its own copy of a server cap", () => {
  it("finds the surfaces to sweep — the instrument before its finding", async () => {
    /*
      The control this arm cannot do without: a sweep that reads nothing passes
      every ban in this file. A directory rename, a bad path join, a `readdir`
      that throws and is swallowed — each one turns this suite green while
      proving nothing.

      The floor is deliberately far below the real count (~700 at the time of
      writing) so that ordinary growth or tidying never touches it, and the
      SHAPE is asserted too: at least one file must actually contain a
      `maxLength`, or the ban below is being asked of a population that has no
      instances of what it bans.
    */
    const files = await everyClientSource(CLIENT_SRC);
    expect(files.length, "the sweep found almost nothing — check the path").toBeGreaterThan(300);

    const sources = await Promise.all(files.map((f) => readFile(f, "utf8")));
    const withCaps = sources.filter((s) => s.includes("maxLength="));
    expect(withCaps.length, "no client file has a maxLength at all — the ban is inert")
      .toBeGreaterThan(5);
  });

  it("NOT ONE of them is a bare number", async () => {
    /*
      The whole rule, in one assertion. A cap is declared in `shared/` — in
      `inputLimits.ts`, or in the module that owns the shape it comes from
      (`refineLimits.ts`, `referralCodeFormat.ts`) — and both sides import it.

      What is banned is the LITERAL, not the attribute: `maxLength={CONST}`,
      `maxLength={fn(x)}` and `maxLength={Math.min(a, b)}` are all fine, and the
      last of those is a real site — one field whose two destinations are two
      different schemas.
    */
    const files = await everyClientSource(CLIENT_SRC);
    const offenders: string[] = [];

    for (const file of files) {
      const code = withoutProse(await readFile(file, "utf8"));
      for (const hit of code.matchAll(/maxLength=\{\s*(\d+)\s*\}/g)) {
        offenders.push(`${file.slice(CLIENT_SRC.length)} — maxLength={${hit[1]}}`);
      }
      /* The same ban on the JSX attribute form, which takes a string. */
      for (const hit of code.matchAll(/maxLength="(\d+)"/g)) {
        offenders.push(`${file.slice(CLIENT_SRC.length)} — maxLength="${hit[1]}"`);
      }
    }

    expect(
      offenders,
      `a client input hand-types a cap the server owns:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every declared cap is read from BOTH sides — the half nobody would notice", async () => {
    /*
      The arm above only watches the client, and a cap has two ends. Re-typing
      the literal back into the zod schema and dropping the import leaves the
      client deriving from a constant nothing enforces — the mirror standing on
      the side where nobody looks, which is (c) of the census's findings and the
      reason `announcements.ts`'s SECOND copy mattered.

      Derived from the declaration rather than checked against a list: every
      export of `shared/inputLimits.ts` must have at least one importer under
      `server/` and one under `client/`. A constant that loses either end is a
      constant that has stopped being a single source of truth, and the failure
      names which end went.
    */
    const declaration = await readFile(
      new URL("../shared/inputLimits.ts", import.meta.url),
      "utf8",
    );
    const declared = [...declaration.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
    expect(declared.length, "no constants found — the reader is broken").toBeGreaterThan(10);

    const clientFiles = await everyClientSource(CLIENT_SRC);
    const serverFiles = await everyClientSource(
      new URL("./routes/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    );
    const read = async (files: string[]) =>
      (await Promise.all(files.map((f) => readFile(f, "utf8")))).join("\n");
    const [clientCode, serverCode] = await Promise.all([read(clientFiles), read(serverFiles)]);

    const orphans: string[] = [];
    for (const name of declared) {
      const inClient = new RegExp(`\\b${name}\\b`).test(clientCode);
      const inServer = new RegExp(`\\b${name}\\b`).test(serverCode);
      if (!inServer) orphans.push(`${name} — no SERVER reader (the schema re-typed its literal?)`);
      if (!inClient) orphans.push(`${name} — no CLIENT reader (the input re-typed its literal?)`);
    }

    expect(orphans, `a cap lost one of its two ends:\n  ${orphans.join("\n  ")}`).toEqual([]);
  });
});
