import { describe, expect, it, vi } from "vitest";
import { HOUSE_WARDROBE_LINE } from "./wardrobeLine";

vi.mock("../storage", () => ({
  storagePublicUrl: (key: string) => `https://public.example/${key}`,
}));

const { projectCandidate, projectCandidateStatus, projectRoll, readChips } = await import(
  "./rollProjection"
);

/**
 * Projection boundary (plan §J, access-control invariant 8).
 *
 * The test that matters most here is the negative one. A projection is only a
 * boundary if the fields on the wrong side of it are *provably* absent — and
 * "I wrote the DTO carefully" is not proof, because the failure mode is
 * somebody later adding a field to the row and the projection inheriting it.
 */

/**
 * A candidate row as the DB layer now hands it over — with its face resolved.
 *
 * The face defaults to the candidate's own image, which is the unrefined case
 * and the one every assertion here was written against. A test that wants a
 * refined face overrides `faceImageKey` / `selectedVariantPublicId`.
 */
function candidateRow(overrides: Record<string, unknown> = {}) {
  const imageKey = (overrides.imageKey as string | null | undefined) ?? "casting-v2/candidates/abc.png";
  const thumbKey = (overrides.thumbKey as string | null | undefined) ?? null;
  return {
    selectedVariantId: null,
    selectedVariantPublicId: null,
    faceImageKey: imageKey,
    faceThumbKey: thumbKey,
    id: 1,
    publicId: "cand-1",
    rollId: 1,
    sessionId: 1,
    userId: 7,
    position: 3,
    status: "ready",
    pointsCost: 20,
    imageKey: "casting-v2/candidates/abc.png",
    thumbKey: null,
    provider: "fal",
    providerModel: "openai/gpt-image-2",
    providerRef: "req-9",
    personaLine: "Warm, unhurried",
    internalPrompt: { prompt: "the compiled instruction" },
    keptAt: null,
    discardedAt: null,
    attemptCount: 1,
    failureClass: null,
    signedCastId: null,
    createdAt: new Date("2026-07-31T00:00:00.000Z"),
    expiresAt: null,
    ...overrides,
  } as never;
}

function rollRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId: "roll-1",
    sessionId: 1,
    userId: 7,
    rollIndex: 2,
    briefText: "a wiry cyclist in her 20s",
    compiledBrief: {
      compiler: "deterministic-v1",
      framingBlock: "internal framing text",
      chips: [{ label: "a wiry cyclist in her 20s", kind: "subject", removable: false }],
    },
    cohortKey: "photoreal_human",
    styleKey: null,
    styleProfile: null,
    lockContract: { sex: "female" },
    parentRollId: null,
    parentCandidateId: null,
    status: "complete",
    priceCredits: 160,
    operationId: "66666666-6666-4666-8666-666666666666",
    createdAt: new Date("2026-07-31T00:00:00.000Z"),
    ...overrides,
  } as never;
}

describe("nothing internal crosses the boundary", () => {
  it("omits provider identity, prompts and storage keys from a candidate", () => {
    const projected = JSON.stringify(projectCandidate(candidateRow()));
    // Quoted, so the assertion is about a JSON value and not about "fal"
    // happening to live inside the word "false".
    for (const secret of ['"fal"', "gpt-image-2", "req-9", "internalPrompt", "compiled instruction"]) {
      expect(projected, secret).not.toContain(secret);
    }
    // The image is reachable, but as a URL built from the key — the key
    // itself, which is what a deletion path keys on, never leaves.
    expect(JSON.parse(projected).imageUrl).toContain("casting-v2/candidates/abc.png");
  });

  it("omits the compiled brief and lock contract from a roll", () => {
    const projected = JSON.stringify(
      projectRoll({ roll: rollRow(), candidates: [candidateRow()] }),
    );
    for (const secret of ["deterministic-v1", "internal framing text", "lockContract", "operationId"]) {
      expect(projected, secret).not.toContain(secret);
    }
    // The user's own sentence comes back, because it is theirs.
    expect(JSON.parse(projected).briefText).toBe("a wiry cyclist in her 20s");
  });

  it("reads chips through a validator rather than forwarding them", () => {
    // The compiled brief will one day be written by an LLM behind the compiler
    // seam. A projection that forwarded whatever it found there would be an
    // injection path straight to the client.
    const chips = readChips({
      chips: [
        { label: "ok", kind: "subject", removable: true },
        { label: "bad kind", kind: "javascript:", removable: true },
        { label: 42, kind: "subject", removable: true },
        { kind: "subject", removable: true },
        { label: "x".repeat(500), kind: "style", removable: false },
      ],
    });
    expect(chips.map((chip) => chip.label)).toEqual(["ok", "x".repeat(60)]);
    expect(readChips(null)).toEqual([]);
    expect(readChips({ chips: "not an array" })).toEqual([]);
  });
});

