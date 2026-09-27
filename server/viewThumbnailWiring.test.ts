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

/**
 * AND THE PICTURE ITSELF IS ONE COMPONENT WITH FOUR CONSUMERS (#1447).
 *
 * The ask-and-fall-back was `ThumbnailImage`, private to the strip. #1447 found
 * the same defect one door earlier — the casting home grid drawing every cast
 * card from the full-size front picture — so it is `SmallCopyImage` in the
 * foundation and four surfaces import it back.
 *
 * ⚠ **Each consumer is named rather than derived, and that is a FLOOR.** A
 * fifth surface added tomorrow with a bare `<img src={anchorUrl}>` is invisible
 * to this file, which is why the ARMS below are about the component being the
 * only implementation: the derived half — no second copy of the suffix anywhere
 * in the client — is what makes a hand-rolled rival cost something.
 */
describe("the small copy's picture has exactly one implementation", () => {
  const source = read("client/src/foundation/SmallCopyImage.tsx");

  it("derives the URL with the shared function and never a literal suffix", () => {
    expect(source).toContain("viewSmallCopyUrl(fullSrc)");
    expect(source).toContain('from "@shared/viewThumbnails"');
    /*
      A hand-typed suffix anywhere in the client is the mirror this whole module
      was shaped to avoid — it has exactly one home, in `shared/`.
    */
    expect(source).not.toContain(".thumb.jpg");
  });

  it("falls back to the full picture, because every cast signed before #1389 has no small copy", () => {
    expect(source).toContain("onError={() => setSrc(fullSrc)}");
  });

  /*
    ⚠ The predicate is what lets the modal shell use this for a concept upload's
    local preview and an unsigned candidate's frame as well as a cast's anchor.
    Without it those two would ask for an object that cannot exist and pay a 404
    per open to find out — and the tempting "just append it" version passes every
    other arm in this file.
  */
  it("asks the shared predicate about the URL rather than appending unconditionally", () => {
    const shared = read("shared/viewThumbnails.ts");
    const resolver = shared.slice(shared.indexOf("export function viewSmallCopyUrl("));
    expect(resolver).toContain("namesAViewObject(url)");
    expect(shared).toContain("isViewThumbnailBearingKey(path)");
  });
});

describe("every surface that draws a cast's stored picture at tile size asks for the small copy", () => {
  /*
    #1447's own population, read at the code: the strip, the roster card, the
    rename dialog's 46x58 thumb and the modal shell's portrait. The last two are
    here for a reason worth keeping — they were FREE before this change, because
    the roster card behind them had already downloaded that exact URL. Moving
    the card alone would have made both of them pull a fresh full-size file.

    Deliberately NOT on this list, each verified at the code rather than assumed:
    the hero deck (static bundled `.webp`, never an R2 object —
    `client/src/features/castingV2/heroDeck.ts`), the sheet card's candidate
    strip (a candidate frame, outside the views prefix, so no derivative was
    ever minted — the thumbnail worker is deferred scope §G.6) and the room's
    master and companion cells, which are the viewer and are drawn large.
  */
  const consumers = [
    ["the signed cast's strip", "client/src/features/casting/components/ImageViewer/ViewTabs.tsx"],
    ["the casting home grid's cast card", "client/src/pages/CastingV2.tsx"],
    ["the rename dialog's thumb", "client/src/foundation/RenameDialog.tsx"],
    ["the modal shell's portrait", "client/src/foundation/CastingModal.tsx"],
  ] as const;

  for (const [who, file] of consumers) {
    it(`${who} draws through the component`, () => {
      const source = read(file);
      expect(source).toContain("<SmallCopyImage");
      expect(source).toContain("SmallCopyImage");
    });
  }

  it("and none of them hands the stored URL straight to an img element", () => {
    /*
      The bare element is what each of these was before, and it is the shape
      that would come back. `alt=""` on a decorative picture is not the tell —
      the tell is `src` carrying the stored URL.
    */
    const bare = [
      ["ViewTabs.tsx", "client/src/features/casting/components/ImageViewer/ViewTabs.tsx", /<img\s+src=\{src\}/],
      ["CastingV2.tsx", "client/src/pages/CastingV2.tsx", /<img src=\{cast\.imageUrl\}/],
      ["RenameDialog.tsx", "client/src/foundation/RenameDialog.tsx", /<img src=\{imageUrl\}/],
      ["CastingModal.tsx", "client/src/foundation/CastingModal.tsx", /<img src=\{portrait\}/],
    ] as const;
    for (const [who, file, shape] of bare) {
      expect(read(file), `${who} is back on the full picture`).not.toMatch(shape);
    }
  });

  /*
    ⚠ Load-bearing, and the reason it is an arm rather than a comment: `useState`
    initialised from a prop does not re-read it. Without the remount, a picture
    that fell back once stays fallen back after a refresh mints a brand-new
    object that HAS a small copy — permanently, and invisibly. The strip's URL
    changes on a Try again; the roster card's changes when a different cast takes
    that position in the grid.
  */
  it("remounts on the URL where the URL can change, so a fallback is not permanent", () => {
    const strip = read("client/src/features/casting/components/ImageViewer/ViewTabs.tsx");
    expect(strip).toContain("key={src}");
    expect(strip).toContain("fullSrc={src}");
    const grid = read("client/src/pages/CastingV2.tsx");
    expect(grid).toContain("key={cast.imageUrl}");
    expect(grid).toContain("fullSrc={cast.imageUrl}");
  });
});
