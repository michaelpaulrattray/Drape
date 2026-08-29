/**
 * THE ENUM THAT IS PINNED IN FOUR PLACES, MECHANIZED (fable-486 §g).
 *
 * `storage_cleanup_batches.kind` is written down in the ORM, in a startup
 * fence, in a contract test, in a snapshot fixture — and, until this change, in
 * a ceremony script OUTSIDE the coupled-contract registry that names the other
 * four. Migration 0017 hit three of them; the plan named two; the third was
 * found by a failing test. A registry entry says where the copies are; this
 * says what may and may not be true of them.
 *
 * # The lag is LEGITIMATE, and that is the whole subtlety
 *
 * The fence pins the **live** DDL, which deliberately trails the ORM enum: ship
 * the enum and the migration, the founder runs it against production, THEN the
 * fence gains the value, then deploy. A test asserting the two are equal would
 * force the fence to describe a database that does not exist yet — the
 * 2026-07-31 boot-guard shape, where production crash-looped on a guard
 * describing something that had not been applied.
 *
 * So the rule is a SUBSET, not an equality: the fence may lag the code, and it
 * may never lead it.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { STORAGE_CLEANUP_BATCH_KINDS } from "../drizzle/schema";
import { readListedSource } from "./testing/listedSource";

const repoRoot = path.resolve(import.meta.dirname, "..");

/** The members of an `enum('a','b')` DDL string, in order. */
function membersOf(ddl: string): string[] {
  const inside = ddl.match(/enum\(([^)]*)\)/i)?.[1] ?? "";
  return inside.split(",").map((part) => part.trim().replace(/^'|'$/g, "")).filter(Boolean);
}

function fenceDdl(): string {
  const source = fs.readFileSync(
    path.join(repoRoot, "server", "casting", "evidence", "evidenceComposerSchema.ts"), "utf8");
  const line = source.match(/"storage_cleanup_batches\.kind":\s*\n?\s*"([^"]+)"/);
  if (!line) throw new Error("the startup fence no longer pins storage_cleanup_batches.kind");
  return line[1]!;
}

describe("the members of a DDL enum, read", () => {
  /* The reader before its verdicts (working law 2): it can find members, and it
     reports none when there are none to find. */
  it("CAN read a list, and CAN report an empty one", () => {
    expect(membersOf("enum('a','b','c')")).toEqual(["a", "b", "c"]);
    expect(membersOf("varchar(36)")).toEqual([]);
  });
});

describe("storage_cleanup_batches.kind, in every place it is written down", () => {
  it("the startup fence may LAG the code and may never LEAD it", () => {
    const fence = membersOf(fenceDdl());
    expect(fence.length).toBeGreaterThan(0);
    /* Subset, in order — a fence carrying a value the ORM does not declare is a
       guard describing a column nothing can write to. */
    for (const member of fence) expect(STORAGE_CLEANUP_BATCH_KINDS).toContain(member);
    expect(fence).toEqual(STORAGE_CLEANUP_BATCH_KINDS.slice(0, fence.length));
  });

  it("NO script spells the member list — the ceremony derives it", () => {
    /*
      The copy fable-486 §g found. A script that hardcodes the DDL is a fifth
      pin nobody adding a kind would think to look for, and it is the one that
      runs against PRODUCTION.
    */
    const scripts = path.join(repoRoot, "scripts");
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.m?ts$/.test(entry.name)) continue;
        /* Listed, then gone — a parallel suite plants and unlinks here (#223). */
        const source = readListedSource(full);
        if (source === null) continue;
        for (const match of source.matchAll(/enum\((\s*'[^)]*)\)/gi)) {
          const members = membersOf(`enum(${match[1]})`);
          /* Two or more of THIS enum's members spelled together is the copy;
             one word in prose or a different enum entirely is not. */
          const shared = members.filter((member) =>
            (STORAGE_CLEANUP_BATCH_KINDS as readonly string[]).includes(member));
          if (shared.length >= 2) offenders.push(`${path.relative(repoRoot, full)}: ${shared.join(",")}`);
        }
      }
    };
    walk(scripts);
    expect(offenders).toEqual([]);
  });

  it("CAN FAIL — the hunt, driven directly on the shape it looks for", () => {
    /* Without this, a regex that matched nothing would pass this file forever.
       The same reader, handed the string the ceremony used to carry. */
    const shipped = "enum('model_delete','account_delete','evidence_cleanup')";
    const shared = membersOf(shipped).filter((member) =>
      (STORAGE_CLEANUP_BATCH_KINDS as readonly string[]).includes(member));
    expect(shared.length).toBeGreaterThanOrEqual(2);
    /* And a DDL for a different column is NOT this enum's copy. */
    const elsewhere = membersOf("enum('uploaded_reference','accepted_candidate')")
      .filter((member) => (STORAGE_CLEANUP_BATCH_KINDS as readonly string[]).includes(member));
    expect(elsewhere).toEqual([]);
  });
});
