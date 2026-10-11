/**
 * PICK SEVERAL CASTS AND FILE THEM IN ONE GO (card #2251, rung N2c — his Desk
 * reply #273, verbatim and entire: *"N2c — Campaigns"*).
 *
 * The library's multi-select, as rules free of React so they can be driven
 * directly. The page holds the ticked ids; everything it decides about them is
 * here:
 *
 *  - **A selection belongs to the view it was made in.** It is keyed on the
 *    chip and the search text, and a new key empties it — a hidden selection
 *    acting on casts the customer can no longer see is the surprise the card
 *    refuses (*"the selection clears when the chip or the search text
 *    changes"*).
 *  - **Only a cast still on screen counts.** A cast deleted or taken out of
 *    this campaign drops out of the selection by itself, so the bar never
 *    files a cast the grid no longer draws.
 *  - **A batch the server would refuse is never sent.** The campaign doors take
 *    at most `CAMPAIGN_CASTS_PER_CALL` ids, and a selection can be longer once
 *    the grid has paged, so it goes in slices.
 *  - **A run that stops half way says what it did, not what it meant to do**
 *    (card #2275). The slices made the counts a partial fact, and the first
 *    shape threw that fact away: one refused slice toasted *"Those casts
 *    couldn't be added"* over casts that were already filed, and left every
 *    one of them ticked. `runInBatches` keeps the two halves apart.
 */

import type { RosterChip } from "./rosterChips";

/**
 * The most casts one `addCastsToCampaign` / `removeCastsFromCampaign` call
 * takes — the server's `CAMPAIGN_CASTS_PER_CALL_MAX` (`server/db/castCampaigns.ts`).
 * A copy the browser can import; `castSelection.test.ts` reddens if the two
 * ever disagree.
 */
export const CAMPAIGN_CASTS_PER_CALL = 60;

/** The view a selection was made in. A different key means a different view. */
export function selectionViewKey(chip: RosterChip, search: string): string {
  const where = chip.kind === "campaign" ? `campaign:${chip.campaignId}` : chip.kind;
  return `${where}|${search}`;
}

/** The selection with `castId` ticked if it was not, and unticked if it was. */
export function togglePick(selected: ReadonlySet<string>, castId: string): Set<string> {
  const next = new Set(selected);
  if (next.has(castId)) next.delete(castId);
  else next.add(castId);
  return next;
}

/** The ticked casts the grid still draws, in the grid's own order. */
export function pickedInView(
  selected: ReadonlySet<string>,
  shown: readonly { castId: string }[],
): string[] {
  if (selected.size === 0) return [];
  return shown.filter((cast) => selected.has(cast.castId)).map((cast) => cast.castId);
}

/** `ids` in slices the campaign doors accept. */
export function castIdBatches(ids: readonly string[], size = CAMPAIGN_CASTS_PER_CALL): string[][] {
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += size) {
    batches.push(ids.slice(start, start + size));
  }
  return batches;
}

/**
 * WHAT A RUN OF SLICES ACTUALLY DID — card #2275, found by the relay's
 * milestone-close review of N2c.
 *
 * ⚠ **THE DEFECT THIS REPLACES IS A SENTENCE THAT CONTRADICTED THE DATABASE.**
 * The page ran the slices in a bare `try` and reported from the `catch`, so a
 * selection of 63 whose SECOND call was refused — a cast deleted in another tab
 * is enough, the door is all-or-nothing at its refusal
 * (`server/db/castCampaigns.ts`) — told the customer *"Those casts couldn't be
 * added"* while 60 of them sat filed, and left all 63 ticked. Pressing Add
 * again then read *"All 63 are already in it"*, which is the only way they
 * would ever have found out.
 *
 * So the two halves are kept apart and both are returned:
 *
 *  - `moved` — what the server says it newly filed or took out, summed over the
 *    calls that completed. The server's count, never the number ticked.
 *  - `answered` — how many ids those calls covered, which is what `moved` is a
 *    count *out of*: 60 of 63, not 60 of 60.
 *  - `unreached` — the ids no completed call covered: the refused slice (which
 *    filed nothing) and everything after it. The page re-ticks exactly these,
 *    so a second press retries the remainder instead of re-sending work that
 *    already landed.
 *  - `error` — the refusal that stopped the run, or `undefined`. Returned
 *    rather than rethrown, because the caller has to say the `moved` half
 *    before it says this one.
 *
 * It takes the call as a function so this is drivable without React, a server
 * or a network — which is how card #2275's own arm reaches the second slice.
 */
export type BatchRunOutcome = {
  moved: number;
  answered: number;
  unreached: string[];
  error?: unknown;
};

export async function runInBatches(
  castIds: readonly string[],
  call: (batch: string[]) => Promise<number>,
): Promise<BatchRunOutcome> {
  let moved = 0;
  let answered = 0;
  for (const batch of castIdBatches(castIds)) {
    try {
      moved += await call(batch);
    } catch (error) {
      /* The refused slice filed nothing, so it belongs with the untried rest. */
      return { moved, answered, unreached: castIds.slice(answered), error };
    }
    answered += batch.length;
  }
  return { moved, answered, unreached: [] };
}

function castMembers(count: number): string {
  return count === 1 ? "1 cast member" : `${count} cast members`;
}

/** The bar's own count. */
export function selectedLabel(count: number): string {
  return `${count} selected`;
}

/**
 * What filing said, in the customer's terms. `asked` is how many were ticked,
 * `added` how many the server newly filed — a cast already in the campaign is
 * not filed twice, and the sentence says so rather than overstating.
 */
export function filedSentence(added: number, asked: number, campaignName: string): string {
  const where = `“${campaignName}”`;
  if (added === 0) {
    return asked === 1 ? `Already in ${where}.` : `All ${asked} are already in ${where}.`;
  }
  const already = asked - added;
  return already > 0
    ? `${castMembers(added)} added to ${where}. ${already} ${already === 1 ? "was" : "were"} already in it.`
    : `${castMembers(added)} added to ${where}.`;
}

/**
 * What unfiling said. Taking a cast out of a campaign never deletes the cast,
 * and the sentence says "taken out of", never "removed" on its own.
 */
export function unfiledSentence(removed: number, asked: number, campaignName: string): string {
  const where = `“${campaignName}”`;
  if (removed === 0) {
    return asked === 1 ? `Not in ${where}.` : `None of them are in ${where}.`;
  }
  const absent = asked - removed;
  return absent > 0
    ? `${castMembers(removed)} taken out of ${where}. ${absent} ${absent === 1 ? "wasn't" : "weren't"} in it.`
    : `${castMembers(removed)} taken out of ${where}.`;
}

/**
 * THE OTHER HALF OF A STOPPED RUN — the casts no call reached (card #2275).
 *
 * It says the count and what happens to them, and that is the whole sentence:
 * the refusal's own words go to the console (`logRawFailure`) rather than into
 * a third clause here. A customer who has just filed 60 casts needs to know
 * which ones did not land and that a second press will try them — *"Cast not
 * found"* in front of that is the pipeline talking.
 */
export function unreachedSentence(left: number, action: "add" | "remove"): string {
  const verb = action === "add" ? "be added" : "be taken out";
  const them = left === 1 ? "It's" : "They're";
  return `${left} couldn't ${verb}. ${them} still selected, so you can try again.`;
}
