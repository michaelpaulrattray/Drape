import type { ResolvedIdentity } from "./castingIntent";
import type { HairStyle, WornState } from "../../shared/castingRealization";
import { TEXTURE_BY_HERITAGE, TEXTURE_DEFAULT, stylesFor, wornStatesFor } from "./hairStyles";
import { applyTasteWrite, type TasteWrite } from "./axisRegistry";

/**
 * The sheet variance budget — a paid sheet where the pick doesn't matter
 * carries no information.
 *
 * THE SHEET THAT FORCED IT. A follow of a blonde candidate under "a females 23
 * high fashion editorial casting for Versace" came back an eight-way tie. Every
 * rule was individually correct — the follow anchored sex, heritage and colour,
 * the captured direction locked the look, the stated age locked the band, the
 * category put hair at silhouette tier — and their INTERSECTION left nothing
 * alive that separates two tiles at arm's length.
 *
 * # WHY THIS COUNTS SIGNATURES AND NOT AXES
 *
 * The first version counted live AXES: how many of cut, texture, worn state,
 * beard and the rest carried more than one value across the eight. It cleared
 * its own floor on the re-rolled Versace sheet — five live axes — and the sheet
 * still had five identical low buns in the middle of it. "Cut has at least two
 * distinct values" is true of a sheet with seven of one cut and one of another.
 *
 * Axes were a proxy for what the eye measures, and that sheet is the proof they
 * proxy badly. The founder's ruling: measure the **tile signature** — the
 * visible styling tuple — because that is what a person actually compares.
 *
 * # AND WHY IT IS A CAP, NOT A FLOOR
 *
 * **No more than two tiles may share a full styling signature.** A matching
 * pair reads as family; three or more reads as a wall. A floor on distinct
 * counts would let one big cluster hide behind a scatter of singletons; a cap
 * addresses the cluster directly, which is the thing that was visible.
 *
 * # WHY THIS DOES NOT FIGHT THE DRIFT RULING
 *
 * The follow ruling says most tiles hold the anchor's cut and two or three
 * drift, and that stands untouched — because **a low bun and the same hair worn
 * loose are the same cut, worn differently.** The release breaks a cluster from
 * the least authoritative end first: worn state, then texture, then an adjacent
 * cut only if those were not enough. Five tiles holding the cut is the ruling
 * working. Five identical buns was never what it promised.
 *
 * A stated lock is never touched, at any rung. A sheet that quietly varies a
 * fact the user pinned is a worse failure than a boring sheet, because the
 * boring one is at least honest — and the honest answer to "everything is
 * held" is the confession, before the money moves.
 */

/**
 * What a viewer compares at tile scale.
 *
 * Deliberately the STYLING tuple and not the whole identity: eye colour and
 * skin character are real differences that do not read across a contact sheet,
 * and counting them is how the axis metric talked itself into calling five
 * identical buns a varied sheet.
 */
export function signatureOf(identity: ResolvedIdentity): string {
  const realized = identity.realized;
  return [
    realized?.hairStyle?.name ?? "∅",
    realized?.wornState ?? "∅",
    realized?.hairTexture ?? "∅",
    identity.hair?.colour ?? "∅",
    realized?.facialHair ?? "∅",
  ].join("|");
}

/** No more than a pair. Three of anything is a wall. */
export const SIGNATURE_CAP = 2;

/** Positions that are the third-or-later member of their signature cluster. */
export function excessPositions(sheet: readonly ResolvedIdentity[]): number[] {
  const seen = new Map<string, number>();
  const excess: number[] = [];
  sheet.forEach((identity, position) => {
    const signature = signatureOf(identity);
    const count = (seen.get(signature) ?? 0) + 1;
    seen.set(signature, count);
    if (count > SIGNATURE_CAP) excess.push(position);
  });
  return excess;
}

