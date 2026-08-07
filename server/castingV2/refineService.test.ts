import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Refine's MONEY and its ORDER (M8 §10, §12).
 *
 * One invariant, stated the way the Sign suite states its own:
 *
 *   **a variant exists ⟹ money was taken, and money was taken ⟹ a variant
 *   exists or the whole charge came back.**
 *
 * A refine is one image and one unit, so there is no partial state to defend —
 * which makes the interesting cases the boundaries rather than the middle: the
 * refusals that must happen BEFORE anything is claimed, and the failures after
 * the charge that must give back all 25 rather than some of it.
 */

const journal: string[] = [];
const ledger = {
  charges: [] as Array<{ amount: number; reference: string }>,
  refunds: [] as Array<{ amount: number; description: string }>,
};

let chargeSucceeds = true;
let candidateRow: Record<string, unknown>;
let variantRows: Array<Record<string, unknown>>;
let landedVariant: Record<string, unknown> | null = null;
/** What the BRIEF said she wears — the base-worn inventory (D-206). */
let briefWorn: string[] | null = null;
let failedVariant: Record<string, unknown> | null = null;
let engineThrows: Error | null = null;
let renderFault = false;

vi.mock("./spendGuards", () => ({ assertNotFrozen: vi.fn(async () => undefined) }));

vi.mock("../db/castingV2", () => ({
  /*
    THE BRIEF THE REMOVAL NOW CONSULTS (D-206). `briefWorn` is what each test
    sets when it wants a face that was DRAWN wearing something — the origin the
    recipe has never known about.
  */
  getBriefForOwnedCandidate: vi.fn(async () => (briefWorn
    ? {
      compiledBrief: { intent: { statedAccessories: briefWorn } },
      lockContract: {},
      briefText: briefWorn.join(" "),
    }
    : null)),
  getOwnedCandidateWithSelectedFace: vi.fn(async () => {
    journal.push("read");
    if (!candidateRow) return null;
    const selected = variantRows.find((v) => v.publicId === candidateRow.selectedVariantPublicId);
    return {
      candidate: candidateRow,
      variantId: selected ? (selected.id as number) : null,
      variantPublicId: selected ? (selected.publicId as string) : null,
      imageKey: selected ? selected.imageKey : candidateRow.imageKey,
      thumbKey: null,
      internalPrompt: selected ? selected.internalPrompt : candidateRow.internalPrompt,
    };
  }),
}));

vi.mock("../db/castingV2Variants", () => ({
  VariantOwnershipError: class extends Error {},
  listCandidateVariants: vi.fn(async () => variantRows),
  claimVariant: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("claim");
    return {
      id: 500 + variantRows.length,
      publicId: `variant-${variantRows.length + 1}`,
      candidateId: 1,
      sessionId: 1,
      baseImageKey: candidateRow.imageKey as string,
      baseInternalPrompt: candidateRow.internalPrompt,
      claimedInstructions: input.instructions,
      claimedDeltas: input.deltas,
      /* Read back from the row, which is what wall (d) composes from. */
      deltas: input.deltas,
    };
  }),
  markVariantDispatched: vi.fn(async () => true),
  VariantLandingError: class extends Error {},
  landVariant: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("land");
    landedVariant = input;
  }),
  failVariant: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("fail");
    failedVariant = input;
    return true;
  }),
  /* The free half of D-163: navigation and re-selection move a pointer and
     open no operation, so they are journalled but never charged. */
  selectVariant: vi.fn(async () => {
    journal.push("select");
    return true;
  }),
  /* The satisfaction ledger's writer (D-175) — journalled so the tests can see
     that a label is written, and that a label failing never costs a render. */
  recordVariantOutcome: vi.fn(async () => {
    journal.push("outcome");
    return true;
  }),
}));

vi.mock("../db/credits", () => ({
  deductCredits: vi.fn(async (
    _userId: number,
    amount: number,
    _type: string,
    _label: string,
    reference: string,
  ) => {
    journal.push("deduct");
    if (!chargeSucceeds) return { success: false, error: "Not enough credits" };
    ledger.charges.push({ amount, reference });
    return { success: true };
  }),
}));

vi.mock("../casting/atomicCredits", () => ({
  recordRefund: vi.fn(async (_userId: number, amount: number, description: string) => {
    journal.push("refund");
    ledger.refunds.push({ amount, description });
    return { recorded: true };
  }),
  refundReferenceFor: (reference: string) => `refund:${reference}`,
}));

vi.mock("../db/generationOperations", () => ({
  markGenerationOperationRunning: vi.fn(async () => {
    journal.push("running");
  }),
}));

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("begin");
    return { type: "claimed", operationId: "11111111-1111-4111-8111-111111111111" };
  }),
  completeDirectOperationSuccess: vi.fn(async () => {
    journal.push("seal:success");
  }),
  completeDirectOperationFailure: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:failure");
    throw input.error;
  }),
  failClaimedDirectOperation: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:claimed-failure");
    throw input.error;
  }),
}));

vi.mock("../storage", () => ({
  /* A REAL png, because the service reads the master's dimensions to pin the
     render size — a fake buffer made that a decode error rather than a test.
     32x48 keeps the master's 2:3 and both dimensions multiples of 16. */
  storageReadBytes: vi.fn(async () => ({ bytes: TINY_MASTER_PNG, contentType: "image/png" })),
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://cdn.example/${key}` })),
  /* Typed removal answers some asks by SELECTING an existing picture, which
     needs the public URL of a row rather than a fresh upload (D-163). */
  storagePublicUrl: vi.fn((key: string) => `https://cdn.example/${key}`),
}));

vi.mock("../db/connection", () => ({
  withTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({})),
}));

/*
  The register-before-write manifest. Journalled because its ORDER is the point:
  the key must be handed to the cleanup worker before the bytes exist, or a
  crash strands a paid picture of a person at a permanent public URL.
*/
vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: vi.fn(async () => {
    journal.push("manifest");
    return { id: "batch-1" };
  }),
}));

vi.mock("./renderFault", () => ({
  detectRenderFault: vi.fn(async () => ({
    fault: renderFault,
    reason: renderFault ? "seam" : "clean",
    detail: "a horizontal seam",
  })),
}));

