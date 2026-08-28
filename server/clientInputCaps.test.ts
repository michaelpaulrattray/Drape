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

/**
 * THE SAME LAW ON A LIST RATHER THAN A NUMBER — what a file picker offers.
 *
 * A cap is not the only thing a client re-types. `accept="image/png,image/jpeg,
 * image/webp"` is a copy of the list a server door admits, and it fails in the
 * quietest way this product has: a fourth format added at the door and missed
 * here does not error, does not log and does not refuse. The picker filters the
 * customer's file away, nothing says why, and she concludes we will not take her
 * picture.
 *
 * #27's seventeenth site, found on its way to being CREATED (the review of PR
 * #188 caught the concept-upload card writing a third copy). One client home was
 * the best available while the list lived in a server module; `shared/
 * pictureFormats.ts` makes it a derivation, and this is what stops it being
 * re-typed.
 */
describe("no picture picker types its own copy of the door's format list", () => {
  /*
    TWO SHAPES, because one of them alone leaves the obvious escape open.

    (A) an `accept=` attribute naming a subtype. `accept="image/*"` names no
        formats and is not a copy of anything, so it is not caught — correctly.
    (B) ANY string literal enumerating two or more image subtypes. Without this
        the ban is a ban on one ATTRIBUTE: re-typing the list into a constant a
        line above the picker satisfies (A) completely, which is exactly the
        shape `pictureBytes.ts` had. Two-or-more is what makes it a copy of a
        VOCABULARY rather than a mime somebody needed once — a canvas export's
        `"image/png"` is not a mirror of anything and stays legal.

    ⚠ DECLARED LIMIT, so it is not re-derived by the next reader: an ARRAY of
    single-mime strings (`["image/jpeg", "image/png"]`) satisfies neither shape,
    because each literal names one subtype. Three surfaces carry that form
    today — `wardrobe/constants.ts`, `moderator/ChangeRequestModal.tsx` (whose
    list includes `gif` and could not derive from this vocabulary at all) and
    `casting/evidence/inkAddUxPolicy.ts`. They are on #27's remainder, not
    silently covered here.
  */
  const NAMES_A_SUBTYPE = /image\/[a-z0-9.+-]+/i;
  const SUBTYPES_EVERYWHERE = /image\/[a-z0-9.+-]+/gi;

  const acceptLiterals = (code: string): string[] => {
    const found: string[] = [];
    for (const hit of code.matchAll(/accept=(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\})/g)) {
      const value = hit[1] ?? hit[2] ?? hit[3] ?? "";
      if (NAMES_A_SUBTYPE.test(value)) found.push(value);
    }
    return found;
  };

  const listLiterals = (code: string): string[] => {
    const found: string[] = [];
    for (const hit of code.matchAll(/["'][^"']*["']/g)) {
      if ((hit[0].match(SUBTYPES_EVERYWHERE) ?? []).length >= 2) found.push(hit[0]);
    }
    return found;
  };

  const mirrors = (code: string): string[] => [...acceptLiterals(code), ...listLiterals(code)];

  /*
    THE ENUMERATED REMAINDER, AND IT ONLY SHRINKS.

    Four legacy surfaces carry an accept literal today. They are NOT swept into
    the derivation, deliberately: each mirrors a different server truth (the
    avatar upload, the garment rack, the legacy ink panel — none of them the
    casting door's `INK_DESIGN_FORMATS`), and rewriting retire-lane surfaces to
    point at a vocabulary that is not theirs would be the mirror moved rather
    than closed. They are named here so that "no offenders" cannot quietly mean
    "the ban is scoped until it finds nothing".

    A file that stops carrying a literal REDDENS this suite until its line is
    deleted — the house pattern (`KNOWN_DEBTS`, `DECLARED_BUT_UNMIGRATED`): a
    debt list that can silently be satisfied is a debt list nobody deletes from.
  */
  const LEGACY_ACCEPT_LITERALS = [
    "features/casting/evidence/InkAddPanel.tsx",
    "features/profile/ProfileTab.tsx",
    "features/studio/components/ModelUploadZone.tsx",
    "features/wardrobe/components/RackPanel.tsx",
  ];

  const relative = (file: string): string =>
    file.slice(CLIENT_SRC.length).split("\\").join("/").replace(/^\/+/, "");

  it("finds the pickers to sweep — the instrument before its finding", async () => {
    /*
      Same control as the cap sweep above, and it is not ceremony: a reader that
      finds nothing passes the ban below while proving nothing at all. The floor
      is far under the real count, and the SHAPE is asserted too — at least one
      file must actually carry an `accept=` with a named subtype, or the ban is
      being asked of a population with no instances of what it bans.
    */
    const files = await everyClientSource(CLIENT_SRC);
    expect(files.length, "the sweep found almost nothing — check the path").toBeGreaterThan(300);

    const sources = await Promise.all(files.map((f) => readFile(f, "utf8")));
    const withAccept = sources.filter((s) => mirrors(withoutProse(s)).length > 0);
    expect(withAccept.length, "no client file names a format at all — the ban is inert")
      .toBeGreaterThan(0);
  });

  it("NOT ONE of them is outside the enumerated remainder", async () => {
    const files = await everyClientSource(CLIENT_SRC);
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(file);
      if (LEGACY_ACCEPT_LITERALS.includes(rel)) continue;
      const code = withoutProse(await readFile(file, "utf8"));
      for (const value of mirrors(code)) offenders.push(`${rel} — ${value}`);
    }

    expect(
      offenders,
      "a picker hand-types the list its door owns — import it from "
        + `shared/pictureFormats.ts instead:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the remainder has not quietly been paid — a fixed file deletes its line", async () => {
    const stale: string[] = [];
    for (const rel of LEGACY_ACCEPT_LITERALS) {
      const code = withoutProse(await readFile(join(CLIENT_SRC, rel), "utf8"));
      if (mirrors(code).length === 0) stale.push(rel);
    }
    expect(
      stale,
      `no longer carries an accept literal — delete it from LEGACY_ACCEPT_LITERALS:\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the vocabulary is read from BOTH sides, like every cap above", async () => {
    /*
      The move only pays if both ends read the moved module. A server call site
      re-declaring the list, or the client going back to a literal, each leaves
      the other deriving from something nothing else enforces — which is the
      shape this whole file exists to catch, one level up from a number.

      ⚠ PROSE IS STRIPPED HERE TOO, and it was not in the first draft: this file
      and the door both NAME `INK_DESIGN_FORMATS` in their docblocks, so an
      unstripped read is satisfied by a comment about the constant long after
      the last line of code that reads it is gone. The sabotage driver caught
      it — case 7 removed the server's re-export and this arm stayed green.
    */
    const declaration = await readFile(
      new URL("../shared/pictureFormats.ts", import.meta.url),
      "utf8",
    );
    const declared = [...declaration.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
    expect(declared, "no exports found — the reader is broken").toContain("INK_DESIGN_FORMATS");

    const codeOf = async (files: string[]): Promise<string> =>
      (await Promise.all(files.map((f) => readFile(f, "utf8")))).map(withoutProse).join("\n");

    const clientCode = await codeOf(await everyClientSource(CLIENT_SRC));
    const serverCode = await codeOf(
      await everyClientSource(
        new URL("./castingV2/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
      ),
    );

    expect(clientCode, "the client stopped reading the format vocabulary")
      .toContain("INK_DESIGN_FORMATS");
    expect(serverCode, "the server stopped reading the format vocabulary")
      .toContain("INK_DESIGN_FORMATS");
  });
});
