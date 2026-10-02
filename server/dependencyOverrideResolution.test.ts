/**
 * THE OVERRIDE-RESOLUTION READER, DRIVEN BOTH WAYS (#1815).
 *
 * `scripts/lib/overrideResolution.mts` answers one question — does this
 * `pnpm.overrides` entry govern a package that is actually in the tree — and
 * `pnpm warden:overrides` prints it for the Warden patrol. The reader's own
 * header carries the design, the measurements and the roads declined. This file
 * carries the three things that make it an instrument rather than a claim.
 *
 * **1 · BOTH DIRECTIONS, because one direction proves nothing here.** A reader
 * that reported EVERY override as dead would satisfy every "the absent one is
 * reported" arm, and a reader that reported NONE would satisfy every "the
 * present one is not" arm. The card's own done-when says so: *"the reader is
 * driven both ways — an absent package is reported, a present one is not —
 * because a reader that reported nothing would look exactly like a clean
 * tree."*
 *
 * **2 · THE REFUSALS ARE THE LOAD-BEARING ARMS.** A parse that silently came up
 * empty would report all nine overrides as governing nothing, which is the
 * loudest false finding this reader can produce. So an empty override block, a
 * missing `packages:`/`snapshots:` block, an empty one, and an entry key the
 * reader cannot parse each have an arm — and the command's exit code is
 * asserted through a real child process, because exit 1 on a refusal against
 * exit 0 on a finding is half of what this reader promises.
 *
 * **3 · A CONTROL PAIR ON THE REAL LOCKFILE, keyed on nothing the override
 * block contains.** The real-tree arms ask the reader about a package the tree
 * certainly has (`vitest`, this suite's own runner) and one it certainly does
 * not, so the instrument is proven against the artifact it will actually be run
 * on WITHOUT asserting how many overrides are currently dead. That count is
 * three today and #1815 leaves the removal decision open — an arm pinned to it
 * would redden on the very commit that acts on the reading, which is the
 * `fix-drops-subject-from-guard` shape.
 *
 * ⚠ **What is NOT asserted, and the omission is the point**: nothing here says
 * `tar`, `lodash-es` and `mdast-util-to-hast` are dead. That is a finding for
 * whoever reads the command's output, not a fact for a suite to hold. This
 * suite proves the reader works; the reading is the reader's job.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";
import { readListedSource } from "./testing/listedSource";

import {
  OverrideReadingRefusal,
  lockfileBlockKeys,
  packageNameAndVersion,
  readDeclaredOverrides,
  readOverrideResolution,
  resolvedVersions,
} from "../scripts/lib/overrideResolution.mts";

/* This suite drives a real child process for the command's exit codes, so it
   declares the class's timeout rather than racing vitest's 5 s default under a
   parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = resolve(ROOT, "scripts/override-resolution-read.mts");

/**
 * A lockfile in the exact shape pnpm v9 writes it: `packages:` entries carry a
 * `resolution:` body, `snapshots:` entries use the inline `: {}` form, and an
 * `importers:` block sits above both so the reader has a neighbour to stop at.
 */
function lockfileOf(packagesBlock: string, snapshotsBlock: string): string {
  return [
    "lockfileVersion: '9.0'",
    "",
    "settings:",
    "  autoInstallPeers: true",
    "",
    "importers:",
    "",
    "  .:",
    "    dependencies:",
    "      left-pad:",
    "        specifier: ^1.0.0",
    "        version: 1.0.0",
    "",
    "packages:",
    "",
    packagesBlock,
    "snapshots:",
    "",
    snapshotsBlock,
  ].join("\n");
}

const withBody = (keys: string[]) =>
  keys.map((key) => `  ${key}:\n    resolution: {integrity: sha512-x}\n`).join("");
const inline = (keys: string[]) => keys.map((key) => `  ${key}: {}\n`).join("");

/** The ordinary fixture: the same packages recorded by both blocks. */
function lockfile(packages: string[], snapshots: string[] = packages): string {
  return lockfileOf(withBody(packages), inline(snapshots));
}