describe("lifecycle states collapse to the three the client knows", () => {
  it("maps in-flight states to casting and delivered ones to ready", () => {
    expect(projectCandidateStatus("queued")).toBe("casting");
    expect(projectCandidateStatus("dispatched")).toBe("casting");
    expect(projectCandidateStatus("ready")).toBe("ready");
  });

  it("gives a signed candidate its own state, because collapsing it lost a Cast", () => {
    /*
      `signed` used to collapse into `ready`, and the cost was concrete: the
      founder signed a candidate for 450 credits, left her room, and could not
      find her again — the tile looked like every other ready candidate and
      offered to sign her a second time.

      A permanent purchase is reachable from the place it was made.
    */
    expect(projectCandidateStatus("signed")).toBe("signed");
  });

  it("labels failed and cancelled as refunded, because they were", () => {
    expect(projectCandidateStatus("failed")).toBe("failed-refunded");
    expect(projectCandidateStatus("cancelled")).toBe("failed-refunded");
  });

  it("keeps the expired TILE and suppresses its IMAGE, which is what makes refunding it safe", () => {
    /*
      REWRITTEN, deliberately. This asserted that an expired candidate is not
      projected at all — and the constraint it was protecting is about the
      IMAGE, not the tile. Returning null enforced it by removing both.

      The founder found what that costs: cancel a roll whose eight were already
      dispatched, every candidate lands and expires, and the sheet empties out
      completely — a blank page where eight faces had been, with no account of
      what happened to them.

      The rule that actually matters is unchanged and is now asserted directly:
      no image URL ever reaches a refunded candidate, so cancelling can never
      become a way to buy images for nothing.
    */
    expect(projectCandidateStatus("expired")).toBe("failed-refunded");
    // `discarded` still vanishes: the user removed it, and it is gone.
    expect(projectCandidateStatus("discarded")).toBeNull();

    const projected = projectRoll({
      roll: rollRow({ status: "cancelled" }),
      candidates: [
        candidateRow({ status: "expired", imageKey: "real/key.png", thumbKey: "real/thumb.png" }),
        candidateRow({ status: "discarded" }),
      ],
    });

    // The sheet still accounts for the candidate the user paid for.
    expect(projected.candidates).toHaveLength(1);
    expect(projected.candidates[0].status).toBe("failed-refunded");
    // And it carries no way to see it, even though the object exists in R2.
    expect(projected.candidates[0].imageUrl).toBeNull();
    expect(projected.candidates[0].thumbUrl).toBeNull();
    expect(projected.status).toBe("cancelled");
  });

  it("suppresses the image on every refunded candidate, not only expired ones", () => {
    // Enforced at the projection so no future caller can reintroduce the leak
    // by rendering a field it happened to find on the object.
    for (const status of ["failed", "cancelled", "expired"] as const) {
      const projected = projectRoll({
        roll: rollRow({ status: "cancelled" }),
        candidates: [candidateRow({ status, imageKey: "real/key.png", thumbKey: "real/thumb.png" })],
      });
      expect(projected.candidates[0].imageUrl, status).toBeNull();
      expect(projected.candidates[0].thumbUrl, status).toBeNull();
    }
  });

  it("labels positions for display without keying anything by them", () => {
    expect(projectCandidate(candidateRow({ position: 0 }))?.indexLabel).toBe("01");
    expect(projectCandidate(candidateRow({ position: 7 }))?.indexLabel).toBe("08");
  });
});