/** How many tiles carry a signature nobody else on the sheet shares plus pairs. */
export function distinctSignatures(sheet: readonly ResolvedIdentity[]): number {
  return new Set(sheet.map(signatureOf)).size;
}

/**
 * The rungs, least authoritative first.
 *
 * Worn state before texture before cut is the founder's order and it is also
 * the order of increasing commitment: how you wear your hair this morning,
 * then how it grows, then what you asked the barber for. The cut is last
 * precisely because the drift ruling owns it.
 */
export const RELEASE_LADDER = ["worn-state", "texture", "adjacent-cut"] as const;
export type ReleaseRung = (typeof RELEASE_LADDER)[number];

export type VarianceReport = {
  /** Distinct styling signatures across the sheet, after any release. */
  distinct: number;
  /** Tiles that still share a signature with two or more others. */
  stillClustered: number;
  /** Which rungs were actually spent. */
  released: ReleaseRung[];
  /** True when tiles remain clustered because everything else is stated. */
  confess: boolean;
};

export type ReleaseContext = {
  rollSeed: string;
  /** The brief stated its own hair — nothing here may touch it. */
  hairStated: boolean;
  /** The brief stated facial hair. Not a rung, but it bounds the signature. */
  facialHairStated: boolean;
};

function hashOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function pick<T>(values: readonly T[], seed: number): T {
  return values[seed % values.length];
}

/**
 * Free the excess members of every signature cluster, cheapest rung first.
 *
 * Runs after the taste pass and before composition, so the persisted identity
 * is the person the prompt describes. Each rung is tried across all remaining
 * excess tiles before the next is reached — cheapest change that works, rather
 * than escalating tile by tile.
 */
export function breakSignatureClusters(
  sheet: readonly ResolvedIdentity[],
  context: ReleaseContext,
): { sheet: ResolvedIdentity[]; report: VarianceReport } {
  /*
    Deference wins outright. When the brief states its own hair, none of the
    authored hair reaches the prompt at all — so changing it here would edit a
    record the image never saw, which is the exact record-vs-prompt lie this
    codebase has now fixed three times.
  */
  if (context.hairStated) {
    const clustered = excessPositions(sheet).length;
    return {
      sheet: [...sheet],
      report: {
        distinct: distinctSignatures(sheet),
        stillClustered: clustered,
        released: [],
        confess: clustered > 0,
      },
    };
  }

  let working = [...sheet];
  const released: ReleaseRung[] = [];

  for (const rung of RELEASE_LADDER) {
    const excess = excessPositions(working);
    if (excess.length === 0) break;

    let changedAny = false;
    for (const position of excess) {
      const changed = applyRung(rung, working, position, context);
      if (changed) {
        working[position] = changed;
        changedAny = true;
      }
    }
    if (changedAny) released.push(rung);
  }

  const stillClustered = excessPositions(working).length;
  return {
    sheet: working,
    report: {
      distinct: distinctSignatures(working),
      stillClustered,
      released,
      /*
        Confession is not a failure mode, it is the honest one. If the ladder
        is spent and tiles still match, the sheet genuinely cannot vary — and
        saying so BEFORE the roll is worth more than spending the user's
        credits on near-copies and letting them find out.
      */
      confess: stillClustered > 0,
    },
  };
}