function packageJson(overrides: Record<string, unknown> | undefined): string {
  return JSON.stringify(
    overrides === undefined
      ? { name: "fixture", pnpm: {} }
      : { name: "fixture", pnpm: { overrides } },
    null,
    2,
  );
}

describe("the reader — an absent package is reported, a present one is not", () => {
  it("reports the override whose package is nowhere in the lockfile", () => {
    const reading = readOverrideResolution(
      packageJson({ tar: "^7.5.18", "left-pad": "^1.0.0" }),
      lockfile(["left-pad@1.0.0"]),
    );
    expect(reading.dead).toEqual(["tar"]);
  });

  it("does NOT report the override whose package is there — the negative control", () => {
    /* Without this arm a reader returning every name satisfies the arm above. */
    const reading = readOverrideResolution(
      packageJson({ "left-pad": "^1.0.0" }),
      lockfile(["left-pad@1.0.0"]),
    );
    expect(reading.dead).toEqual([]);
    expect(reading.rows).toEqual([
      {
        name: "left-pad",
        range: "^1.0.0",
        versions: ["1.0.0"],
        governs: true,
      },
    ]);
  });

  it("carries the resolved version beside the declared range, which is what a reader judges on", () => {
    const reading = readOverrideResolution(
      packageJson({ "left-pad": "^1.0.0" }),
      lockfile(["left-pad@1.4.0"]),
    );
    expect(reading.rows[0]).toMatchObject({
      range: "^1.0.0",
      versions: ["1.4.0"],
    });
  });

  it("collects every version of a package the tree resolves more than once", () => {
    const reading = readOverrideResolution(
      packageJson({ "left-pad": "^1.0.0" }),
      lockfile(["left-pad@1.0.0", "left-pad@1.4.0"]),
    );
    expect(reading.rows[0]!.versions).toEqual(["1.0.0", "1.4.0"]);
  });

  it("prints the governing entries first and the finding last", () => {
    /* The dead names sit next to the verdict line that names them, so the
       command's output reads in one direction. */
    const reading = readOverrideResolution(
      packageJson({ tar: "^7.5.18", "left-pad": "^1.0.0", zeta: "^2.0.0" }),
      lockfile(["left-pad@1.0.0"]),
    );
    expect(reading.rows.map((row) => row.name)).toEqual([
      "left-pad",
      "tar",
      "zeta",
    ]);
  });

  it("is found in the `: {}` snapshot form alone, which the first probe for this card could not read", () => {
    /* The measured defect, pinned: `name@version: {}` is how pnpm writes a
       package with no dependencies, and 258 of this tree's 715 snapshot
       entries use it — `lodash` and `fast-uri`, two LIVE overrides, among
       them. A reader blind to it reports a live override as dead. Here the
       governed package appears ONLY in that form, in `snapshots:`. */
    const reading = readOverrideResolution(
      packageJson({ "left-pad": "^1.0.0" }),
      lockfile(["other@1.0.0"], ["left-pad@1.0.0"]),
    );
    expect(reading.dead).toEqual([]);
    expect(reading.rows[0]!.versions).toEqual(["1.0.0"]);
  });

  it("keeps a scoped name whole, and strips a peer or patch suffix", () => {
    const reading = readOverrideResolution(
      packageJson({ "@scope/thing": "^3.0.0", wouter: "^3.7.1" }),
      lockfile([
        "'@scope/thing@3.1.0'",
        "wouter@3.7.1(patch_hash=4e16e6ff)(react@19.3.0)",
      ]),
    );
    expect(reading.dead).toEqual([]);
    expect(reading.rows.map((row) => [row.name, row.versions])).toEqual([
      ["@scope/thing", ["3.1.0"]],
      ["wouter", ["3.7.1"]],
    ]);
  });
});