describe("lineage", () => {
  it("carries the parent as public ids, never the internal ones", () => {
    /*
      `now` IS PINNED HERE, and not for tidiness.

      The assertions below search the serialized projection for two internal
      ids as SUBSTRINGS, and the projection now carries `ageMs` — a
      free-running number, ten digits wide against this fixture's 2026-07-31
      birth. `41` appears inside it about as often as not: the arm passed all
      morning and failed the moment the field landed, which is a coin flip
      wearing a green tick either way. Pinned to the row's own moment, `ageMs`
      is 0 and the search is a reading again.
    */
    const projected = projectRoll({
      roll: rollRow({ parentRollId: 41, parentCandidateId: 907 }),
      candidates: [candidateRow()],
      parentRollPublicId: "roll-parent",
      parentCandidatePublicId: "cand-parent",
      now: new Date("2026-07-31T00:00:00.000Z"),
    });

    expect(projected.lineage).toEqual({
      fromRollId: "roll-parent",
      fromCandidateId: "cand-parent",
    });
    expect(projected.ageMs, "a live duration would make the search below a coin flip").toBe(0);
    // The numeric ids are internal and must not appear anywhere (§J).
    expect(JSON.stringify(projected)).not.toContain("907");
    expect(JSON.stringify(projected)).not.toContain("41");
  });

  it("still names the parent roll when the parent candidate has been purged", () => {
    /*
      A discarded candidate past its 24h floor is purgeable once it is no
      longer the active roll's (§G.6), while its roll lives as long as the
      session. So "I came from roll 04" outlives "I came from that face" — and
      the pill keys on the roll for exactly this reason.
    */
    const projected = projectRoll({
      roll: rollRow({ parentRollId: 41, parentCandidateId: 907 }),
      candidates: [candidateRow()],
      parentRollPublicId: "roll-parent",
      parentCandidatePublicId: null,
    });

    expect(projected.lineage.fromRollId).toBe("roll-parent");
    expect(projected.lineage.fromCandidateId).toBeUndefined();
  });

  it("is empty for a roll that followed nothing", () => {
    const projected = projectRoll({ roll: rollRow(), candidates: [candidateRow()] });
    expect(projected.lineage).toEqual({});
  });
});

/**
 * THE JOINT, not the two halves.
 *
 * Both ends of these two facts were already tested — the compiler writes
 * `interpreted`, `statesWardrobe` has its own suite, and `sheetNotice` decides
 * which line wins. What nothing tested was the middle: `readFellBack` reaches
 * into untyped JSON by string key, so renaming the field in `briefCompiler`
 * would kill the confession outright with every one of those suites still
 * green. That is the invoked-but-inert class this codebase keeps meeting, and
 * a projection field nobody asserts is a control that does not exist.
 */
describe("the sheet's two confessions survive the projection", () => {
  it("reports a roll that fell back to the raw sentence", () => {
    const projected = projectRoll({
      roll: rollRow({ compiledBrief: { compiler: "pathA-v1", interpreted: false } }),
      candidates: [candidateRow()],
    });
    expect(projected.fellBack).toBe(true);
  });

  it("does not report an interpreted roll", () => {
    const projected = projectRoll({
      roll: rollRow({ compiledBrief: { compiler: "pathA-v1", interpreted: true } }),
      candidates: [candidateRow()],
    });
    expect(projected.fellBack).toBe(false);
  });

  /*
    Absent is not "it fell back". Rolls compiled before the field existed have
    no value, and reporting an unknown as a failure would put a confession on
    sheets that never had anything to confess.
  */
  it("stays silent about a roll that predates the field", () => {
    const projected = projectRoll({ roll: rollRow(), candidates: [candidateRow()] });
    expect(projected.fellBack).toBe(false);
  });

  it("reports a brief that stated clothing", () => {
    const projected = projectRoll({
      roll: rollRow({ briefText: "a musician in a red leather jacket, late 20s" }),
      candidates: [candidateRow()],
    });
    expect(projected.statedWardrobe).toBe(true);
  });

  it("stays silent about a brief that stated an accessory the sheet honours", () => {
    const projected = projectRoll({
      roll: rollRow({ briefText: "a dad in his 30s wearing chunky glasses" }),
      candidates: [candidateRow()],
    });
    expect(projected.statedWardrobe).toBe(false);
  });
});

/**
 * WHAT THIS SHEET IS WEARING — the two paths, projected explicitly (§3.3).
 *
 * The same sentence exists in two INTERNAL places by the time a Cast is signed
 * — `compiledBrief` and the Cast's `technicalSchema` — and §3.2 refuses lifting
 * a display string out of either. These arms hold the boundary, and the
 * engine-pick label, which is a product promise rather than a field copy.
 */
