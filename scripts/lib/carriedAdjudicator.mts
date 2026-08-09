/**
 * DID THE PICTURE KEEP WHAT IT PROMISED TO KEEP — judged by arithmetic, because
 * no reader can judge it (fable-109).
 *
 * # Why this instrument had to exist
 *
 * The first clean walk of segment permanence carried her freckles through three
 * more paid renders, and the verification reader called them absent on every
 * one of them: *"clear, unfreckled skin on face"*. The reader was not lying and
 * the product had not failed — the delivery was "faint light freckles" on a
 * fair redhead, which is at the reader's own measured floor. Meanwhile 20,036
 * of the segment's 24,056 pixels were byte-identical in the frame she was
 * shown.
 *
 * A carried fact is the one thing a stochastic reader must not adjudicate,
 * because the claim is not *"does this look freckled"* — it is **"are these the
 * same pixels she already paid for"**, and that is a question with an exact
 * answer. The bytes are the strongest `saw` there is: deterministic, complete,
 * and unable to be at a threshold.
 *
 * # The criterion, and why it is not a percentage
 *
 * **Every pixel the segment owns is either byte-identical in the delivered
 * frame, or accounted for by a RECORDED intersection.** Unexplained deficit is
 * the number that must be ~zero.
 *
 * A floor ("80% survives") would pass a render that lost 5% of her freckles for
 * no reason anybody wrote down, which is the measurement-window disease wearing
 * a threshold's clothes. The specimen argues it: 83.29% surviving with every
 * missing pixel recorded as an intersection is a KEPT promise; a hypothetical
 * 95% with 5% unexplained is a DEFECT.
 *
 * # The one declared tolerance
 *
 * The composite feathers its edges, so a pixel on the boundary of a claimed
 * region can differ by a blend rather than by a replacement. `FEATHER_TOLERANCE`
 * is that allowance, and it is stated as a NUMBER rather than a percentage of
 * anything: at most 64 unexplained pixels per facet, which on a 24,056-pixel
 * patch is a quarter of one percent and cannot hide a lost feature.
 */
import sharp from "sharp";

/** Unexplained pixels allowed per carried facet, for feathered boundaries. */
export const FEATHER_TOLERANCE = 64;

/**
 * The most a SMALL segment's boundary may excuse — at most a quarter of it.
 *
 * # Why the flat number stopped working the day accessories could be kept
 *
 * 64 was calibrated against the founding specimen, a 24,056-pixel freckle
 * patch, where it is a quarter of one percent and "cannot hide a lost feature".
 * The first accessory segment the product can cut is **58 pixels** — a pair of
 * hoops is two small discs — so the allowance was larger than the entire thing
 * it was judging. Every accessory carry would have passed, including one where
 * the frame contains no jewellery at all, and the table would have filled with
 * KEPT verdicts that no picture could contradict.
 *
 * That is the shape working law 2 exists for: an instrument at its floor
 * reporting a clean result. It was found by driving the adjudicator against a
 * frame it should have failed rather than by reasoning about it, which is the
 * only way this kind of thing is ever found.
 *
 * # Why a share, and why a quarter
 *
 * A feather is a ring around the boundary, so what it can honestly excuse
 * scales with the segment's PERIMETER — and on a small compact segment the
 * perimeter is a large fraction of the area (a 7-pixel disc is almost all
 * edge). A quarter is the bound that keeps every existing verdict identical —
 * anything at or above 256 pixels still gets the flat 64 — while making the
 * verdict on a hoop mean something: losing the hoop is 58 unexplained pixels
 * against an allowance of 14.
 */
export function featherToleranceFor(owned: number): number {
  return Math.min(FEATHER_TOLERANCE, Math.floor(owned / 4));
}

export type RecordedIntersection = { winner: string; loser: string; pixels: number };

export type CarriedVerdict = {
  facet: string;
  version: number;
  /** Pixels the segment's own mask claims. */
  owned: number;
  /** Of those, how many are byte-identical in the delivered frame. */
  identical: number;
  /** Pixels another source is RECORDED as having won from this segment. */
  recorded: number;
  /** Missing and not recorded anywhere — the only number that matters. */
  unexplained: number;
  kept: boolean;
};

/**
 * Judge one carried segment against the frame it was carried into.
 *
 * `intersections` are the assembly's own record for THAT render — the losses it
 * declared at the time. A deficit inside them is the compositor doing what it
 * said; a deficit beyond them is pixels that went missing with nobody
 * accounting for them.
 */