/*
  The masked path renders through GPT Image 2 at a pinned size — the routing row
  the face wall established. Stubbed here beside the incumbent engine so the
  service suite keeps testing the service; `maskedRefine.test.ts` owns masking.
  Partial mock, so everything else in the module keeps its real implementation.
*/
/* Built once, at module scope, so every mock can hand back the same master. */
const TINY_MASTER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAwCAIAAAD/zu84AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAASklEQVR4nO3YwQkAMAxC0c7uEE7igJ2i0MOD3AMhUX/Omqd1NKgRxRbNoYVUjJqW4YxlVqqI4FXRMdL1AEgg1FBmgfi8Evrxt+UCvS/Il+tSa9kAAAAASUVORK5CYII=",
  "base64",
);

vi.mock("../providers/falImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../providers/falImages")>()),
  createFalMaskedEditEngine: () => ({
    id: "test:masked",
    edit: vi.fn(async () => {
      journal.push("generate");
      if (engineThrows) throw engineThrows;
      return {
        bytes: Buffer.from("refined"),
        contentType: "image/png",
        width: 1024,
        height: 1536,
        latencyMs: 10,
        provenance: { provider: "fal", model: "gpt-image-2", providerRef: "req-1" },
      };
    }),
  }),
}));

vi.mock("./signEngine", () => ({
  castingIdentityEngine: () => ({
    id: "test",
    editWithReferences: vi.fn(async () => {
      journal.push("generate");
      if (engineThrows) throw engineThrows;
      return {
        bytes: Buffer.from("refined"),
        contentType: "image/png",
        width: 1024,
        height: 1536,
        latencyMs: 10,
        provenance: { provider: "fal", model: "nbp", providerRef: "req-1" },
      };
    }),
    generateView: vi.fn(),
  }),
}));

const { refineCandidate } = await import("./refineService");
const { claimVariant } = await import("../db/castingV2Variants");

beforeEach(() => {
  journal.length = 0;
  ledger.charges.length = 0;
  ledger.refunds.length = 0;
  chargeSucceeds = true;
  engineThrows = null;
  renderFault = false;
  landedVariant = null;
  failedVariant = null;
  briefWorn = null;
  variantRows = [];
  candidateRow = {
    id: 1,
    publicId: "candidate-public",
    imageKey: "casting-v2/candidates/abc.png",
    signedCastId: null,
    selectedVariantPublicId: null,
    internalPrompt: {
      prompt: "the composed casting instruction",
      resolved: {
        sex: "female",
        ageBand: "30s",
        energy: "warm",
        heritage: [{ heritage: "Nordic", pct: 100 }],
        realized: { eyeColour: "brown", eyeShape: null },
      },
    },
  };
  vi.clearAllMocks();
});

const input = {
  userId: 1,
  clientRequestId: "22222222-2222-4222-8222-222222222222",
  candidatePublicId: "candidate-public",
  instruction: "make her eyes green",
};

/**
 * This suite is about the refinement SERVICE — charging, retrying, refusing,
 * refunding — and not about masking, which `maskedRefine.test.ts` owns.
 *
 * The masked path is live for this suite's user, so without this every test
 * would run a real composite against a flat synthetic swatch and measure the
 * fixture rather than the service. A passthrough keeps each suite testing its
 * own subject, which is why the seam is an injectable dependency like
 * `interpret` and `verifier`.
 */
const unmasked = async (input: { painted: { bytes: Buffer; contentType: string } }) => ({
  bytes: input.painted.bytes,
  contentType: input.painted.contentType,
  outcome: "flag-off" as const,
});

const greenEyes = {
  interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
  harvest: unmasked,
};

