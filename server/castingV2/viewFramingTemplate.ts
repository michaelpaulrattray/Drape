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
 * # What is pinned here and why each pin exists
 *
 * ⚠ **THE SHA256 IS THE POINT OF THIS TABLE, NOT DECORATION.** The court that
 * decides whether this ships measures SPECIFIC BYTES, and the object it
 * measures lives in a bucket anybody with the credential can overwrite. A
 * template silently replaced is a live money surface rendering against a
 * picture nothing ever measured, with no error anywhere. So the key and the
 * digest travel together, the render refuses a mismatch the way
 * `/api/ink-design/:designId` refuses bytes whose digest is not the one its row
 * records, and `viewFramingTemplate.test.ts` holds each digest equal to the
 * TRACKED source in `assets/views/` — the artifact a reviewer can open.
 *
 * ⚠ **AND THE TABLE IS DELIBERATELY NOT `Record<CastViewAngle, …>`.** Two of the
 * five package views — `threeQuarter` and `sideClose` — declare an EMPTY
 * geometric band: their whole framing test is a head's TURN and a profile's
 * CONCEALMENT, which `viewFramingGeometry.ts` says in as many words no
 * silhouette can answer. A template for those two could not be judged by the
 * measured checker this card built, so shipping one would be shipping an
 * unmeasured change to a paid render. They are ABSENT by decision, the absence
 * is this comment, and the slice that gives them one is #1612's own remainder
 * with his eye as the only available judge. A `Partial` record is what lets the
 * absence be a fact rather than an empty string.
 *
 * # The read path, and why it is not `storageGet`
 *
 * A render reference needs BYTES. `storageGet` returns a public URL and handing
 * a provider a URL is the thing `storageReadBytes`' own docblock exists to
 * avoid. The read is cached per process on SUCCESS only: a Sign is five views,
 * so a transient miss costs at most five retries and a miss cached for the life
 * of a process would turn one blip into a deploy's worth of untemplated Signs.
 *
 * **Every failure answers `null`, and `null` means the request the view always
 * sent, byte for byte.** That is path E's rule and his: a plate that does not
 * land never fails a Sign, and neither does this.
 */
import { createHash } from "node:crypto";

import { createModuleLogger } from "../logging/logger";
import { storageReadBytes } from "../storage";
import type { CastViewAngle } from "../../shared/boardTypes";
import type { CastPronouns } from "./castPronouns";

const log = createModuleLogger("castingV2/viewFramingTemplate");

/** What a view render is handed, or `null` when there is no template for it. */
export type ViewFramingTemplate = {
  readonly bytes: Buffer;
  readonly contentType: string;
};

type TemplateRecord = {
  /** Relative storage key — `storageReadBytes` normalises it. */
  readonly key: string;
  /** The sha256 of the tracked source in `assets/views/`, lowercase hex. */
  readonly sha256: string;
};

/**
 * The bucket prefix. `assets/` is where every static object this product serves
 * already lives; `views/` is this card's own corner of it.
 *
 * ⚠ **`ASSETS_BASE_URL` is NOT how this is reached and must not be used here.**
 * It is built from `VITE_ASSETS_BASE_URL`, a CLIENT variable absent from
 * `server/_core/env.ts`'s schema entirely, with a hard-coded DEV bucket
 * fallback — so a server process reaching for it on production silently
 * addresses the dev bucket. Every object under `assets/` has been fetched by
 * the browser until now; this is the first server-side reader and it uses the
 * storage client, which reads the bucket the server is actually configured for.
 */
export const VIEW_FRAMING_TEMPLATE_PREFIX = "assets/views";

/**
 * THE TEMPLATES, keyed by the view each one frames.
 *
 * Absent entries are a decision — see this file's header.
 */
