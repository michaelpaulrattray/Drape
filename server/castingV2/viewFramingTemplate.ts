/**
 * THE STORED FRAMING REFERENCE — #1612 part 3, his addition of 2026-09-30.
 *
 * His words, verbatim: *"another way to get what you want is to provide stored
 * reference images such as templates of what we are asking for?"* and, on the
 * relay's yes: *"yes the prompt should be explicit to the image engine that the
 * reference is merely a reference"*.
 *
 * One picture per view, showing the CROP and nothing else: a featureless matte
 * grey mannequin form on a plain ground, composed so that the view's own
 * declared band is satisfied by the template itself. It rides beside the master
 * on the view render, the prompt names it as a framing reference and forbids
 * taking anything else from it, and the customer never sees it and never
 * chooses it.
 *
 * ⚠ **THE COURT SAYS IT DOES NOT SHIP, SO NOTHING IN THE PRODUCT CALLS THIS
 * FILE, AND THAT IS A VERDICT RATHER THAN AN OVERSIGHT** — #1612, 2026-10-03.
 * The uncalled-export sweep and `check-cleanup-dispositions` will list these
 * symbols; the honest reading is **measured and declined**, which is a different
 * road from the *written, wired never* deaths `CLAUDE.md`'s access-control
 * section enumerates, and the difference is this paragraph plus the numbers on
 * the card. Its one consumer is the court that produced the verdict
 * (`scripts/_1612-template-court-disposable.mts`). **The wire into
 * `packageOrchestrator` was built, tested and sabotage-driven first, and then
 * taken back out** — it is in this branch's own history at `0ac5d2ef1` if a
 * later attempt wants it, and it was removed rather than merged dark because a
 * tree holding both the templates and the wire has the feature ON, which is
 * precisely what the measurement says must not happen. His ship test was *"the
 * template ships only if the in-band share rises on at least the close-up
 * without raising identity refusals"*; driven on his own two fixtures at five
 * renders an arm, the in-band share was **2 of 10 in both arms**. The crop does
 * move — cast 56's median room-below went 0.509 → 0.423 and every templated
 * render landed below the untemplated median — so the engine reads the picture;
 * the bound is 0.30, so reading it is not the same as obeying it. Nothing here
 * is wired on production, and the card carries the numbers.
 *
 * # Why the picture carries no features at all, and that is the whole design
 *
 * The one risk this change runs is the opposite of the one it fixes: an engine
 * that borrows a FACE from the template trips the identity axis, and identity
 * is the single axis that still refuses and refunds (#1612 part 2). His own
 * ruling names the guard — *"an anonymous silhouette or a neutral,
 * non-identifying face — never a real person's face"* — and the templates go
 * further than it asks, because a form with no eyes, no mouth, no hair, no skin
 * texture and no clothing has nothing an engine could borrow even if the
 * sentence below failed. **The prose is the belt and the picture is the braces.**
 *
 * # ⚠ IT IS READ OFF DISK AND NOT OUT OF THE BUCKET, AND THAT WAS FORCED BY A
 * MEASUREMENT RATHER THAN CHOSEN
 *
 * The card says the template *"lives in the bucket under `assets/` like every
 * other static asset"*, and the first build of this module did exactly that —
 * `storageReadBytes` on a relative key, cached per process, fail-soft. **Path
 * E's own suite refused it**, and it was right to: `packageOrchestratorPlate`
 * asserts that *the three views which do not wear the plate never wait for it*,
 * and with an `await` on a bucket read above the attempt loop the close-up
 * stopped dispatching in the first tick while its two untemplated siblings went
 * straight out. A per-render network fetch for a **deploy-constant** asset was
 * the wrong shape, and his own first line about path E is what exposed it.
 *
 * So the bytes come from the deployed tree, synchronously, on first use. There
 * is no network in a paid render's dispatch path, nothing to cache-invalidate,
 * and the bytes a reviewer can open in `assets/views/` are literally the bytes
 * that would be sent.
 *
 * ⚠ **THE STATED UNKNOWN, because a shortcut is only permitted declared: it is
 * NOT PROVEN that `assets/` reaches the production container.** Nothing in this
 * repository reads a tracked non-`dist/` file on the production path today —
 * `migrationLag.ts` reads `drizzle/meta/_journal.json`, but only from its
 * DEV-boot consumer — so the one comparable case proves nothing about
 * production. It fails in the safe direction and that is the whole reason it is
 * acceptable in a rig that is not shipping: a file that is not there answers
 * `null`, and `null` is a request byte-identical to the one this road has
 * always sent. **A shipping version must PROVE the file is present rather than
 * inherit this sentence.**
 *
 * # What is pinned here and why each pin exists
 *
 * ⚠ **THE SHA256 IS THE POINT OF THIS TABLE, NOT DECORATION.** The court that
 * decides whether this ships measures SPECIFIC BYTES, and a reader has no other
 * way to know that the picture in the tree is still the picture that was
 * measured. A template recut, recompressed or replaced by a well-meaning edit
 * is a render against something nothing ever measured, with no error anywhere
 * and no symptom but a worse crop. `viewFramingTemplate.test.ts` holds each
 * digest equal to the tracked file.
 *
 * ⚠ **AND THE TABLE IS DELIBERATELY NOT `Record<CastViewAngle, …>`.** Two of the
 * five package views — `threeQuarter` and `sideClose` — declare an EMPTY
 * geometric band: their whole framing test is a head's TURN and a profile's
 * CONCEALMENT, which `viewFramingGeometry.ts` says in as many words no
 * silhouette can answer. A template for those two could not be judged by the
 * measured checker this card built, so shipping one would be shipping an
 * unmeasured change to a paid render. They are ABSENT by decision, the absence
 * is this comment, and a `Partial` record is what lets that be a fact rather
 * than an empty string.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createModuleLogger } from "../logging/logger";
import type { CastViewAngle } from "../../shared/boardTypes";
import type { CastPronouns } from "./castPronouns";

const log = createModuleLogger("castingV2/viewFramingTemplate");

/** What a view render is handed, or `null` when there is no template for it. */
export type ViewFramingTemplate = {
  readonly bytes: Buffer;
  readonly contentType: string;
};

