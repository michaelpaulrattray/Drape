/**
 * #1961 — a wardrobe scratch upload is REGISTERED BEFORE IT EXISTS.
 *
 * The card's done-when: *"Every `storagePut` on these two routes has its key
 * in a manifest or is deleted when the request ends, and a driven arm proves
 * the key is registered before the write."*
 *
 * ⚠ **"BEFORE" IS THE WHOLE CLAIM, so these arms assert an ORDER and not two
 * calls having happened.** A suite that checked only *the manifest was written*
 * and *the bytes were stored* would pass on the exact bug: bytes first, a
 * manifest after, and a crash in between leaving an object nothing names. The
 * recorder below writes one sequence and the arms read it.
 *
 * ⚠ **AND THE REFUSAL IS THE OTHER HALF.** Migration 0074 adds the enum value
 * this manifest's `kind` needs, and `MODIFY COLUMN` is a WAITING ceremony that
 * does not block a deploy (`scripts/lib/predeployVerdict.mts`) — so there is a
 * real window in which the registration fails. What must happen then is that
 * the upload does not happen either, which is invariant 7's second clause. An
 * arm drives it.
 */
import { describe, expect, it } from "vitest";

import {
  putWardrobeScratchUpload,
  type ScratchUploadDeps,
} from "./scratchUpload";

function recorder(options: { registerThrows?: boolean; putThrows?: boolean } = {}) {
  const order: string[] = [];
  const registered: Array<{ id: string; userId: number; storageKey: string; operationId: string }> = [];
  const stored: Array<{ key: string; bytes: Buffer; contentType: string }> = [];

  const deps: ScratchUploadDeps = {
    registerManifest: async (input) => {
      order.push(`register:${input.storageKey}`);
      if (options.registerThrows) throw new Error("Data truncated for column 'kind'");
      registered.push(input);
    },
    put: async (key, bytes, contentType) => {
      order.push(`put:${key}`);
      if (options.putThrows) throw new Error("bucket unreachable");
      stored.push({ key, bytes, contentType });
      return { url: `https://pub.example.com/${key}` };
    },
  };

  return { deps, order, registered, stored };
}

const UPLOAD = {
  userId: 42,
  key: "42-wardrobe/scan-1762500000000-abc.png",
  bytes: Buffer.from("not really a png"),
  contentType: "image/png",
};

describe("#1961 — the manifest is written before the bytes, never after", () => {
  it("registers the key, then stores it, in that order", async () => {
    const { deps, order, registered, stored } = recorder();

    const result = await putWardrobeScratchUpload(UPLOAD, deps);

    expect(
      order,
      "the bytes were stored before anything named the key — a crash in between leaves an object no cleanup can reach",
    ).toEqual([`register:${UPLOAD.key}`, `put:${UPLOAD.key}`]);

    expect(registered).toHaveLength(1);
    expect(registered[0]!.storageKey).toBe(UPLOAD.key);
    expect(registered[0]!.userId).toBe(UPLOAD.userId);
    expect(stored[0]!.bytes).toBe(UPLOAD.bytes);
    expect(stored[0]!.contentType).toBe("image/png");
    expect(result.url).toBe(`https://pub.example.com/${UPLOAD.key}`);
    expect(result.key).toBe(UPLOAD.key);
  });

  it("the manifest the caller is handed back is the one that was written", async () => {
    const { deps, registered } = recorder();
    const result = await putWardrobeScratchUpload(UPLOAD, deps);
    expect(result.cleanupBatchId).toBe(registered[0]!.id);
    /* The batch id doubles as the synthetic operation id: there is no
       generation operation behind a free detector read, and the batch table's
       unique index on `operationId` is what keeps two scratch uploads apart. */
    expect(registered[0]!.operationId).toBe(result.cleanupBatchId);
  });

  it("two uploads in one request take two manifests, not one", async () => {
    const { deps, registered } = recorder();
    const a = await putWardrobeScratchUpload({ ...UPLOAD, key: "42-wardrobe/decomposed/a.png" }, deps);
    const b = await putWardrobeScratchUpload({ ...UPLOAD, key: "42-wardrobe/decomposed/b.png" }, deps);
    expect(a.cleanupBatchId).not.toBe(b.cleanupBatchId);
    expect(registered.map((row) => row.storageKey)).toEqual([
      "42-wardrobe/decomposed/a.png",
      "42-wardrobe/decomposed/b.png",
    ]);
  });
});

describe("#1961 — a registration that fails refuses the write", () => {
  it("stores nothing when the manifest cannot be written", async () => {
    const { deps, order, stored } = recorder({ registerThrows: true });

    await expect(putWardrobeScratchUpload(UPLOAD, deps)).rejects.toThrow();

    expect(
      stored,
      "the bytes were written anyway, which is the unregistered object this card exists to end",
    ).toHaveLength(0);
    expect(order).toEqual([`register:${UPLOAD.key}`]);
  });

  it("a storage failure leaves the manifest standing, and the worker collects it", async () => {
    const { deps, registered } = recorder({ putThrows: true });

    await expect(putWardrobeScratchUpload(UPLOAD, deps)).rejects.toThrow();

    /*
      The asymmetry is deliberate and is the register-before-write bargain: a
      manifest naming bytes that never landed costs one wasted delete, and the
      worker already handles a key that is not there. Bytes naming no manifest
      cost the object forever.
    */
    expect(registered).toHaveLength(1);
  });
});