export const VIEW_FRAMING_TEMPLATES: Readonly<Partial<Record<CastViewAngle, TemplateRecord>>> = {
  closeUp: {
    key: `${VIEW_FRAMING_TEMPLATE_PREFIX}/closeUp-framing-template.png`,
    sha256: "e23d01ff6a295e1544b3283009b2334e57656476cf96be9d85e83f7e882f8462",
  },
  frontFull: {
    key: `${VIEW_FRAMING_TEMPLATE_PREFIX}/frontFull-framing-template.png`,
    sha256: "e02f1c354c81c2eecc3ed7212e96ddf531d0c9f7218d21d34039f8c018deb42c",
  },
  backFull: {
    key: `${VIEW_FRAMING_TEMPLATE_PREFIX}/backFull-framing-template.png`,
    sha256: "f362762a8d12b47e389ce4c1fbb3056179b311ccc0ea1ee5f6cbbb52c273887e",
  },
};

/** The tracked source every digest above is taken from. */
export function framingTemplateSourcePath(angle: CastViewAngle): string {
  return `assets/views/${angle}-framing-template.png`;
}

/**
 * THE SENTENCE THAT MAKES THE PICTURE SAFE TO SEND — his ruling, verbatim:
 * *"the prompt should be explicit to the image engine that the reference is
 * merely a reference"*.
 *
 * ⚠ **THE ORDINAL IS A PARAMETER AND NEVER A CONSTANT, and #1480 is the worked
 * example of why.** The request's references are
 * `[anchor, ...inkCrops, outfitReference, framingTemplate]`, so a Cast with
 * three tattoos and a wardrobe plate carries her template at reference 6. A
 * constant here would point a paid render at a picture of her elbow and call it
 * the framing.
 *
 * It is written in the register of the sentences around it — the identity
 * sentence and the outfit clause both open by NAMING what a reference is and
 * then bounding what may be taken from it — and it says the bounding half twice,
 * once positively and once negatively, because that is the half that protects
 * the identity axis.
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
 * Cached on SUCCESS only — see the header. Module-level, so it is per process
 * and dies with it; a template changes by a deploy, never under a running
 * server.
 */
const cache = new Map<CastViewAngle, ViewFramingTemplate>();

/** Test seam only — no production caller. */
export function resetViewFramingTemplateCache(): void {
  cache.clear();
}

/**
 * Read this view's framing template, or answer `null`.
 *
 * ⚠ **IT NEVER THROWS, AND THAT IS THE CONTRACT RATHER THAN POLITENESS.** Its
 * caller is inside the paid render loop of a Sign. A storage blip, a missing
 * object, a truncated upload or a digest that does not match must each cost the
 * customer a slightly less well-framed picture, never the picture.
 */
export async function readViewFramingTemplate(
  angle: CastViewAngle,
  dependencies: {
    readBytes?: (key: string) => Promise<{ bytes: Buffer; contentType: string }>;
  } = {},
): Promise<ViewFramingTemplate | null> {
  const record = VIEW_FRAMING_TEMPLATES[angle];
  if (!record) return null;

  const cached = cache.get(angle);
  if (cached) return cached;

  const readBytes = dependencies.readBytes ?? storageReadBytes;
  let read: { bytes: Buffer; contentType: string };
  try {
    read = await readBytes(record.key);
  } catch (error) {
    log.warn(
      { angle, key: record.key, error: error instanceof Error ? error.message : String(error) },
      "[viewFramingTemplate] the framing template could not be read — rendering this view "
      + "without it, which is the request this road sent before #1612 part 3",
    );
    return null;
  }

  const digest = createHash("sha256").update(read.bytes).digest("hex");
  if (digest !== record.sha256) {
    /*
      ERROR rather than WARN, and the two are different facts: a read that failed
      is an outage, and a read that SUCCEEDED and returned the wrong bytes is an
      object somebody changed under a measured money surface. Nobody should have
      to notice this one in a log tail.
    */
    log.error(
      { angle, key: record.key, expected: record.sha256, found: digest },
      "[viewFramingTemplate] the stored framing template is not the picture this build "
      + "measured — rendering this view without it. The object in the bucket has been "
      + "replaced, or the upload is incomplete",
    );
    return null;
  }

  const template: ViewFramingTemplate = { bytes: read.bytes, contentType: read.contentType };
  cache.set(angle, template);
  return template;
}