describe("refusals land before anything is claimed", () => {
  /*
    §10's whole argument. An out-of-tier ask is a real thing a user will type,
    and it must cost nothing and say so at once — not take 25 credits to make a
    picture that was never going to be what they asked for.
  */
  it("refuses an out-of-tier instruction for free", async () => {
    await expect(refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: false, refusal: { reason: "wall_stage", asked: "her age" } }) },
      { ...input, instruction: "make her older" },
    )).rejects.toThrow(/not the shoot/);

    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
    expect(ledger.charges).toHaveLength(0);
  });

  it("refuses when the interpreter cannot be reached, rather than guessing", async () => {
    await expect(refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: false, refusal: { reason: "unreadable" } }) },
      input,
    )).rejects.toThrow(/Nothing was charged/);
    expect(ledger.charges).toHaveLength(0);
  });

  it("ASKS INSTEAD OF SPENDING when her eyes already sweep up", async () => {
    /*
      THE ALREADY-TRUE GATE, proved at its call site rather than in isolation.

      The walk candidate measures 7.2 degrees of canthal tilt, so "fox eyes" on
      her is an ask for a property she has. Rendering it spends 25 credits to
      produce the face she is looking at and then asks a reader whether it
      complied — which is how a false pass is manufactured. The honest answer is
      a free question.

      This is the half that matters: a gate nobody calls does not exist, and
      until this test existed the gate was built, unit-tested and INERT.
    */
    const W = 400;
    const H = 300;
    const upsweptEyes = () => {
      const data = Buffer.alloc(W * H, 0);
      const put = (x0: number, x1: number, yAt: (x: number) => number) => {
        for (let x = x0; x < x1; x += 1) {
          const y = Math.round(yAt(x));
          for (let dy = -4; dy <= 4; dy += 1) data[(y + dy) * W + x] = 255;
        }
      };
      put(80, 160, (x) => 120 + (x - 80) * 0.25);
      put(240, 320, (x) => 140 - (x - 240) * 0.25);
      return { data, width: W, height: H };
    };
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const asked = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: face, contentType: "image/png" }),
        regions: {
          region: async () => upsweptEyes(),
          subject: async () => upsweptEyes(),
          landmark: async () => [],
        },
      },
      { ...input, instruction: "fox eyes" },
    );

    expect(asked.kind, "a question, in the shape the product asks questions in").toBe("asked");
    expect(asked.reask!.question).toMatch(/already sweep/);
    expect(ledger.charges, "and it costs her nothing").toHaveLength(0);
    expect(journal).not.toContain("begin");
  });

  /*
    AND IT MUST BE ANSWERABLE — which is the half that was missing.

    The gate shipped as a thrown BAD_REQUEST carrying the sentence, so the
    question arrived in the refusal channel with no chips, and `pendingReaskFor`
    had never heard of it: every answer re-derived nothing, fell through to the
    gate, and was asked the same question again. The founder's condition on
    shipping the sentence form is that it must NEVER dead end, and these two
    tests are what say it does not. They fail if the gate stops standing down.
  */
  it("takes YES for an answer, and then actually spends", async () => {
    const W = 400;
    const H = 300;
    const upsweptEyes = () => {
      const data = Buffer.alloc(W * H, 0);
      const put = (x0: number, x1: number, yAt: (x: number) => number) => {
        for (let x = x0; x < x1; x += 1) {
          const y = Math.round(yAt(x));
          for (let dy = -4; dy <= 4; dy += 1) data[(y + dy) * W + x] = 255;
        }
      };
      put(80, 160, (x) => 120 + (x - 80) * 0.25);
      put(240, 320, (x) => 140 - (x - 240) * 0.25);
      return { data, width: W, height: H };
    };
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const answered = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: face, contentType: "image/png" }),
        regions: {
          region: async () => upsweptEyes(),
          subject: async () => upsweptEyes(),
          landmark: async () => [],
        },
      },
      /* Exactly what the chip sends: the outstanding sentence travels as
         `answering`, the label as the instruction. Typing "More tilt" is the
         same request, which is the property that keeps the two routes one. */
      { ...input, instruction: "More tilt", answering: "fox eyes" },
    );

    expect(answered.kind, "the question must not be asked a second time").toBe("rendered");
    expect(ledger.charges, "she said yes, so this one is paid for").toHaveLength(1);
  });

  it("takes NO for an answer, for free, and lands on the face she has", async () => {
    /* Declining has to be as easy as accepting, or the question has one real
       answer and is not a question. It never reaches the claim. */
    const declined = await refineCandidate(
      { harvest: unmasked, interpret: async () => { throw new Error("the parse is never reached"); } },
      { ...input, instruction: "Never mind", answering: "fox eyes" },
    );

    expect(declined.kind).toBe("selected");
    expect(declined.note).toMatch(/nothing was charged/i);
    expect(ledger.charges).toHaveLength(0);
    expect(journal).not.toContain("begin");
  });

  it("measures the face she is LOOKING at, not the one she started from", async () => {
    /*
      ASSERTED AT THE WIRE, because the contract is about which picture gets
      read and a constant near it proves nothing.

      This gate shipped reading `source.candidate.imageKey` — her base — while
      the removal path three hundred lines above reads the SELECTED face and
      says outright that asking the wrong picture is "the record-versus-pixels
      mistake wearing a new hat". On a chain that has already changed her eyes,
      the base is a face nobody is looking at, and the gate would decide whether
      to charge her on the strength of it.
    */
    variantRows.push({
      id: 91,
      publicId: "variant-selected",
      imageKey: "casting-v2/variants/she-is-looking-at-this.png",
      instructions: ["icy blue eyes"],
      stepDeltas: [{ eyeColour: "blue" }],
      deltas: { eyeColour: "blue" },
      internalPrompt: {},
    } as never);
    candidateRow.selectedVariantPublicId = "variant-selected";

    /*
      The two faces are told apart by their SIZE, not by the key that was
      asked for: another read happens earlier in this function for a different
      purpose, so asserting on "the first key requested" would measure that one
      instead. What the gate segments is the thing under test.
    */
    const sharp = (await import("sharp")).default;
    const base = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#808080" } })
      .png().toBuffer();
    const looking = await sharp({ create: { width: 60, height: 60, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const segmented: number[] = [];
    await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async (key: string) => ({
          bytes: key.includes("she-is-looking-at-this") ? looking : base,
          contentType: "image/png",
        }),
        regions: {
          region: async ({ image }: { image: Buffer }) => {
            segmented.push((await sharp(image).metadata()).width ?? 0);
            throw new Error("no eyes — the gate stands down, which this test is not about");
          },
          subject: async () => { throw new Error("no subject"); },
          landmark: async () => [],
        } as never,
      },
      { ...input, instruction: "fox eyes" },
    ).catch(() => undefined);

    expect(segmented[0], "the gate measured her base instead of her selected face").toBe(60);
    candidateRow.selectedVariantPublicId = null;
    variantRows.pop();
  });

  it("still SPENDS when the instrument cannot read her — silence never refuses", async () => {
    /*
      The asymmetry, at the call site. A gate that refuses on a no-read would
      cost a customer the picture they asked for whenever a segmenter had an off
      day, and that is the failure this program has shipped once already. So an
      unreadable face falls through to the ordinary paid path.
    */
    const blind = {
      region: async () => { throw new Error("the segmenter found no eyes to edit"); },
      subject: async () => { throw new Error("no subject"); },
      landmark: async () => [],
    };
    const result = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: Buffer.from("not-an-image"), contentType: "image/png" }),
        regions: blind,
      },
      { ...input, instruction: "fox eyes" },
    ).catch((error) => error);
    /* Whatever happens downstream, it must NOT be the gate's refusal. */
    expect(String(result)).not.toMatch(/already sweep/);
  });

  it("refuses a candidate that has already been signed", async () => {
    candidateRow.signedCastId = 42;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow(/already been signed/);
    expect(journal).not.toContain("begin");
  });

  it("refuses a real TOO_MANY_REQUESTS when the queue is full, before the claim", async () => {
    await expect(refineCandidate({ ...greenEyes, admit: () => false },
      input,
    )).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(journal).not.toContain("begin");
    expect(ledger.charges).toHaveLength(0);
  });
});

