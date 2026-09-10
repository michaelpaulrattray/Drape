/**
 * A REPLY OF HIS IS THE ACT THAT CLEARS THE ITEM HE REPLIED TO (issue #749).
 *
 * # THE INCIDENT, IN HIS WORDS
 *
 * 2026-09-10 14:05 AEST, terminal: *"for some reason the fangs desk card wont
 * dissapear even though i replied seen ages ago"*. He had replied **"seen"** on
 * the frames (#167, 09-09 08:32Z) and **"Seen"** on the card beside them (#169,
 * 12:35Z). Both were acknowledged the same night. **Twenty-nine hours and four
 * shifts later both were still drawn `open` on his desk.**
 *
 * # ⚠ IT WAS NOT AN OVERSIGHT, WHICH IS WHY A LINE OF CODE IS THE ONLY FIX
 *
 * Every one of those four shifts SAW it — `staleOpenHosts` names it on every
 * run — and three of them wrote down a deliberate decision not to act:
 * *"'Seen' says he looked; it is not a verdict, and reading one into it would
 * take the frames off his page before he has judged."* That reasoning is
 * careful, it is internally sound, and **his word overrules it**: a reply is
 * the act, and an item he has answered does not sit on his desk waiting for a
 * shift to agree that he meant it.
 *
 * A judgement three consecutive shifts got wrong in the same direction is not a
 * judgement — it is a rule nobody had written down. His own standing order of
 * 2026-08-29 had already written it: *"Mark every answered item's state in the
 * SAME edition that acknowledges its reply."*
 *
 * # THE DEFECT WAS A DETECTOR WITH NO WRITER (invariant 7)
 *
 * `scripts/lib/replyHosts.mts` has answered *which items has he replied to that
 * the page still calls open* correctly since 2026-08-29, on every run, for BOTH
 * halves of the reply namespace. Nothing has ever applied its answer. The print
 * asked a shift to type the state by hand, and a hand is exactly what four
 * shifts did not lend it.
 *
 * ⚠ **The card filed for this proposed the fix "in the sweep", and the sweep
 * cannot hold it.** `crew-desk-sweep.mts` is DB-free by construction — one
 * `gh` road, no credentials, no Railway wrapper — and the reply→item link lives
 * in `crew_replies`, in the database. So the rule lives here and the reply
 * reader, which already holds both halves, applies it.
 *
 * ⚠ **And the card scoped it to EYE ITEMS, which is one instance of the class**
 * (working law 7). `staleOpenHosts` reads the UNION of `needsYou` and
 * `eyeItems` because the schema states outright that they share one reply
 * namespace — and on the day this was written the three stale items were TWO
 * cards and one set of frames. Fixing the frames alone would have left
 * `toolbelt-socket-35` sitting open under a reply of his that says *"Done"*.
 *
 * # WHY A CARD CAN BE HELD AND A SET OF FRAMES NEVER IS
 *
 * `answered` is not a state that needs him (`crewCardNeedsHim`), so moving a
 * card into it can orphan two things the briefing schema then REFUSES at the
 * parse — an eye item that still needs him naming that card (#133), and a
 * `waiting-founder` pipeline row naming it (#291). Both questions are asked
 * through `crewCardResolution.ts`'s own exported guards rather than re-spelled
 * here, because two spellings of one schema rule drift and the drift surfaces
 * only as a rite that will not push.
 *
 * An eye item has neither dependant: nothing in the schema constrains an
 * `answered` eye item, so it is always safe to apply.
 *
 * # ⚠ EYE ITEMS ARE APPLIED FIRST, AND THAT ORDER IS LOAD-BEARING
 *
 * The fangs pair is exactly the shape it matters for: the frames name the card,
 * and both carry a reply of his. Judged card-first, the card is held by its own
 * open frames and only half his desk clears — so a plan settles the frames it is
 * about to settle before asking whether they block anything. This is the
 * same-plan exemption `crewCardResolution.ts` deleted as dead code on its own
 * road (an OPEN eye item is never promoted there); here it is live, and the
 * suite drives the pair together for that reason.
 *
 * # ⚠ THE STATE IS RE-READ IN THE BRIEFING BEING WRITTEN, NEVER TRUSTED FROM THE LIST
 *
 * The ids arrive from a reading taken against the DEPLOYED briefing — that is
 * the acknowledgement contract (`lib/liveBriefing.mts`), and it is a different
 * file from the one on disk. An id that is `open` on production may already be
 * `done` in the tree a shift is about to ship. So every id is re-checked against
 * the briefing this plan will write, and anything not `open` there is left
 * exactly as it is.
 */
