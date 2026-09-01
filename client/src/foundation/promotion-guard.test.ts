import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * THE PROMOTION GUARDS (#262) — the two things his ruling can lose silently.
 *
 * The founder approved moving five components out of `features/castingV2/` and
 * into the foundation, 2026-08-30: *"Five of the six move — modal shell,
 * destructive confirm, overflow menu, rename dialog, delete-by-typing. Casting
 * imports them back, no behaviour change."* Both arms below guard a promise
 * that would otherwise decay with no error and no failing test.
 *
 * ⚠ **Neither is a style rule.** The direction arm is what stops the promotion
 * being undone by one convenient import, and the one-owner arm is the founder's
 * own stated reason for putting the dialogs on a shared shell: *"if they land
 * as three independent components they'll drift the way the popovers did."*
 */

const FOUNDATION = new URL("./", import.meta.url);

/**
 * ⚠ COMMENTS ARE STRIPPED BEFORE ANY OF THIS IS ASSERTED, and that is not a
 * convenience — it is the difference between a guard and a gag.
 *
 * Both arms below look for the ABSENCE of a thing (`createPortal`, a second
 * scrim). The docblocks in these very files describe the defect being guarded
 * against — *"It used to build its own `createPortal`…"* — so a reader that
 * searched raw text would redden on the RECORD of the bug rather than on the
 * bug, and the cheapest way to green it would be to delete the explanation.
 * A guard that punishes the reasoning is a guard that erases it.
 */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const sources = async () => {
  const names = (await readdir(FOUNDATION)).filter(
    (n) => (n.endsWith(".ts") || n.endsWith(".tsx")) && !n.endsWith(".test.ts"),
  );
  return Promise.all(
    names.map(async (name) => ({
      name,
      text: code(await readFile(new URL(name, FOUNDATION), "utf8")),
    })),
  );
};

describe("the foundation does not depend on the features that fed it", () => {
  it("imports nothing from features/ — the direction that makes promotion mean anything", async () => {
    /*
      The audit named this the day it proposed the move: *"foundation/ must
      never import features/ — true today, worth a guard arm the day the first
      component moves."* Today is that day.

      A single `import … from "@/features/…"` in here turns the shared kit back
      into a casting subfolder with a different address, and nothing else in the
      build would complain: the app compiles, the tests pass, and the next
      surface that adopts a foundation component quietly drags casting in with
      it. The failure is architectural, so the guard has to be too.
    */
    const offenders: string[] = [];
    for (const { name, text } of await sources()) {
      for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
        const specifier = match[1];
        if (specifier.includes("@/features/") || specifier.includes("../features/")) {
          offenders.push(`${name} → ${specifier}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("READS A REAL POPULATION — a directory walk that finds nothing cannot pass green", async () => {
    /*
      The arm above is an absence assertion, and an absence assertion over an
      empty list is the cheapest false pass there is: rename the folder, break
      the glob, and `[] === []` reports the architecture is sound. So the
      population is asserted, and one known import is named to prove the reader
      actually parses specifiers rather than returning nothing.
    */
    const files = await sources();
    expect(files.length).toBeGreaterThan(15);
    const shell = files.find((f) => f.name === "CastingModal.tsx");
    expect(shell).toBeDefined();
    expect(shell?.text).toContain('from "react-dom"');
  });
});

describe("the three dialogs are one shell with different contents", () => {
  it("none of them builds a second portal, scrim or Escape handler", async () => {
    /*
      His reason, verbatim: *"Rename, delete-by-typing and sign are one shell
      with different contents — that's what the specs say, and if they land as
      three independent components they'll drift the way the popovers did."*

      The drift had already started. The rename dialog owned its own
      `createPortal`, its own `<div className="dpc-modal">` scrim and its own
      Escape listener while borrowing the shell's classes for everything else —
      two owners of what a modal DOES, and the second one had no focus trap, so
      Tab walked out of the field and into the page behind the scrim.
    */
    const files = Object.fromEntries((await sources()).map((f) => [f.name, f.text]));
    const casting = code(
      await readFile(
        new URL("../features/castingV2/components/SignConfirm.tsx", FOUNDATION),
        "utf8",
      ),
    );

    for (const [who, text] of [
      ["RenameDialog.tsx", files["RenameDialog.tsx"]],
      ["DestructiveConfirm.tsx", files["DestructiveConfirm.tsx"]],
      ["SignConfirm.tsx", casting],
    ] as const) {
      expect(text, `${who} must not portal`).not.toContain("createPortal");
      expect(text, `${who} must not own Escape`).not.toContain('"Escape"');
      expect(text, `${who} must run on the shared shell`).toMatch(
        /<(CastingModal|ModalScrim)\b/,
      );
    }
  });

  it("and the shell is the ONE owner of the behaviour", async () => {
    /*
      `CastingModal` composes `ModalScrim` rather than repeating it, so there is
      exactly one portal, one scrim element and one focus trap in the family.
      Counted rather than eyeballed: a second `createPortal` in this file is a
      second owner however it is spelled.
    */
    const shell = code(await readFile(new URL("CastingModal.tsx", FOUNDATION), "utf8"));
    expect(shell.match(/createPortal\(/g) ?? []).toHaveLength(1);
    /*
      ⚠ THE SCRIM CLASS IS NO LONGER A BARE ATTRIBUTE (2026-09-01, section 03):
      the shell takes an optional `scrimClassName` so the three account surfaces
      can declare their own stacking order, so it reads
      `` className={scrimClassName ? `dpc-modal ${scrimClassName}` : "dpc-modal"} ``.
      What this arm is counting is unchanged — that ONE element in the family
      carries the scrim class — so it counts the string literal rather than the
      attribute form. A second `"dpc-modal"` anywhere in the file is still a
      second owner however it is spelled.
    */
    expect(shell.match(/"dpc-modal"/g) ?? []).toHaveLength(1);
    expect(shell.match(/key === "Escape"/g) ?? []).toHaveLength(1);
  });
});
