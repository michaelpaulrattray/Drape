import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { referencesOf } from "../../../../server/castingV2/refineService";

/*
  `referencesOf` builds each chip's picture URL through `storagePublicUrl`,
  which reads the R2 config from an import-time ENV snapshot and throws when
  it is absent — so on an envless checkout (CI) the introduced-item case died
  in storage config before its assertion ran. The chip contract does not
  depend on WHICH bucket is configured — prime any absent R2 variable with an
  obvious test value (hoisted, so it lands before the ENV snapshot is taken)
  and leave a configured machine's real values untouched.
*/
vi.hoisted(() => {
  process.env.R2_ENDPOINT ||= "https://r2-unit-test.invalid";
  process.env.R2_BUCKET ||= "unit-test-bucket";
  process.env.R2_PUBLIC_URL ||= "https://pub-test.r2.dev";
  process.env.R2_ACCESS_KEY_ID ||= "unit-test-access-key";
  process.env.R2_SECRET_ACCESS_KEY ||= "unit-test-secret";
});

/**
 * THE "USE" CHIP — what it shows, and what pressing it actually resubmits.
 *
 * FOUNDER RULING, verbatim (fable-1419 §2):
 *
 * > *"the only reference that go into that box are ones you use to generate the
 * > previous image with e.g i upload a reference on the previous image and say
 * > copy her hair that would ride in this box not her horns. that way when i
 * > press use im essentially regenerating the exact same prompt + reference
 * > image i used to generate this image so then i regenerate it again"*
 *
 * The chip used to show EVERY reference the render carried — her master, and
 * the carry crop of the horns she asked for four renders ago. Those are
 * MACHINERY. She did not attach them, they are not part of her ask, and listing
 * them turns *replay my ask* into a list of our internals.
 *
 * **BOTH HALVES OF HIS SENTENCE ARE BUILT** (ordered fable-1421 §2). *Use*
 * carries the prompt AND the picture: the row records the attach HANDLE the ask
 * travelled with — never a url, because the address of a customer photograph
 * stays server-side — and pressing Use fills the box and re-attaches it, marked
 * CLAIMED so she is not asked again where a picture she answered for two
 * renders ago came from.
 *
 * ⚠ This docblock said *"the second half is not built"* for the length of one
 * chunk, which is how long it was true. It is corrected here rather than left,
 * because a test file describing a capability as absent is the inert-control
 * failure with its sign flipped — it sends the next reader hunting a door that
 * is already open.
 *
 * A handle purged with its Cast is refused FREE on send, in the server's own
 * sentence, which is the honest answer to a replay that can no longer be whole.
 */
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);

/** The code with its prose removed — a comment quoting a rule must not be
 *  mistaken for the rule being kept. */
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("what the chip shows", () => {
  const HANDLE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const recipe = (kinds: { key: string; kind: string; slot: string | null }[]) => ({
    askReference: HANDLE,
    repaint: { references: kinds.map((one) => ({ ...one, digest: "d", sentGeometry: "1x1" })) },
  });

  it("shows the picture she attached and NOT the machinery beside it", () => {
    const projected = referencesOf(recipe([
      { key: "casting-v2/candidates/master.png", kind: "master", slot: null },
      { key: "casting-v2/library/horns.png", kind: "carry", slot: "open:horns" },
      { key: "casting-v2/reference-attachments/hers.png", kind: "source", slot: "hair" },
    ]));
    expect(projected.map((one) => one.slot)).toEqual(["hair"]);
    /* His own example, both halves: the hair reference he uploaded rides in the
       box, and the horns do not. */
    expect(JSON.stringify(projected)).not.toContain("horns");
    expect(JSON.stringify(projected)).not.toContain("master");
    /* And her picture's address is the authenticated route, never the public
       bucket — a photograph of a person is never at a public address. */
    expect(projected[0]!.url).toBe(`/api/reference/${HANDLE}`);
  });

  it("shows nothing at all on a render she attached nothing to", () => {
    /* Almost every render. The honest chip is the sentence with no thumbnails,
       never a row of pictures she has no memory of choosing. */
    expect(referencesOf(recipe([
      { key: "casting-v2/candidates/master.png", kind: "master", slot: null },
    ]))).toEqual([]);
  });
});