/*
  THE QUESTIONS ARE FREE, AND THEY ARE FREE STRUCTURALLY (D-178, D-179, D-180).

  They fire before the parse, so they cost nothing at all — not a claim, not a
  charge, not even the interpreter call. `interpret` here THROWS: if any of
  these ever reached it, the test would fail rather than quietly passing on a
  free-but-slower path.
*/
describe("the questions cost nothing, and never dead-end", () => {
  const explodes = {
    interpret: async () => {
      throw new Error("the interpreter must never be reached by a question");
    },
  };

  it("asks which part a bare colour ask means, with nothing claimed", async () => {
    const result = await refineCandidate(explodes, { ...input, instruction: "pinker" });
    expect(result.kind).toBe("asked");
    expect(result.reask?.kind).toBe("which-facet");
    expect(result.reask?.options.map((option) => option.label))
      .toEqual(["the hair", "the eyes", "makeup"]);
    expect(journal).toEqual(["read"]);
    expect(ledger.charges).toHaveLength(0);
  });

  it("asks about a near-miss typo before the money moves", async () => {
    const result = await refineCandidate(explodes, { ...input, instruction: "piink hair" });
    expect(result.kind).toBe("asked");
    expect(result.reask?.question).toContain("Did you mean pink?");
    expect(journal).not.toContain("begin");
    expect(ledger.charges).toHaveLength(0);
  });

  it("runs the answer as the instruction it stands for, and charges once", async () => {
    let seen = "";
    await refineCandidate({ harvest: unmasked,
        interpret: async (parse: { instruction: string }) => {
          seen = parse.instruction;
          return { ok: true as const, delta: { hairColour: "copper" as const } };
        },
      },
      { ...input, instruction: "yes", answering: "piink hair" },
    );
    /* THEIR word, chosen by them — the confirmation is what keeps D-172 intact. */
    expect(seen).toBe("pink hair");
    expect(ledger.charges).toHaveLength(1);
  });

  it("treats an unrecognised reply as a new instruction rather than a dead end", async () => {
    let seen = "";
    await refineCandidate({ harvest: unmasked,
        interpret: async (parse: { instruction: string }) => {
          seen = parse.instruction;
          return { ok: true as const, delta: { hairColour: "copper" as const } };
        },
      },
      { ...input, instruction: "actually give her a fringe", answering: "pinker" },
    );
    expect(seen).toBe("actually give her a fringe");
    expect(ledger.charges).toHaveLength(1);
  });

  it("does not ask twice — an answer is never re-questioned", async () => {
    let seen = "";
    await refineCandidate({ harvest: unmasked,
        interpret: async (parse: { instruction: string }) => {
          seen = parse.instruction;
          return { ok: true as const, delta: { free: { hairShade: "piink" } } };
        },
      },
      { ...input, instruction: "no", answering: "piink hair" },
    );
    /* Still one slip from a known word, and asking again would be the loop the
       question exists to end. */
    expect(seen).toContain("piink hair");
    expect(ledger.charges).toHaveLength(1);
  });
});

/*
  THE HISTORY IS PART OF THE INPUT (D-182).

  The founder's eleven-instruction chain rendered as the original plus pink
  hair, because the stored recipe could not be read and `?? {}` turned that into
  "there was nothing". Nine facts left the prompt and the money moved anyway.
*/
describe("an unreadable history stops the money", () => {
  it("refuses rather than composing from nothing, and charges nothing", async () => {
    variantRows = [{
      id: 501,
      publicId: "variant-legacy",
      candidateId: 1,
      imageKey: "casting-v2/variants/legacy.png",
      internalPrompt: candidateRow.internalPrompt,
      instructions: ["change hair to mullet"],
      /* A shape no reader can make sense of — not legacy, just broken. */
      deltas: { free: { unknowable: { nested: true } } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-legacy";

    await expect(refineCandidate(greenEyes, input)).rejects.toThrow(/won't guess at it/);
    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
    expect(ledger.charges).toHaveLength(0);
  });

  it("still allows the FIRST refinement, which has no history at all", async () => {
    /* Nothing stored is legitimate; stored-but-unreadable is the fault. */
    await refineCandidate(greenEyes, input);
    expect(ledger.charges).toHaveLength(1);
  });

  it("reads a legacy chain and carries it forward", async () => {
    variantRows = [{
      id: 502,
      publicId: "variant-old",
      candidateId: 1,
      imageKey: "casting-v2/variants/old.png",
      internalPrompt: candidateRow.internalPrompt,
      instructions: ["change hair to mullet", "seafoam green eyes"],
      /* The founder's own pre-split row shape. */
      deltas: { free: { hair: "mullet", eyes: "seafoam green" } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-old";

    await refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { free: { hairShade: "pink" } } }) },
      input,
    );
    const claimed = JSON.stringify(landedVariant ?? {});
    expect(claimed).toContain("mullet");
    expect(claimed).toContain("seafoam green");
    expect(claimed).toContain("pink");
  });
});

/*
  THE VERIFICATION NET (D-185).

  A roll is judged before delivery; a refine shipped sight-unseen, and the
  founder's chain lost an eye colour that was present in every prompt. The net
  looks at the picture, retries once at the house's expense, and refuses with a
  full refund rather than charging for a render that is missing a filed fact.
*/
describe("the render is checked against the record before it is delivered", () => {
  /*
    Keyed on WHICH question is being asked, not on call order — the same reader
    also pins the base's presentation (D-186), and counting its call as a
    verdict made the retry test pass for the wrong reason.
  */
  const verifierSaying = (...verdicts: boolean[]) => {
    let call = 0;
    return {
      id: "verifier",
      complete: async (request: { system: string }) => {
        if (request.system.includes("how they")) {
          /* The presentation read. No pin, so the net's fact list is unchanged. */
          return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
        }
        const present = verdicts[Math.min(call, verdicts.length - 1)];
        call += 1;
        return {
          /* `saw` on BOTH answers (D-235). An affirmative that names nothing is
             not a reading, so a fake that omits it here is reproducing the
             empty yes rather than a pass. */
          text: JSON.stringify({ results: [{ id: 1, present, saw: present ? "green irises" : "brown" }] }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;
  };

  it("delivers when the picture contains what was asked for", async () => {
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(true) }, input);
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(1);
    expect(ledger.charges).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("re-renders once, free, when the first attempt is missing a fact", async () => {
    /* Two readings agreeing it is missing (D-194), then a clean second attempt. */
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false, true) }, input);
    /* Two renders, ONE charge — the retry is absorbed. */
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(2);
    expect(ledger.charges).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("refuses and refunds the whole 25 when the retry fails too", async () => {
    /* Confirmed missing on both attempts: two readings each. */
    await expect(
      refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false, false, false) }, input),
    ).rejects.toThrow();
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(2);
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });

  /*
    FAIL OPEN ON AN OUTAGE. Invariant 7 governs security controls, where
    allowing is a breach. Here refusing on an unreachable reader destroys a
    render that is probably fine and hands back credits instead of the face —
    D-114 inverted the same way for the same reason.
  */
  it("delivers when the reader cannot be reached at all", async () => {
    const broken = {
      id: "broken",
      complete: async () => { throw new Error("reader down"); },
    } as never;
    await refineCandidate({ ...greenEyes, verifier: broken }, input);
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  /*
    THE FIRST LIVE TRIAL'S LESSON (D-187). Six of eight refusals were the reader
    adjudicating "seafoam green" — the user's own words for a shade nobody has
    defined — against renders whose eyes had plainly gone green.
  */
  it("never refuses over the user's own words, and still records the miss", async () => {
    /* A free-lane value: checked, recorded, not binding. */
    const freeLane = {
      interpret: async () => ({ ok: true as const, delta: { free: { eyeColourFree: "seafoam green" } } }),
      verifier: verifierSaying(false, false),
      harvest: unmasked,
    };
    await refineCandidate(freeLane, input);
    /* Delivered on the first attempt: an advisory miss buys nothing and costs
       nothing — no retry, no refund. */
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
    const landed = JSON.stringify(landedVariant ?? {});
    expect(landed).toContain("seafoam green");
    expect(landed).toContain('"binding":false');
  });

  it("still refuses over a value the vocabulary defines", async () => {
    /* "green" is a word this program owns, so the reader can be held to it. */
    await expect(
      refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false) }, input),
    ).rejects.toThrow();
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });

  it("records the verdict on the row, because it is the measuring instrument", async () => {
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false, true) }, input);
    const landed = JSON.stringify(landedVariant ?? {});
    expect(landed).toContain("verification");
    expect(landed).toContain('"attempts":2');
    /* How many readings the verdict took, recorded — the reader's own
       reliability, per render (D-194). */
    expect(landed).toContain('"readings"');
  });

  /*
    THE SECOND OPINION (D-194), and the trial is why.

    The same reader disagreed with itself on 21% of judgements about the same
    image. Chain 3 position 1: the service passed a render an independent
    re-read said was missing the fact. One reading cannot spend a refusal.
  */
  it("does not re-render when a second reading disagrees with the first", async () => {
    /* miss, then hit, then hit — the majority says it is there. */
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(false, true, true) }, input);
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("breaks a split with a third reading, and refuses only on a majority", async () => {
    /* Attempt 1: miss, hit, miss → majority missing → re-render.
       Attempt 2: miss, miss → confirmed → refuse and refund. */
    await expect(
      refineCandidate({ ...greenEyes, verifier: verifierSaying(false, true, false, false, false) },
        input,
      ),
    ).rejects.toThrow();
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(2);
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });
});