/** One tile, one rung. Returns null when this rung has nothing to offer here. */
function applyRung(
  rung: ReleaseRung,
  sheet: readonly ResolvedIdentity[],
  position: number,
  context: ReleaseContext,
): ResolvedIdentity | null {
  const identity = sheet[position];
  const realized = identity.realized;
  if (!realized?.hairStyle) return null;

  const seed = hashOf(`${context.rollSeed}:cluster:${rung}:${position}`);
  const taken = new Set(sheet.map(signatureOf));

  if (rung === "worn-state") {
    /*
      The cheapest and most legible break, and the reason this whole ladder
      does not violate the drift ruling: the cut is unchanged. A low bun and
      the same hair worn loose are the same haircut, worn differently.

      A cut whose own NAME says how it is worn cannot be re-worn — "a ponytail,
      worn loose" is a contradiction — so those tiles fall through to texture.
    */
    if (realized.hairStyle.worn) return null;
    const options = wornStatesFor(realized.hairStyle.family).filter(
      (value) => value !== realized.wornState,
    );
    return firstFreeing(options, taken, (value) =>
      withRealized(identity, { wornState: value as WornState }),
    );
  }

  if (rung === "texture") {
    // A cut that dictates its own texture keeps it; legality outranks variety.
    if (realized.hairStyle.texture) return null;
    const primary = identity.heritage?.[0]?.heritage ?? "";
    const shelf = (TEXTURE_BY_HERITAGE[primary] ?? TEXTURE_DEFAULT).map(([value]) => value);
    const options = shelf.filter((value) => value !== realized.hairTexture);
    return firstFreeing(options, taken, (value) =>
      withRealized(identity, { hairTexture: value as never }),
    );
  }

  // adjacent-cut — last, because the drift ruling owns the cut.
  const pool = adjacentCuts(identity, realized.hairStyle);
  if (pool.length === 0) return null;
  const ordered = [...pool.slice(seed % pool.length), ...pool.slice(0, seed % pool.length)];
  return firstFreeing(ordered, taken, (style) => {
    const cut = style as HairStyle;
    return withRealized(identity, {
      hairStyle: cut,
      // The cut carries its own worn state and texture when it declares them.
      ...(cut.worn ? { wornState: cut.worn } : {}),
      /*
        A shaved cut has no grain, so a release onto one drops the texture it
        was carrying rather than stranding a wave on a scalp. Otherwise the
        cut's own dictation wins, and a texture-agnostic cut keeps what it had —
        the release is spending variance on the CUT here, not on the grain.
      */
      ...(cut.family === "shaved"
        ? { hairTexture: null }
        : cut.texture
          ? { hairTexture: cut.texture }
          : {}),
    });
  });
}

/** The first option whose resulting signature nobody else already holds. */
function firstFreeing<T>(
  options: readonly T[],
  taken: ReadonlySet<string>,
  build: (option: T) => ResolvedIdentity,
): ResolvedIdentity | null {
  for (const option of options) {
    const candidate = build(option);
    if (!taken.has(signatureOf(candidate))) return candidate;
  }
  return null;
}

/**
 * Routed through the registry's write surface rather than spreading in place.
 *
 * The release ladder is the third writer of the cut, after resolution and the
 * sheet taste pass, and a bare spread here is what let `hair.family` drift back
 * out of step with `hairStyle.family` after D-87's first repair. Going through
 * `applyTasteWrite` means the mirror is maintained for this writer the same way
 * it is for the other one, without this module knowing the mirror exists.
 */
function withRealized(identity: ResolvedIdentity, change: TasteWrite): ResolvedIdentity {
  return applyTasteWrite(identity as never, change) as ResolvedIdentity;
}

/** Other cuts this face could plausibly walk in with — never cross-list. */
function adjacentCuts(identity: ResolvedIdentity, held: HairStyle): HairStyle[] {
  const primary = identity.heritage?.[0]?.heritage ?? "";
  const sex = identity.sex;
  const ageBand = identity.ageBand;
  if (!sex || !ageBand) return [];
  return stylesFor(sex, primary, ageBand)
    .map(([style]) => style)
    .filter(
      (style) =>
        style.family === held.family && style.name !== held.name && !style.statement,
    );
}

/**
 * What the echo says when the sheet cannot be freed.
 *
 * Before the roll, not after. The user is about to spend credits on eight faces
 * that will differ mainly in expression, and they are entitled to know that
 * while it is still a decision.
 */
export const VARIANCE_CONFESSION =
  "Most of this sheet is held — the eight will differ mainly in expression.";