describe("packageNameAndVersion — the split, driven on every shape the lockfile writes", () => {
  it.each([
    ["tar@7.5.18", "tar", "7.5.18"],
    ["@aws-sdk/client-s3@3.1135.0", "@aws-sdk/client-s3", "3.1135.0"],
    ["@babel/core@7.29.7(supports-color@8.1.1)", "@babel/core", "7.29.7"],
    ["wouter@3.7.1(patch_hash=4e16)(react@19.3.0)", "wouter", "3.7.1"],
    /* pnpm writes a URL or git reference here for a dependency resolved that
       way; the reader deliberately does not validate the version's shape. */
    ["foo@https://example.test/foo.tgz", "foo", "https://example.test/foo.tgz"],
  ])("reads %j as %j at %j", (key, name, version) => {
    expect(packageNameAndVersion(key)).toEqual({ name, version });
  });

  it.each(["tar", "@scope/thing", "tar@", "@"])(
    "refuses %j, which is not a name@version",
    (key) => {
      expect(() => packageNameAndVersion(key)).toThrow(OverrideReadingRefusal);
    },
  );
});

describe("it refuses rather than reporting a short list", () => {
  it("refuses a package.json with no overrides — an empty read is not a clean reading", () => {
    expect(() =>
      readOverrideResolution(packageJson(undefined), lockfile(["left-pad@1.0.0"])),
    ).toThrow(/declares no `pnpm.overrides`/);
  });

  it("refuses an empty override block for the same reason", () => {
    expect(() =>
      readOverrideResolution(packageJson({}), lockfile(["left-pad@1.0.0"])),
    ).toThrow(/declares no `pnpm.overrides`/);
  });

  it("refuses an override declaring something that is not a range", () => {
    expect(() => readDeclaredOverrides(packageJson({ tar: 7 }))).toThrow(
      /is not a range/,
    );
  });

  it("refuses a package.json that is not JSON", () => {
    expect(() => readDeclaredOverrides("{ not json")).toThrow(
      /not readable JSON/,
    );
  });

  it.each(["packages", "snapshots"])(
    "refuses a lockfile with no `%s:` block",
    (section) => {
      const text = lockfile(["left-pad@1.0.0"]).replace(
        `${section}:`,
        "elsewhere:",
      );
      expect(() => resolvedVersions(text)).toThrow(
        new RegExp(`no \`${section}:\` block`),
      );
    },
  );

  it("refuses an EMPTY `packages:` block — the arm that stops nine dead overrides being invented", () => {
    const text = lockfileOf("", inline(["left-pad@1.0.0"]));
    expect(() => resolvedVersions(text)).toThrow(/`packages:` is empty/);
  });

  it("refuses an EMPTY `snapshots:` block for the same reason", () => {
    const text = lockfileOf(withBody(["left-pad@1.0.0"]), "");
    expect(() => resolvedVersions(text)).toThrow(/`snapshots:` is empty/);
  });

  it("refuses an entry key it cannot parse rather than skipping it", () => {
    const text = lockfile(["left-pad@1.0.0"]).replace(
      "  left-pad@1.0.0:",
      "  left-pad@1.0.0 no colon here",
    );
    expect(() => lockfileBlockKeys(text, "packages")).toThrow(/cannot parse/);
  });

  it("refuses an unterminated quoted key", () => {
    const text = lockfile(["'@scope/thing@1.0.0"]);
    expect(() => lockfileBlockKeys(text, "packages")).toThrow(
      /unterminated quoted key/,
    );
  });

  it("stops at the next top-level block rather than reading into it", () => {
    /* `snapshots:` entries must not be counted as `packages:` ones, or a
       lockfile with one empty block would read as populated. */
    const keys = lockfileBlockKeys(
      lockfile(["left-pad@1.0.0"], ["zeta@2.0.0"]),
      "packages",
    );
    expect(keys).toEqual(["left-pad@1.0.0"]);
  });
});