describe("what pressing Use actually does", () => {
  it("⚠ CARRIES THE SENTENCE AND THE PICTURE — his own words for the button", async () => {
    /*
      *"regenerating the exact same prompt + reference image i used to generate
      this image"* (fable-1419 §2, ordered fable-1421 §2). It used to carry the
      sentence alone, which made the thumbnails beside it a promise the button
      did not keep.

      The handle is the ROW's own, so what comes back is the picture THAT ask
      carried and never a neighbouring version's.
    */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    const use = panel.slice(panel.indexOf("dpc-refine__madeUse"), panel.indexOf("dpc-refine__madeUse") + 700);
    expect(use).toContain("setInstruction(selectedRequest)");
    expect(use).toContain("selectedAskReferenceId");
    expect(use).toContain("setPicture(");
  });

  it("⚠ PREFILLS AND NEVER SPENDS — the money still moves on her press, not ours", async () => {
    /*
      Re-attaching is not sending. Spending her credits is a deliberate act and
      stays one: Use fills the box and attaches, she presses Refine, and the
      duplicate warning fires exactly as it does for anything typed by hand.
    */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    const use = panel.slice(panel.indexOf("dpc-refine__madeUse"), panel.indexOf("dpc-refine__madeUse") + 700);
    expect(use).not.toContain("onRefine(");
  });

  it("marks the replayed picture CLAIMED, so it does not re-ask where it came from", async () => {
    /*
      `pictureUnclaimed` is `referenceId === null`, and it both blocks the send
      and opens the provenance question. A replay carries a handle the door has
      already taken, so neither may fire — being asked again where a picture
      came from, about a picture she answered for two renders ago, is the
      product forgetting in front of her.
    */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    const use = panel.slice(panel.indexOf("dpc-refine__madeUse"), panel.indexOf("dpc-refine__madeUse") + 700);
    expect(use).toContain("referenceId: selectedAskReferenceId");
    /* And the empty base64 is deliberate: `claimPicture` is the path for a
       picture the door has NOT taken, and this one it has. */
    expect(use).toContain('imageBase64: ""');
  });

  it("brings nothing back for a version that carried no picture", async () => {
    /* Almost every version. A Use that attached a neighbouring row's photograph
       because this one had none would be worse than one that attaches nothing. */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    const use = panel.slice(panel.indexOf("dpc-refine__madeUse"), panel.indexOf("dpc-refine__madeUse") + 700);
    expect(use).toContain("if (!selectedAskReferenceId || !supplied) return;");
  });

  it("CONTROL — the panel really does know how to attach a picture", async () => {
    /* Without this, the assertions above could pass on a file with no attach
       machinery at all, which would prove nothing about Use. */
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toContain("claimPicture");
    expect(panel).toContain("pictureUnclaimed");
  });
});

/*
  AND THE PICTURE OF AN ITEM SHE INTRODUCED — shown on the ask that applied it,
  and nowhere else (fable-1421 §1).
*/
describe("an introduced item's own picture", () => {
  const withAnchor = (edited: string[]) => ({
    repaint: {
      edited,
      references: [
        { key: "casting-v2/candidates/master.png", kind: "master", slot: null, digest: "d" },
        { key: "casting-v2/ink-designs/hers.png", kind: "anchor", slot: "ink:neck", digest: "d" },
      ],
    },
  });

  it("IS in the chip on the ask that introduced it", () => {
    const projected = referencesOf(withAnchor(["ink:neck"]));
    expect(projected.map((one) => one.slot)).toEqual(["ink:neck"]);
    expect(projected[0]!.kind).toBe("anchor");
  });

  it("is NOT in the chip on a later render that merely re-rode it", () => {
    /* She did not hand it over on that ask. The design is frozen and rides
       every later render of the item — machinery, by then. */
    expect(referencesOf(withAnchor(["hair"]))).toEqual([]);
    expect(referencesOf(withAnchor([]))).toEqual([]);
  });
});