describe("the sheet's wardrobe line", () => {
  const PICKED = "dark canvas work jacket, straight jeans, plain boots";

  it("⚠ says nothing at all for a roll cast before the paths existed", () => {
    /* Every roll in production as this lands, and every roll outside the flag.
       NULL is not an error and must not become a caption. */
    expect(projectRoll({ roll: rollRow(), candidates: [candidateRow()] }).wardrobe).toBeNull();
  });

  it("carries the line, and labels an engine's pick as one", () => {
    const projected = projectRoll({
      roll: rollRow({ briefText: "a caveman", path: "wardrobe", wardrobeLine: PICKED }),
      candidates: [candidateRow()],
    });
    expect(projected.wardrobe).toEqual({ path: "wardrobe", line: PICKED, enginePicked: true });
  });

  it("⚠ NEVER labels an outfit SHE named as the engine's pick", () => {
    /*
      §4.1(1)'s other half: she is never told she asked for something she did
      not, and equally never told the engine chose something she DID ask for.
    */
    const projected = projectRoll({
      roll: rollRow({
        briefText: "a barista in a red apron",
        path: "wardrobe",
        wardrobeLine: "a red apron over a plain white tee, dark jeans, plain shoes",
      }),
      candidates: [candidateRow()],
    });
    expect(projected.wardrobe?.enginePicked).toBe(false);
  });

  it("⚠ the HOUSE line is not a pick — it is the studio default", () => {
    const projected = projectRoll({
      roll: rollRow({ briefText: "a woman in her 30s", path: "wardrobe", wardrobeLine: HOUSE_WARDROBE_LINE }),
      candidates: [candidateRow()],
    });
    expect(projected.wardrobe)
      .toEqual({ path: "wardrobe", line: HOUSE_WARDROBE_LINE, enginePicked: false });
  });

  it("⚠ BASICS is the path's own outfit, never an engine pick", () => {
    const projected = projectRoll({
      roll: rollRow({
        briefText: "a swimmer in her 20s",
        path: "basics",
        wardrobeLine: "shirtless, in plain black fitted shorts, barefoot",
      }),
      candidates: [candidateRow()],
    });
    expect(projected.wardrobe?.enginePicked).toBe(false);
    expect(projected.wardrobe?.line).toContain("black");
  });

  /*
    ⚠ THE PATH RIDES INSIDE THIS OBJECT, and the client keys every §6 surface
    on it (the sheet's record line, the re-roll switch's preselect, the
    notice's path arm). It comes from the ONE OWNER's resolution rather than
    from a second read of the column.
  */
  it("⚠ says which path, beside the line, so the sheet needs no second field", () => {
    const basics = projectRoll({
      roll: rollRow({
        briefText: "a swimmer in her 20s",
        path: "basics",
        wardrobeLine: "shirtless, in plain black fitted shorts, barefoot",
      }),
      candidates: [candidateRow()],
    });
    expect(basics.wardrobe?.path).toBe("basics");
    const dressed = projectRoll({
      roll: rollRow({ briefText: "a caveman", path: "wardrobe", wardrobeLine: PICKED }),
      candidates: [candidateRow()],
    });
    expect(dressed.wardrobe?.path).toBe("wardrobe");
  });

  it("⚠ a path with NO line says nothing rather than guessing", () => {
    /* `incoherent` — the write path cannot produce it, and a sheet that met one
       must not caption a grey tee onto a Cast whose whole point is a bare
       chest. */
    expect(
      projectRoll({ roll: rollRow({ path: "basics", wardrobeLine: null }), candidates: [candidateRow()] })
        .wardrobe,
    ).toBeNull();
  });
});

/**
 * The producer and the reader, compiled together.
 *
 * The cases above would all still pass if `briefCompiler` renamed its field
 * tomorrow, because they hand-write the JSON the reader expects. This one
 * drives the REAL compiler with an interpreter that cannot answer, and asserts
 * the confession comes out the far end — so the two halves cannot drift apart
 * without something going red.
 */