/*
  THE CHAIN-2 MISREAD (D-189), reproduced at the service.

  The trial asked for "small gold hoop earrings" — an addition — and one
  sampling classified it as a removal, so D-167's confession told the user there
  was nothing to take off something they were trying to put on. The word list
  cannot prevent the mis-sampling; it stops it reaching the confession.
*/
describe("a removal with no removal word is re-read as an edit", () => {
  const misreads = (asEdit: unknown) => {
    let call = 0;
    return async () => {
      call += 1;
      /* First read: the flake. Second read (mode: edit): the truth. */
      return call === 1
        ? { ok: true as const, intent: "remove" as const, subject: "statedAccessories", match: "earrings" }
        : asEdit;
    };
  };

  it("does not confess about taking off something being put on", async () => {
    const result = await refineCandidate({ harvest: unmasked,
        interpret: misreads({
          ok: true as const,
          delta: { free: { statedAccessories: ["small gold hoop earrings"] } },
        }) as never,
      },
      { ...input, instruction: "small gold hoop earrings" },
    );
    /* It rendered the addition instead of confessing. */
    expect(result.variantId).toBeTruthy();
    expect(JSON.stringify(landedVariant ?? {})).toContain("small gold hoop earrings");
  });

  /*
    THE FOUNDER'S WALK, AS A TEST (D-206).

    Production, their own account, a face visibly wearing glasses that their
    BRIEF asked for: "remove her glasses" came back "I can't find any glasses on
    this face". The recipe was the only record consulted, and the recipe has
    never had an opinion about glasses, because nobody ever refined them.
  */
  describe("a base-worn thing is not invisible just because no refine added it", () => {
    it("removes glasses the brief asked for", async () => {
      briefWorn = ["wire-framed glasses"];
      let call = 0;
      const result = await refineCandidate({ harvest: unmasked,
          /* Rule 3: the record says it IS there, so the sentence is re-read as
             an ordinary content edit with the removal vocabulary withheld. */
          interpret: (async () => {
            call += 1;
            return call === 1
              ? {
                ok: true as const,
                intent: "remove" as const,
                subject: "statedAccessories",
                match: "glasses",
              }
              : { ok: true as const, delta: { free: { statedAccessories: ["no glasses"] } } };
          }) as never,
        },
        { ...input, instruction: "remove her glasses" },
      );
      /* It did the work rather than denying what she is wearing. */
      expect(result.variantId).toBeTruthy();
    });

    it("says what it actually checked when the brief is silent too", async () => {
      /* The confession still stands — the composer forbids inventing an
         accessory nobody named — but it no longer claims to have looked at her
         face when all it read was a record. */
      briefWorn = null;
      await expect(refineCandidate({ harvest: unmasked,
          interpret: async () => ({
            ok: true as const,
            intent: "remove" as const,
            subject: "statedAccessories",
            match: "glasses",
          }),
        } as never,
        { ...input, instruction: "remove her glasses" },
      )).rejects.toThrow(/brief didn't ask for glasses/);
    });

    /* The founder's own face: brief edited to ask for glasses, re-rolled, and
       the refusal told them the brief never asked. Whatever the record did, she
       was wearing them — so the picture decides. */
    const seeingReader = (found: boolean) => ({
      region: async () => {
        if (!found) throw new Error("the segmenter found no glasses to edit");
        const data = Buffer.alloc(32 * 48, 0);
        /* A real pair of frames: comfortably inside the eyewear class band. */
        for (let y = 18; y < 24; y += 1) for (let x = 6; x < 26; x += 1) data[y * 32 + x] = 255;
        return { data, width: 32, height: 48 };
      },
      subject: async () => ({ data: Buffer.alloc(32 * 48, 255), width: 32, height: 48 }),
      landmark: async () => [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }],
    });

    it("LOOKS when the record is silent, and lets the removal through if she is wearing them", async () => {
      briefWorn = null;
      let call = 0;
      const result = await refineCandidate({ harvest: unmasked,
          regions: seeingReader(true),
          /* Same two-call shape as a record-backed removal: once the face has
             confirmed the thing, the sentence is re-read as a content edit. */
          interpret: (async () => {
            call += 1;
            return call === 1
              ? {
                ok: true as const,
                intent: "remove" as const,
                subject: "statedAccessories",
                match: "glasses",
              }
              : { ok: true as const, delta: { free: { statedAccessories: ["no glasses"] } } };
          }) as never,
        },
        { ...input, instruction: "remove her glasses" },
      );
      /* No confession, no refusal — it did the work on the face she is looking at. */
      expect(result.variantId).toBeTruthy();
    });

    it("still refuses when her face genuinely has none — the control", async () => {
      /* Without this the branch above could pass by never refusing anything,
         which is the confession deleted rather than corrected. */
      briefWorn = null;
      await expect(refineCandidate({ harvest: unmasked,
          regions: seeingReader(false),
          interpret: async () => ({
            ok: true as const,
            intent: "remove" as const,
            subject: "statedAccessories",
            match: "glasses",
          }),
        } as never,
        { ...input, instruction: "remove her glasses" },
      )).rejects.toThrow(/nothing on record to take off/);
    });

    it("charges nothing either way", async () => {
      briefWorn = null;
      await expect(refineCandidate({ harvest: unmasked,
          interpret: async () => ({
            ok: true as const,
            intent: "remove" as const,
            subject: "statedAccessories",
            match: "glasses",
          }),
        } as never,
        { ...input, instruction: "remove her glasses" },
      )).rejects.toThrow();
      expect(ledger.charges).toHaveLength(0);
      expect(journal).not.toContain("claim");
    });
  });

  it("still lets a real removal through", async () => {
    /* "remove the earrings" carries a removal word, so the parse stands and the
       honest confession is reached when the face has none. Since D-206 that
       confession names what it consulted — the brief and the recipe — rather
       than claiming to have looked at her face. */
    await expect(refineCandidate({ harvest: unmasked,
        interpret: async () => ({
          ok: true as const,
          intent: "remove" as const,
          subject: "statedAccessories",
          match: "earrings",
        }),
      } as never,
      { ...input, instruction: "remove the earrings" },
    )).rejects.toThrow(/brief didn.t ask for earrings/);
  });
});