type TemplateRecord = {
  /**
   * The tracked path, from the repository root.
   *
   * ⚠ **It is also what the bucket key would be, and that is the existing
   * convention rather than a coincidence**: `assets/ink/arm-left-template.png`
   * is tracked at that path and served from that key. So if a later slice does
   * put these in the bucket, the string does not change.
   */
  readonly file: string;
  /** The sha256 of that file, lowercase hex. */
  readonly sha256: string;
};

/** Where the templates live, in the tree and (would) in the bucket. */
export const VIEW_FRAMING_TEMPLATE_PREFIX = "assets/views";

/**
 * THE TEMPLATES, keyed by the view each one frames.
 *
 * Absent entries are a decision — see this file's header.
 */
export const VIEW_FRAMING_TEMPLATES: Readonly<Partial<Record<CastViewAngle, TemplateRecord>>> = {
  closeUp: {
    file: `${VIEW_FRAMING_TEMPLATE_PREFIX}/closeUp-framing-template.png`,
    sha256: "e23d01ff6a295e1544b3283009b2334e57656476cf96be9d85e83f7e882f8462",
  },
  frontFull: {
    file: `${VIEW_FRAMING_TEMPLATE_PREFIX}/frontFull-framing-template.png`,
    sha256: "e02f1c354c81c2eecc3ed7212e96ddf531d0c9f7218d21d34039f8c018deb42c",
  },
  backFull: {
    file: `${VIEW_FRAMING_TEMPLATE_PREFIX}/backFull-framing-template.png`,
    sha256: "f362762a8d12b47e389ce4c1fbb3056179b311ccc0ea1ee5f6cbbb52c273887e",
  },
};

/**
 * THE SENTENCE THAT MAKES THE PICTURE SAFE TO SEND — his ruling, verbatim:
 * *"the prompt should be explicit to the image engine that the reference is
 * merely a reference"*.
 *
 * ⚠ **THE ORDINAL IS A PARAMETER AND NEVER A CONSTANT, and #1480 is the worked
 * example of why.** The request's references are
 * `[anchor, ...inkCrops, outfitReference, framingTemplate]`, so a Cast with
 * three tattoos and a wardrobe plate carries her template at reference 6. A
 * constant here would point a paid render at a picture of her elbow.
 *
 * It is written in the register of the sentences around it — the identity
 * sentence and the outfit clause both open by NAMING what a reference is and
 * then bounding what may be taken from it — and it says the bounding half
 * twice, once positively and once negatively, because that is the half that
 * protects the identity axis.
 */