/* ==========================================================================
   THE CLASS, NOT THE INSTANCE (working law 7)
   ========================================================================== */

/**
 * The card named TWO routes. The sweep found FOUR writes of the same shape —
 * `garments.quickDetect`, `decompose.analyze`, `model.upload` and the per-garment
 * crops inside `decomposeOutfit` — so the fix is a rule rather than three edits,
 * and this is the rule.
 *
 * ⚠ **IT IS AN ALLOWLIST OF DIRECT `storagePut` CALLS, WITH THE ROW THAT NAMES
 * EACH KEY AND HOW MANY ARE EXPECTED.** A blanket ban would be wrong, because
 * some of these writes ARE recorded and must stay direct.
 *
 * ⚠ **THE COUNT IS LOAD-BEARING AND A SABOTAGE IS WHY IT IS THERE.** The first
 * shape of this arm allowed a FILE, so restoring the exact defect — a second,
 * unregistered `storagePut` back inside `server/routes/wardrobe.ts` — left it
 * GREEN, satisfied by the allowed sibling three hundred lines away. That is the
 * memory's `guard-arm-satisfied-by-a-sibling` class, met here while writing the
 * guard for it. The number is per file and exact in both directions: a write
 * removed reddens too, which is the prompt to come and delete its reason.
 *
 * The population is derived from the tree, not typed: every non-test `.ts`
 * under `server/wardrobe/` plus the feature's router.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { readListedSource } from "../testing/listedSource";
import { withoutComments } from "../testing/withoutComments";

const REPO_ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/**
 * Where a direct `storagePut` is still correct, and why. Each of these writes
 * a key that a ROW holds, so a cleanup can always reach it.
 */
const RECORDED_DIRECT_WRITES: ReadonlyArray<{ file: string; calls: number; why: string }> = [
  {
    file: "server/routes/wardrobe.ts",
    calls: 1,
    why:
      "`garments.upload` — the only wardrobe write whose key is persisted:"
      + " `createGarment({ originalImageKey: fileKey })` two statements later,"
      + " so the object is reachable from the garment row that owns it",
  },
  {
    file: "server/wardrobe/utils.ts",
    calls: 1,
    why:
      "`uploadBase64ToS3` — the digitize and refine results, each returned to a"
      + " caller that writes the URL onto a garment row (`isolatedImageUrl`) or a"
      + " session's history before the request ends; they are deliverables, not"
      + " scratch. ⚠ ONE OF ITS CALLERS IS CONDITIONAL and is NOT fixed by this"
      + " card: `vto.generate` pushes its result onto `wardrobeSessions.history`"
      + " ONLY when the request carries a `sessionId`, so a VTO with none writes"
      + " an object nothing names — the same class, on a road `assertWardrobeTryOnOpen`"
      + " closes today (#1537), filed rather than widened into this diff",
  },
  {
    file: "server/wardrobe/scratchUpload.ts",
    calls: 1,
    why:
      "the registrar itself — the one direct write in the feature that is"
      + " preceded by the manifest naming its key, which is the rule every other"
      + " scratch write now goes through",
  },
];

function wardrobeSourceFiles(): string[] {
  const roots = [join(REPO_ROOT, "server", "wardrobe")];
  const found = [join(REPO_ROOT, "server", "routes", "wardrobe.ts")];
  while (roots.length > 0) {
    const dir = roots.pop()!;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) {
        roots.push(full);
        continue;
      }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      found.push(full);
    }
  }
  return found;
}

describe("#1961 — no wardrobe write puts bytes to a public key nothing names", () => {
  it("every direct storagePut in the feature is one of the recorded ones", () => {
    const files = wardrobeSourceFiles();
    /* THE FLOOR (law 2): a walk that found nothing reports nothing, which is
       byte-identical to a clean tree. */
    expect(files.length, "the walk is pointed at the wrong place").toBeGreaterThan(5);

    const measured = new Map<string, number>();
    let callsSeen = 0;

    for (const file of files) {
      const source = readListedSource(file);
      if (source === null) continue;
      const code = withoutComments(source);
      const calls = code.split("storagePut(").length - 1;
      if (calls === 0) continue;
      callsSeen += calls;
      measured.set(relative(REPO_ROOT, file).split(sep).join("/"), calls);
    }

    expect(callsSeen, "no storagePut call was found at all — the reader is blind").toBeGreaterThan(0);
    expect(
      Object.fromEntries([...measured].sort()),
      "a wardrobe module writes to the public bucket directly, or has stopped. Either a row"
        + " holds that key — add it to RECORDED_DIRECT_WRITES with the row that holds it and"
        + " the count — or it is scratch and goes through `putWardrobeScratchUpload`, which"
        + " registers it first (#1961).",
    ).toEqual(
      Object.fromEntries(
        RECORDED_DIRECT_WRITES.map((row) => [row.file, row.calls] as const).sort(),
      ),
    );
  });

  it("each recorded exception says which row holds its key", () => {
    for (const row of RECORDED_DIRECT_WRITES) {
      expect(row.why.length, `${row.file} must say why`).toBeGreaterThan(40);
    }
  });
});