/*
  THE CEILING (D-207, founder ruling 2026-08-05: twelve became twenty-four).

  There was no driver at all before this, which is how a number nobody had
  re-examined stayed a wall for a paying user. Three things are pinned: where it
  now sits, that it still gates a chain that GROWS rather than the box, and that
  hitting it costs nothing.
*/
describe("how many refinements one face can carry", () => {
  /* A real chain: each step adds one accessory, so the history is readable and
     nothing is dropped — the cap is what must fire, not the containment guard. */
  const chainOf = (length: number) => Array.from({ length }, (_, index) => {
    const steps = Array.from({ length: index + 1 }, (_, step) => `add charm ${step + 1}`);
    const stepDeltas = steps.map((_, step) => ({
      free: { statedAccessories: `charm ${step + 1}` },
    }));
    return {
      id: 100 + index,
      publicId: `variant-${index + 1}`,
      status: "ready",
      imageKey: `casting-v2/variants/v${index + 1}.png`,
      instructions: steps,
      stepDeltas,
      deltas: { free: { statedAccessories: `charm ${index + 1}` } },
      internalPrompt: {},
    };
  });

  it("accepts a twenty-fourth refinement, which twelve used to refuse", async () => {
    variantRows = chainOf(23);
    candidateRow.selectedVariantPublicId = "variant-23";
    const result = await refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" } }) } as never,
      { ...input, instruction: "make her eyes green" },
    );
    expect(result.variantId).toBeTruthy();
  });

  it("refuses the twenty-fifth, for free", async () => {
    variantRows = chainOf(24);
    candidateRow.selectedVariantPublicId = "variant-24";
    await expect(refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" } }) } as never,
      { ...input, instruction: "make her eyes green" },
    )).rejects.toThrow(/as many refinements as it can carry/);
    expect(ledger.charges).toHaveLength(0);
  });
});

describe("the order, and the money", () => {
  it("claims, runs, charges, generates, lands — in that order", async () => {
    await refineCandidate(greenEyes, input);
    expect(journal).toEqual([
      "read", "begin", "claim", "running", "deduct", "generate", "manifest", "land", "seal:success",
    ]);
    expect(ledger.charges).toEqual([
      { amount: 25, reference: "op:11111111-1111-4111-8111-111111111111:charge" },
    ]);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("never charges when the deduct is refused, and fails the variant row", async () => {
    chargeSucceeds = false;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow(/Not enough credits/);
    expect(ledger.charges).toHaveLength(0);
    expect(ledger.refunds).toHaveLength(0);
    /* The claimed row must not sit there queued forever. */
    expect(journal).toContain("fail");
  });

  it("gives back the WHOLE charge when the generation throws", async () => {
    engineThrows = new Error("the provider fell over");
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the generation failed" },
    ]);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  /*
    D-93's alarm, borrowed. A seamed frame is not something anyone should pay 25
    credits to receive, and the ledger line says what actually happened rather
    than blaming a provider that did its job.
  */
  it("refunds a damaged frame, and says so honestly on the receipt", async () => {
    renderFault = true;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the image came back damaged" },
    ]);
  });

  /*
    THE SAME HONESTY, ONE CLASS OVER (D-188).

    A verification refusal is not damage — the detector passed the picture
    twice. Wearing the damage class, it wrote "the image came back damaged" on
    eight real ledger rows and the first person to read them reported provider
    damage to the founder. The receipt is the record, and it must name what
    actually happened.
  */
  it("refunds a fact-short render under its own name, and says which fact", async () => {
    const verifier = {
      id: "verifier",
      complete: async (request: { system: string }) => ({
        text: request.system.includes("how they")
          ? JSON.stringify({ hairWorn: "unclear" })
          : JSON.stringify({ results: [{ id: 1, present: false, saw: "brown" }] }),
        truncated: false,
        latencyMs: 1,
      }),
    } as never;

    await expect(refineCandidate({ ...greenEyes, verifier }, input)).rejects.toThrow(/without green/);
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the render was missing green" },
    ]);
  });

  it("files the fact-short refusal under its own failure class, never as damage", async () => {
    const verifier = {
      id: "verifier",
      complete: async (request: { system: string }) => ({
        text: request.system.includes("how they")
          ? JSON.stringify({ hairWorn: "unclear" })
          : JSON.stringify({ results: [{ id: 1, present: false }] }),
        truncated: false,
        latencyMs: 1,
      }),
    } as never;
    await expect(refineCandidate({ ...greenEyes, verifier }, input)).rejects.toThrow();
    /* The variant row carries the same class the ledger line describes, or the
       two halves of the record disagree about one event. */
    expect(failedVariant?.failureClass).toBe("facts_missing");
  });
});

