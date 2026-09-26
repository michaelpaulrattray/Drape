/**
 * THE SMALL COPY IS ACTUALLY ASKED FOR, AND ACTUALLY MADE (#1389).
 *
 * ⚠ **This holds the WIRE, not the behaviour, and says so rather than letting
 * the green be read as more than it is.** `server/viewThumbnails.test.ts` drives
 * the mint and `server/storageThumbnailSweep.test.ts` drives the sweep, both
 * against real functions. Neither can see whether anything CALLS them — and a
 * control that is not invoked does not exist (invariant 7), which is the exact
 * shape this repository has shipped four times on one feature.
 *
 * Two wires, and each would fail silently:
 *
 *  - **The mint.** `defaultStoreImage` is the one place a signed view's bytes
 *    reach storage. It is a module-private default behind an injectable
 *    `storeImage` dependency, so every suite that exercises the orchestrator
 *    replaces it — deleting the mint call would turn no test red anywhere.
 *  - **The strip.** Handing the full-size URL back to the tile is invisible to
 *    every check in this repository: it typechecks, it renders, and the only
 *    symptom is 19 MB per picture. This repository has no jsdom, so a source
 *    reading is what a client guard is here.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(__dirname, "..");

function read(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("the mint is wired into the one place a view's bytes are stored", () => {
  const source = read("server/castingV2/packageOrchestrator.ts");
  const storeImage = source.slice(
    source.indexOf("async function defaultStoreImage("),
    source.indexOf("async function defaultStoreImage(") + 2_000,
  );

  it("finds defaultStoreImage at all, so a rename cannot make this arm vacuous", () => {
    expect(source).toContain("async function defaultStoreImage(");
    expect(storeImage).toContain("storagePut(");
  });

  it("mints the small copy there, with the key storagePut actually returned", () => {
    expect(storeImage).toContain("mintViewThumbnail(stored.key, input.bytes)");
  });

  it("imports it from the module that owns it", () => {
    expect(source).toContain('from "./viewThumbnailMint"');
  });
});

describe("the anchor's mint is wired into Sign", () => {
  const source = read("server/castingV2/signService.ts");

  /*
    The headshot is a COPY, not a render, so it never passes the orchestrator's
    chokepoint. It is minted from the bytes `storageCopyExact` has already read
    back to prove the copy exact — no second read of a 19 MB object on a paid
    path, which is why the callback exists at all.
  */
  it("mints from the bytes the copy already verified, rather than reading again", () => {
    expect(source).toContain("onVerifiedBytes: (bytes) => mintViewThumbnail(destinationKey, bytes)");
    expect(source).toContain('from "./viewThumbnailMint"');
    expect(source).not.toContain("storageReadBytes(destinationKey)");
  });

  it("offers those bytes only after verification, and cannot fail the copy", () => {
    const storage = read("server/storage.ts");
    const copy = storage.slice(storage.indexOf("export async function storageCopyExact("));
    const verification = copy.indexOf("Storage copy verification failed");
    const offer = copy.indexOf("input.onVerifiedBytes(destination.bytes)");
    expect(verification).toBeGreaterThan(-1);
    expect(offer).toBeGreaterThan(verification);
    expect(copy.slice(offer, offer + 200)).toContain(".catch(");
  });
});

describe("the sweep is wired into the one exported deletion primitive", () => {
  const source = read("server/storage.ts");

  it("asks the shared predicate rather than testing the suffix by hand", () => {
    expect(source).toContain("isViewThumbnailBearingKey(key)");
    expect(source).toContain("withViewThumbnailSuffix(key)");
    expect(source).toContain('from "../shared/viewThumbnails"');
  });
});

describe("the strip asks for the small copy", () => {
  const source = read(
    "client/src/features/casting/components/ImageViewer/ViewTabs.tsx",
  );

  it("derives the URL with the shared function and never a literal suffix", () => {
    expect(source).toContain("withViewThumbnailSuffix(fullSrc)");
    expect(source).toContain("from '@shared/viewThumbnails'");
    /*
      A hand-typed ".thumb.jpg" anywhere in the client is the mirror this whole
      module was shaped to avoid — the suffix has exactly one home.
    */
    expect(source).not.toContain(".thumb.jpg");
  });

  it("falls back to the full picture, because every cast signed before this has no small copy", () => {
    expect(source).toContain("onError={() => setSrc(fullSrc)}");
  });

  /*
    ⚠ Load-bearing, and the reason it is an arm rather than a comment: `useState`
    initialised from a prop does not re-read it. Without the remount, a tile that
    fell back once stays fallen back after a refresh mints a brand-new object
    that HAS a small copy — permanently, and invisibly.
  */
  it("remounts the tile when its URL changes, so a fallback is not permanent", () => {
    expect(source).toContain("key={src}");
    expect(source).toContain("fullSrc={src}");
  });

  it("no longer hands the stored URL straight to an img element", () => {
    const strip = source.slice(source.indexOf("function ViewThumbnail("));
    expect(strip).not.toMatch(/<img\s+src=\{src\}/);
  });
});