describe("a real failed compile reaches the sheet as a confession", () => {
  it("projects fellBack from what the compiler actually wrote", async () => {
    const { castingBriefCompiler } = await import("./briefCompiler");

    const compiled = await castingBriefCompiler({
      briefText: "an East Asian woman in her 40s, close-cropped silver hair",
      candidateCount: 8,
      rollSeed: "11111111-1111-4111-8111-111111111111",
      unlock: [],
      // The interpreter is unreachable. Fail-open: the roll still compiles from
      // the sentence itself, and every stated lock is lost.
      engine: { complete: async () => { throw new Error("interpreter unreachable"); } } as never,
    });

    const projected = projectRoll({
      roll: rollRow({ compiledBrief: compiled.compiledBrief }),
      candidates: [candidateRow()],
    });

    expect(projected.fellBack).toBe(true);
  });
});

/**
 * The tile shows the face Sign would spend (M8 §11).
 *
 * The failure this forecloses is quiet and nasty: the sheet renders the
 * original while the Sign button spends the refinement, so the picture the user
 * is looking at is not the one they are about to pay 450 credits for. Nothing
 * throws; the surface simply lies about what its own button does.
 */
describe("a refined candidate projects its refinement", () => {
  it("shows the selected variant's image, not the original's", () => {
    const projected = projectCandidate(candidateRow({
      selectedVariantId: 5,
      selectedVariantPublicId: "variant-1",
      faceImageKey: "casting-v2/variants/refined.png",
    }));
    expect(projected?.imageUrl).toContain("casting-v2/variants/refined.png");
    expect(projected?.imageUrl).not.toContain("abc.png");
  });

  it("still shows the original when nothing is selected", () => {
    expect(projectCandidate(candidateRow())?.imageUrl).toContain("abc.png");
  });

  /*
    A refunded candidate carries no image, and selecting a variant must not be
    a way around that — the generosity refund is only defensible because the
    user never receives the picture.
  */
  it("suppresses a refunded candidate's image even when a variant is selected", () => {
    const projected = projectCandidate(candidateRow({
      status: "expired",
      selectedVariantId: 5,
      selectedVariantPublicId: "variant-1",
      faceImageKey: "casting-v2/variants/refined.png",
    }));
    expect(projected?.imageUrl).toBeNull();
    expect(projected?.thumbUrl).toBeNull();
  });
});

/*
  THE AGE IS SUBTRACTED HERE, AND BOTH TERMS COME OFF ONE CLOCK.

  The sheet's supervised-wait promise — "past about two minutes a still-casting
  tile says so" — used to be decided in the browser from `createdAt` minus
  `Date.now()`. Two moments, two clocks: entry 13 of the instrument doctrine,
  living in the product. These arms pin the subtraction on this side, where the
  roll's own insert wrote the other term off the same clock.
*/
describe("ageMs — the wait, measured where both terms live", () => {
  const BORN = new Date("2026-07-31T00:00:00.000Z");

  it("is the elapsed milliseconds between the row and the reading", () => {
    const projected = projectRoll({
      roll: rollRow({ createdAt: BORN }),
      candidates: [candidateRow()],
      now: new Date("2026-07-31T00:02:30.000Z"),
    });
    expect(projected.ageMs).toBe(150_000);
  });

  /*
    The threshold the sheet actually compares against, driven from both sides of
    it. A test that only proves the arithmetic would pass just as well if the
    number were shipped in seconds.
  */
  it("crosses the sheet's two-minute mark at two minutes and not before", () => {
    const at = (iso: string) => projectRoll({
      roll: rollRow({ createdAt: BORN }),
      candidates: [candidateRow()],
      now: new Date(iso),
    }).ageMs;
    expect(at("2026-07-31T00:01:59.999Z")).toBeLessThanOrEqual(120_000);
    expect(at("2026-07-31T00:02:00.001Z")).toBeGreaterThan(120_000);
  });

  /* A row written a hair ahead of the reading is zero seconds old, never a
     large negative number that would read as brand new for the rest of time. */
  it("never reports a negative age", () => {
    expect(projectRoll({
      roll: rollRow({ createdAt: BORN }),
      candidates: [candidateRow()],
      now: new Date("2026-07-30T23:59:55.000Z"),
    }).ageMs).toBe(0);
  });

  /* Nobody has to remember to pass one: the default is a reading taken inside
     the projection, which is the same clock as the row's own insert. */
  it("takes its own reading when none is injected", () => {
    const projected = projectRoll({
      roll: rollRow({ createdAt: new Date(Date.now() - 5_000) }),
      candidates: [candidateRow()],
    });
    expect(projected.ageMs).toBeGreaterThanOrEqual(5_000);
    expect(projected.ageMs).toBeLessThan(60_000);
  });
});