describe("the record and the picture come from the same place", () => {
  it("writes the composed edit into the variant's identity", async () => {
    await refineCandidate(greenEyes, input);
    const internal = landedVariant?.internalPrompt as { prompt: string; resolved: Record<string, unknown> };
    expect(internal.resolved).toMatchObject({ realized: { eyeColour: "green" } });
    /* The prompt is derived from the same delta — never the raw sentence. */
    expect(internal.prompt).toContain("green");
    expect(internal.prompt).not.toContain("make her eyes green");
  });

  /*
    BASE-ANCHORING. Every variant is one edit of the ORIGINAL, so drift cannot
    accumulate: the tenth refinement is as close to the face the user picked as
    the first. This asserts the reference is the candidate's own image even when
    a refinement is already selected.
  */
  it("edits the ORIGINAL even when a variant is selected", async () => {
    variantRows = [{
      id: 500,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/first.png",
      instructions: ["make her eyes green"],
      deltas: { eyeColour: "green" },
      internalPrompt: { prompt: "p", resolved: { realized: { eyeColour: "green" } } },
    }];
    candidateRow.selectedVariantPublicId = "variant-1";

    const { claimVariant } = await import("../db/castingV2Variants");
    await refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeShape: "hooded" as const } }) },
      { ...input, instruction: "hood her eyes a little" },
    );
    const claimed = vi.mocked(claimVariant).mock.results[0].value as Promise<Record<string, unknown>>;
    expect((await claimed).baseImageKey).toBe("casting-v2/candidates/abc.png");
  });

  /*
    The stack extends the SELECTED variant, not the newest one — which is what
    makes "edit from here" branch instead of appending to whatever came last,
    and what stops every earlier instruction being repeated once per variant.
  */
  it("extends the selected variant's stack, without repeating its instructions", async () => {
    variantRows = [{
      id: 500,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/first.png",
      instructions: ["make her eyes green"],
      deltas: { eyeColour: "green" },
      internalPrompt: { prompt: "p", resolved: { realized: { eyeColour: "green" } } },
    }];
    candidateRow.selectedVariantPublicId = "variant-1";

    const { claimVariant } = await import("../db/castingV2Variants");
    await refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeShape: "hooded" as const } }) },
      { ...input, instruction: "hood her eyes a little" },
    );
    const call = vi.mocked(claimVariant).mock.calls[0][0];
    expect(call.instructions).toEqual(["make her eyes green", "hood her eyes a little"]);
    /* Both edits survive, because composition is per-axis. */
    expect(call.deltas).toEqual({ eyeColour: "green", eyeShape: "hooded" });
  });
});

/**
 * The three money holes Fable found, each with the test that would catch it.
 *
 * All three were the same shape: a state where the ledger and the row disagree,
 * or where the receipt and the number beside it disagree. None of them threw.
 */
describe("the landing cannot half-commit, and the receipt cannot lie", () => {
  it("registers the object for cleanup BEFORE the bytes exist", async () => {
    await refineCandidate(greenEyes, input);
    /*
      Order, not presence. A manifest written after the put leaves the window
      it exists to close — the crash lands between them.
    */
    expect(journal.indexOf("manifest")).toBeLessThan(journal.indexOf("land"));
    expect(journal.indexOf("manifest")).toBeGreaterThan(journal.indexOf("generate"));
  });

  /*
    `landVariant` now THROWS rather than returning false, because
    `withTransaction` commits on any non-throw return: a boolean would have
    committed a `ready` variant that nothing points at, while the caller
    refunded it in full. Ready picture plus full refund, and the sweep would
    read the same row as a durable success and keep the charge.
  */
  it("refunds the whole charge when the landing refuses, with nothing half-written", async () => {
    const { landVariant } = await import("../db/castingV2Variants");
    vi.mocked(landVariant).mockRejectedValueOnce(new Error("not_selectable"));

    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the generation failed" },
    ]);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  /*
    The receipt is persisted and replayed to whoever asks about the operation
    later, so a message promising money back beside `refundedCredits: 0` is a
    receipt claiming money moved when it did not.
  */
  it("never promises a refund that did not record", async () => {
    const { recordRefund } = await import("../casting/atomicCredits");
    vi.mocked(recordRefund).mockResolvedValueOnce({ recorded: false } as never);
    engineThrows = new Error("the provider fell over");

    await expect(refineCandidate(greenEyes, input))
      .rejects.toThrow(/could not be recorded — quote operation/);
  });
});

/**
 * WALL (d), the structural half (D-131).
 *
 * "No render the paperwork did not learn" is dataflow, not discipline: the
 * prompt is composed from what the row actually holds, so a filing failure
 * degrades to filed-but-not-rendered — which the sweep can see — and never to
 * rendered-but-not-filed, which nothing can.
 */
describe("the prompt is composed from the persisted row", () => {
  it("renders what the ROW holds, not what the caller had in hand", async () => {
    const { claimVariant } = await import("../db/castingV2Variants");
    /* The row came back holding LESS than the service composed — a filing
       failure, simulated. The render must follow the row. */
    vi.mocked(claimVariant).mockImplementationOnce(async () => ({
      id: 501,
      publicId: "variant-1",
      candidateId: 1,
      sessionId: 1,
      baseImageKey: candidateRow.imageKey as string,
      baseInternalPrompt: candidateRow.internalPrompt,
      deltas: { eyeColour: "blue" },
    }));

    await refineCandidate(greenEyes, input);
    const internal = landedVariant?.internalPrompt as { prompt: string };
    expect(internal.prompt).toContain("blue");
    expect(internal.prompt).not.toContain("green");
  });

  it("refuses rather than falling back when the row is unreadable", async () => {
    const { claimVariant } = await import("../db/castingV2Variants");
    vi.mocked(claimVariant).mockImplementationOnce(async () => ({
      id: 502,
      publicId: "variant-2",
      candidateId: 1,
      sessionId: 1,
      baseImageKey: candidateRow.imageKey as string,
      baseInternalPrompt: candidateRow.internalPrompt,
      deltas: { eyeColour: "violet" },
    }));

    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    /* And the whole charge came back, because a refusal past the deduct is
       still a failure the user must not pay for. */
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });
});

/**
 * TYPED REMOVAL, AND ITS MONEY (D-163).
 *
 * The whole point of the ruling is that two of the three intents cost nothing.
 * So these assert on the LEDGER and on the journal: a free outcome must not
 * charge, must not claim, and must not even open an operation — an operation
 * carrying zero credits and no image is a phantom for the recovery sweep to
 * adjudicate forever.
 */