export async function adjudicateCarried(input: {
  facet: string;
  version: number;
  maskBytes: Buffer;
  contentBytes: Buffer;
  frameBytes: Buffer;
  bbox: { x: number; y: number; width: number; height: number };
  intersections: readonly RecordedIntersection[];
  tolerance?: number;
}): Promise<CarriedVerdict> {
  const mask = await sharp(input.maskBytes).removeAlpha().toColourspace("b-w").raw()
    .toBuffer({ resolveWithObject: true });
  const content = await sharp(input.contentBytes).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const frame = await sharp(input.frameBytes).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });

  let owned = 0;
  let identical = 0;
  for (let y = 0; y < input.bbox.height; y += 1) {
    for (let x = 0; x < input.bbox.width; x += 1) {
      if (mask.data[y * mask.info.width + x] === 0) continue;
      owned += 1;
      const at = (y * content.info.width + x) * content.info.channels;
      const to = ((y + input.bbox.y) * frame.info.width + (x + input.bbox.x)) * frame.info.channels;
      if (content.data[at] === frame.data[to]
        && content.data[at + 1] === frame.data[to + 1]
        && content.data[at + 2] === frame.data[to + 2]) identical += 1;
    }
  }

  /*
    Every loss the assembly declared against THIS segment, whoever won it. The
    winner does not matter to the question being asked — "was this accounted
    for" — only that somebody wrote it down at the time.
  */
  const recorded = input.intersections
    .filter((entry) => entry.loser.startsWith(`${input.facet}@`) || entry.loser === input.facet)
    .reduce((total, entry) => total + entry.pixels, 0);

  const missing = owned - identical;
  const unexplained = Math.max(0, missing - recorded);
  return {
    facet: input.facet,
    version: input.version,
    owned,
    identical,
    recorded,
    unexplained,
    kept: unexplained <= (input.tolerance ?? featherToleranceFor(owned)),
  };
}

/** One line per verdict, for a table a person reads. */
export function formatCarriedVerdict(verdict: CarriedVerdict): string {
  return `${verdict.facet}@v${verdict.version}`.padEnd(18)
    + `owned ${String(verdict.owned).padStart(7)}  `
    + `identical ${String(verdict.identical).padStart(7)}  `
    + `recorded ${String(verdict.recorded).padStart(6)}  `
    + `unexplained ${String(verdict.unexplained).padStart(6)}  `
    + (verdict.kept ? "KEPT" : "DEFICIT");
}

/**
 * EVERY CARRIED FACT ON ONE FACE, judged from its own artifacts.
 *
 * One derivation, two callers — `scripts/adjudicate-carried.mts` and the walk
 * itself. A second copy of this loop is how the CLI and the walk would come to
 * disagree about whether a face kept its freckles.
 */
export type CarriedAdjudication = {
  verdicts: Array<CarriedVerdict & { variantId: number; requestText: string }>;
  /** Carried facts that left no record to judge them by — never a pass. */
  unadjudicable: Array<{ variantId: number; facet: string; why: string }>;
};

export async function adjudicateCandidateCarries(input: {
  /** Every variant of the face, landed or not, oldest first. */
  variants: ReadonlyArray<Record<string, any>>;
  /** Every segment row of the face. */
  segments: ReadonlyArray<Record<string, any>>;
  fetchBytes: (key: string) => Promise<Buffer>;
  /** Intersections for renders whose row predates the assembly record. */
  fallbackIntersections?: Map<number, RecordedIntersection[]>;
}): Promise<CarriedAdjudication> {
  const verdicts: CarriedAdjudication["verdicts"] = [];
  const unadjudicable: CarriedAdjudication["unadjudicable"] = [];

  for (const variant of input.variants) {
    if (!variant.imageKey) continue;
    let record: any = variant.internalPrompt;
    if (typeof record === "string") { try { record = JSON.parse(record); } catch { record = null; } }
    const carried: string[] = (record?.verification?.checks ?? [])
      .filter((check: any) => check?.carried)
      .map((check: any) => check.facet);
    if (carried.length === 0) continue;

    const intersections: RecordedIntersection[] | null = record?.assembly?.intersections
      ?? input.fallbackIntersections?.get(variant.id)
      ?? null;
    if (!intersections) {
      for (const facet of carried) {
        unadjudicable.push({ variantId: variant.id, facet, why: "this render recorded no intersections" });
      }
      continue;
    }

    const frameBytes = await input.fetchBytes(variant.imageKey);
    for (const facet of carried) {
      const row = input.segments
        .filter((entry: any) => entry.facet === facet && entry.variantId !== null && entry.variantId < variant.id)
        .sort((a: any, b: any) => b.version - a.version)[0];
      if (!row) {
        unadjudicable.push({ variantId: variant.id, facet, why: "no stored segment older than this render" });
        continue;
      }
      const verdict = await adjudicateCarried({
        facet,
        version: row.version,
        maskBytes: await input.fetchBytes(row.maskKey),
        contentBytes: await input.fetchBytes(row.contentKey),
        frameBytes,
        bbox: { x: row.bboxX, y: row.bboxY, width: row.bboxW, height: row.bboxH },
        intersections,
      });
      verdicts.push({ ...verdict, variantId: variant.id, requestText: variant.requestText });
    }
  }
  return { verdicts, unadjudicable };
}