describe("the command — exit 0 on a finding, exit 1 only on a refusal", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "override-resolution-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function run(...args: string[]) {
    /* An `npx` that fails to start throws rather than reading as an exit code
       (#640), and this suite asserts exact codes, so a shell's 9009/127 fails
       loudly rather than passing as a refusal. */
    return runHook("npx", ["tsx", SCRIPT, ...args], {
      shell: process.platform === "win32",
    });
  }

  function fixture(name: string, contents: string): string {
    const path = join(dir, name);
    writeFileSync(path, contents, "utf8");
    return path;
  }

  it("exits 0 and NAMES the dead override — a finding is not a failure", () => {
    const pkg = fixture("dead.json", packageJson({ tar: "^7.5.18", "left-pad": "^1.0.0" }));
    const lock = fixture("dead.yaml", lockfile(["left-pad@1.0.0"]));
    const result = run("--package-json", pkg, "--lockfile", lock);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("GOVERNS NOTHING");
    expect(result.stdout).toContain("1 of 2 overrides govern no package");
    expect(result.stdout).toContain("tar");
  });

  it("exits 0 and says so when every override governs something", () => {
    const pkg = fixture("live.json", packageJson({ "left-pad": "^1.0.0" }));
    const lock = fixture("live.yaml", lockfile(["left-pad@1.0.0"]));
    const result = run("--package-json", pkg, "--lockfile", lock);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("GOVERNS NOTHING");
    expect(result.stdout).toContain("All 1 overrides govern a package in this tree");
  });

  it("exits 1 and names the artifact when it cannot answer", () => {
    const pkg = fixture("empty.json", packageJson({}));
    const lock = fixture("refuse.yaml", lockfile(["left-pad@1.0.0"]));
    const result = run("--package-json", pkg, "--lockfile", lock);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("override-resolution REFUSES");
    expect(result.stderr).toContain("pnpm.overrides");
  });

  it("exits 1 on a path it cannot read, naming it", () => {
    const result = run("--lockfile", join(dir, "no-such-lockfile.yaml"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no-such-lockfile.yaml");
  });

  it("refuses an unknown flag rather than ignoring it (#288)", () => {
    const result = run("--dry-run");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown flag "--dry-run"');
  });

  it("runs on the REAL tree with no flags and exits 0", () => {
    /* The road the Warden actually takes. It asserts the exit code and that
       the verdict line exists — never how many overrides are dead today, which
       is the finding #1815 leaves open. */
    const result = runHook("npx", ["tsx", SCRIPT], {
      cwd: ROOT,
      shell: process.platform === "win32",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PNPM OVERRIDE RESOLUTION");
    expect(result.stdout).toMatch(
      /overrides govern no package in this tree|overrides govern a package in this tree/,
    );
  });
});

describe("the real artifacts — the instrument proven where it will be run", () => {
  /* Read through `readListedSource` (#223) and asserted non-null rather than
     defaulted to "": an empty string would reach the reader and refuse with a
     message about a missing `packages:` block, which is a confusing red for a
     file that simply was not there. */
  const lockText = readListedSource(join(ROOT, "pnpm-lock.yaml"));
  const pkgText = readListedSource(join(ROOT, "package.json"));
  if (lockText === null || pkgText === null) {
    throw new Error("pnpm-lock.yaml or package.json is missing from the tree");
  }

  it("reads a real population out of both blocks, so a silent zero cannot pass", () => {
    const { packagesRead, snapshotsRead } = resolvedVersions(lockText);
    expect(packagesRead).toBeGreaterThan(500);
    expect(snapshotsRead).toBeGreaterThan(500);
  });

  it("finds a package the tree certainly HAS — the positive control", () => {
    /* `vitest` is running this assertion, so its absence from the lockfile
       would be a fact about the reader and nothing else. */
    const { versions } = resolvedVersions(lockText);
    expect(versions.has("vitest")).toBe(true);
  });

  it("finds a scoped package the tree certainly has, since the split differs for those", () => {
    const { versions } = resolvedVersions(lockText);
    expect(versions.has("@aws-sdk/client-s3")).toBe(true);
  });

  it("does NOT find a package the tree certainly lacks — the negative control", () => {
    const { versions } = resolvedVersions(lockText);
    expect(versions.has("drape-no-such-package-1815")).toBe(false);
  });

  it("classifies every declared override, reporting a subset of the names package.json declares", () => {
    /* Derived both ways rather than pinned to today's three: every row is a
       declared override, every dead name is one of the rows, and nothing is
       dropped on the way through. */
    const declared = Object.keys(readDeclaredOverrides(pkgText));
    const reading = readOverrideResolution(pkgText, lockText);
    expect(reading.rows.map((row) => row.name).sort()).toEqual([...declared].sort());
    for (const name of reading.dead) expect(declared).toContain(name);
  });
});