export function framingTemplateClause(input: {
  ordinal: number;
  pronouns: CastPronouns;
}): string {
  const { pronouns } = input;
  return (
    `THE FRAMING — reference ${input.ordinal} is not a person and is not part of this `
    + `photograph. It is a blank grey form showing ONE thing: where this picture is `
    + `cropped — how much of the subject is in frame, how it sits in the frame, and what `
    + `the edges cut. Match that crop. `
    + `Take NOTHING else from reference ${input.ordinal}: not ${pronouns.possessive} face, `
    + `features, skin, colour, hair, build, clothing, pose, expression, lighting or `
    + `background. Every one of those comes from reference 1 and the words above. `
    + `Reference ${input.ordinal} is a guide to the crop and nothing more.`
  );
}

/**
 * Read once per process on SUCCESS, and never on failure.
 *
 * A failure cached for the life of a process would turn one bad moment into a
 * deploy's worth of untemplated Signs with nothing to see; a success cannot go
 * stale, because the file changes by a deploy and a deploy is a new process.
 *
 * ⚠ **A test passes its OWN map rather than clearing this one.** A
 * `resetViewFramingTemplateCache()` export would be a symbol with no production
 * caller — which the uncalled-export sweep lists and `check-cleanup-dispositions`
 * refuses, correctly: the repository has been bitten enough times by machinery
 * that exists only for its own tests.
 */
const processCache = new Map<CastViewAngle, ViewFramingTemplate>();

/**
 * Read this view's framing template, or answer `null`.
 *
 * ⚠ **IT IS SYNCHRONOUS, AND THAT IS THE CONTRACT RATHER THAN A CONVENIENCE.**
 * Its caller composes a paid render's request, and path E's first line — *the
 * views that do not wear the plate never wait for it* — is asserted at the
 * DISPATCH ORDERING. An `await` here, however fast, takes the templated views
 * out of the first tick; `packageOrchestratorPlate.test.ts` measured exactly
 * that against this module's first, bucket-reading shape, and went red on it.
 * Nothing on this path may be asynchronous.
 *
 * ⚠ **AND IT NEVER THROWS.** A missing file, an unreadable one, or a digest
 * that does not match must each cost the customer a slightly less well-framed
 * picture, never the picture.
 */
export function readViewFramingTemplate(
  angle: CastViewAngle,
  dependencies: {
    /** Defaults to reading the deployed tree; a test hands in its own reader. */
    readFile?: (file: string) => Buffer;
    /** Defaults to the per-process store; a test passes its own for isolation. */
    cache?: Map<CastViewAngle, ViewFramingTemplate>;
  } = {},
): ViewFramingTemplate | null {
  const record = VIEW_FRAMING_TEMPLATES[angle];
  if (!record) return null;

  const cache = dependencies.cache ?? processCache;
  const cached = cache.get(angle);
  if (cached) return cached;

  const readFile = dependencies.readFile
    ?? ((file: string) => readFileSync(path.resolve(process.cwd(), file)));

  let bytes: Buffer;
  try {
    bytes = readFile(record.file);
  } catch (error) {
    log.warn(
      { angle, file: record.file, error: error instanceof Error ? error.message : String(error) },
      "[viewFramingTemplate] the framing template is not in this build — rendering this view "
      + "without it, which is the request this road sent before #1612 part 3",
    );
    return null;
  }

  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== record.sha256) {
    /*
      ERROR rather than WARN, and the two are different facts: a file that is
      MISSING is a packaging question, and a file that is PRESENT holding the
      wrong bytes is a picture somebody changed without re-measuring it. Nobody
      should have to notice this one in a log tail.
    */
    log.error(
      { angle, file: record.file, expected: record.sha256, found: digest },
      "[viewFramingTemplate] the framing template is not the picture this build measured "
      + "— rendering this view without it. The file has been changed and its court has not "
      + "been re-run",
    );
    return null;
  }

  const template: ViewFramingTemplate = { bytes, contentType: "image/png" };
  cache.set(angle, template);
  return template;
}