import {
  type CardList,
  type ResolvableBriefing,
  eyeItemStillNeedingHim,
  waitingFounderRowNaming,
} from "./crewCardResolution.js";

/** One item this plan will move from `open` to `answered`. */
export type Acknowledgement = { list: CardList; id: string };

/** One it will NOT move, and the sentence a shift acts on. */
export type AcknowledgementHold = { list: CardList; id: string; reason: string };

export type AcknowledgementPlan = {
  apply: Acknowledgement[];
  held: AcknowledgementHold[];
};

/**
 * Plan `open` → `answered` for every briefing item he has replied to.
 *
 * `answeredHostIds` is what `staleOpenHosts` found: ids whose ACKNOWLEDGED reply
 * the page has not acted on. An id the briefing does not hold, or holds in any
 * state but `open`, is a silent no-op — this plans a repair, and an item that
 * does not need one is not a finding.
 */
export function planReplyAcknowledgements(
  briefing: ResolvableBriefing,
  answeredHostIds: readonly string[],
): AcknowledgementPlan {
  const wanted = new Set(answeredHostIds);
  const cards = briefing.needsYou ?? [];
  const eyeItems = briefing.eyeItems ?? [];
  const pipeline = briefing.pipeline ?? [];

  const apply: Acknowledgement[] = [];
  const held: AcknowledgementHold[] = [];

  /* Frames first — see the docblock. A card's guard has to be able to see the
     eye items this same plan is about to settle, or the fangs pair half-clears. */
  const settling = new Set<string>();
  for (const item of eyeItems) {
    if (!wanted.has(item.id) || item.state !== "open") continue;
    settling.add(item.id);
    apply.push({ list: "eyeItems", id: item.id });
  }

  for (const card of cards) {
    if (!wanted.has(card.id) || card.state !== "open") continue;

    /* ⚠ EVERY reason, never the first one only — the finding PR #609 made
       against the sibling planner. A card held by both and told about one sends
       a shift to settle that one and meet the other on the next run. */
    const reasons: string[] = [];

    /* ⚠ THE SETTLING SETS ARE REMOVED FROM THE POPULATION, NOT CHECKED AFTER
       THE ANSWER — and the difference is a whole arm of the suite. The guard
       returns the FIRST eye item still needing him, so asking it over every set
       and then forgiving the one it named lets a SECOND open set through: a
       card with two sets of frames, one replied to and one not, would have been
       marked answered and the briefing refused at the parse. What is filtered
       out here is exactly what this plan is about to write as `answered`. */
    const unsettled = eyeItems.filter((item) => !settling.has(item.id));
    const orphanedEye = eyeItemStillNeedingHim(card.id, unsettled);
    if (orphanedEye) {
      reasons.push(
        `eye item '${orphanedEye.id}' still needs him and names this card (#133) — `
        + "he has not replied on those frames, so settle them before the card can be "
        + "marked answered",
      );
    }

    const claimingRow = waitingFounderRowNaming(card.id, pipeline);
    if (claimingRow) {
      reasons.push(
        `pipeline row '${claimingRow.id ?? "(unnamed)"}' still says he is blocking it (#291) — `
        + "give that row its real status before the card can be marked answered",
      );
    }

    if (reasons.length > 0) {
      held.push({ list: "needsYou", id: card.id, reason: reasons.join("; and ") });
      continue;
    }

    apply.push({ list: "needsYou", id: card.id });
  }

  return { apply, held };
}

/** The sentence the reply reader prints per applied item. */
export function acknowledgementLine(item: Acknowledgement): string {
  const kind = item.list === "eyeItems" ? "eye item" : "card";
  return `${kind} ${item.id}: open → answered — he replied, and the page still said open (#749)`;
}