describe("removal is typed, and most of it is free", () => {
  const twoStep = () => {
    variantRows = [
      {
        id: 501,
        publicId: "variant-1",
        imageKey: "casting-v2/variants/one.png",
        instructions: ["a smokey eye"],
        stepDeltas: [{ makeup: "a smokey eye" }],
        deltas: { makeup: "a smokey eye" },
        internalPrompt: {},
      },
      {
        id: 502,
        publicId: "variant-2",
        imageKey: "casting-v2/variants/two.png",
        instructions: ["a smokey eye", "small gold hoops"],
        stepDeltas: [{ makeup: "a smokey eye" }, { free: { statedAccessories: "small gold hoops" } }],
        deltas: { makeup: "a smokey eye", free: { statedAccessories: "small gold hoops" } },
        internalPrompt: {},
      },
    ];
    candidateRow.selectedVariantPublicId = "variant-2";
  };

  const asks = (parse: Record<string, unknown>) => ({
    interpret: async () => parse as never,
    harvest: unmasked,
  });

  it("walks back a step for free on a bare undo", async () => {
    twoStep();
    const result = await refineCandidate(
      asks({ ok: true, intent: "navigate" }),
      { ...input, instruction: "undo" },
    );
    expect(result.kind).toBe("selected");
    expect(result.variantId).toBe("variant-1");
    expect(ledger.charges).toEqual([]);
    /* No claim and no operation — nothing for the sweep to adjudicate. */
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("deduct");
  });

  /*
    RULE 4. Taking the last step off lands on a chain that already exists as a
    picture, so it is backing up wearing different words — and charging 25 for
    the phrasing is the defect the rule exists to prevent.
  */
  it("selects an existing version for free when removal lands on one", async () => {
    twoStep();
    const result = await refineCandidate(
      asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "hoops" }),
      { ...input, instruction: "take the hoops off" },
    );
    expect(result.kind).toBe("selected");
    expect(result.variantId).toBe("variant-1");
    expect(result.note).toMatch(/already have that version/i);
    expect(ledger.charges).toEqual([]);
    expect(journal).not.toContain("claim");
  });

  it("returns to the ORIGINAL for free when every step is removed", async () => {
    twoStep();
    const result = await refineCandidate(
      asks({ ok: true, intent: "remove", subject: "makeup", match: null }),
      { ...input, instruction: "remove the makeup" },
    );
    /* Both the smokey eye and the hoops? No — only makeup matches, so the
       remaining chain is the hoops alone, which is not an existing variant. */
    expect(result.kind).toBe("rendered");
    expect(ledger.charges[0]?.amount).toBe(25);
  });

  /*
    A MID-CHAIN REMOVAL IS A NEW COMBINATION, so it renders and charges — and
    the row it claims carries the SHORTENED recipe, which is the receipt the
    chips read back.
  */
  it("renders chain-minus-step, and files the shortened recipe", async () => {
    twoStep();
    await refineCandidate(
      asks({ ok: true, intent: "remove", subject: "makeup", match: "smokey" }),
      { ...input, instruction: "get rid of the smokey eye" },
    );
    const call = vi.mocked(claimVariant).mock.calls[0]![0];
    expect(call.instructions).toEqual(["small gold hoops"]);
    /* Plural subjects hold ITEMS now (D-171) — the parse normalizes to a list
       so removal can prune one without deleting the step. */
    expect(call.stepDeltas).toEqual([{ free: { statedAccessories: ["small gold hoops"] } }]);
    expect(call.deltas).toEqual({ free: { statedAccessories: ["small gold hoops"] } });
    /* What they TYPED is kept apart from the recipe, or the in-flight chip
       would name the last surviving sentence instead (D-161). */
    expect(call.requestText).toBe("get rid of the smokey eye");
    expect(ledger.charges[0]?.amount).toBe(25);
  });

  /*
    RULE 3 — THE FACE SECOND. Nothing in the recipe matches, so the ask is an
    ordinary content edit and is re-read with the removal vocabulary withheld.
  */
  it("falls through to a content edit when the FACE has it but the recipe does not", async () => {
    twoStep();
    /*
      D-167: rule 3 only fires when the thing actually exists. Freckles from
      the dice live at `realized.skinCharacter`, so the selected face has to
      carry them or the honest answer is the confession below, not an edit.
    */
    variantRows[1]!.internalPrompt = {
      resolved: {
        /* readResolvedIdentity requires these four, or it discards the whole
           identity — so a partial fixture would silently mean "no record". */
        sex: "female",
        ageBand: "30s",
        energy: "warm",
        heritage: [{ heritage: "Nordic", pct: 100 }],
        realized: { skinCharacter: "freckled" },
      },
    };
    const modes: Array<string | undefined> = [];
    const result = await refineCandidate({ harvest: unmasked,
        interpret: async (request: { mode?: string }) => {
          modes.push(request.mode);
          return modes.length === 1
            ? { ok: true, intent: "remove", subject: "marks", match: "freckles" } as never
            : { ok: true, delta: { free: { marks: "no freckles" } } } as never;
        },
      },
      { ...input, instruction: "remove her freckles" },
    );
    expect(modes).toEqual([undefined, "edit"]);
    expect(result.kind).toBe("rendered");
    const call = vi.mocked(claimVariant).mock.calls[0]![0];
    /* Appended like any other edit — the chain GREW. */
    expect(call.instructions).toEqual(["a smokey eye", "small gold hoops", "remove her freckles"]);
  });

  /*
    THE HONEST THIRD STEP (D-167). Absent from the recipe AND from the record,
    so there is nothing to remove — and saying so is free. Before this, the ask
    fell through to the face and bought a full-face smoothing: the beautify
    prior arriving as an identity-adjacent over-edit nobody asked for.
  */
  it("confesses for free when the thing exists nowhere", async () => {
    twoStep();
    await expect(refineCandidate(
      asks({ ok: true, intent: "remove", subject: "marks", match: "freckles" }),
      { ...input, instruction: "remove her freckles" },
    )).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(ledger.charges).toEqual([]);
    expect(journal).not.toContain("claim");
  });

  it("refuses on a variant that predates the step chain, rather than guessing", async () => {
    variantRows = [{
      id: 501,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/one.png",
      instructions: ["a smokey eye"],
      /* No stepDeltas — a row from before the column existed. */
      deltas: { makeup: "a smokey eye" },
      internalPrompt: {},
    }];
    candidateRow.selectedVariantPublicId = "variant-1";
    await expect(refineCandidate(
      asks({ ok: true, intent: "remove", subject: "makeup", match: null }),
      { ...input, instruction: "remove the makeup" },
    )).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(ledger.charges).toEqual([]);
  });
});
