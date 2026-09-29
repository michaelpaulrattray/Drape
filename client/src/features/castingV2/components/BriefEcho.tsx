import { composeEcho, echoText, type BriefFacts, type EchoSpan } from "../briefEcho";

/**
 * What the sheet says back after a brief compiles.
 *
 * Replaces the row of pills the founder called tokenized. One sentence, in the
 * same type as everything around it, with the facts the system pinned
 * underlined — click one to change it or let it vary.
 *
 * Three of the founder's conditions are visible in the markup rather than in a
 * comment somewhere:
 *
 *   **Two layers.** Pinned facts render at full ink; the connective prose
 *   between them at secondary. A regular scans the facts at chip-speed because
 *   they are the only thing at full contrast, and the sentence still reads as a
 *   sentence for someone seeing it for the first time.
 *
 *   **Two lines, hard.** `-webkit-line-clamp` caps it. ⚠ It is the ONLY cap
 *   now (#1288): the grammar's own say-less mechanism existed to shed the
 *   "left to the roll" clause and went with it, so this is the backstop for a
 *   long heritage pair and nothing else needs to choose what to drop.
 *
 *   ⚠ **THERE WAS A THIRD, "terser on repeat", AND IT WENT THE SAME WAY.** On
 *   the second and later rolls of a session the latitude clause dropped and the
 *   pins stayed — but the latitude clause was the only thing `terse` ever
 *   suppressed, so with the clause retired the prop computed a boolean the
 *   grammar could not spend.
 */


/**
 * ⚠ **THE SENTENCE IS READ-ONLY — NO PICKERS AT ALL, AND THAT IS NOW
 * UNCONDITIONAL** (#535, his ruling 2026-09-06, verbatim: *"make the top
 * sentence read-only with no pickers at all, and make the prompt box the only
 * place I edit"*).
 *
 * His two named defects were exactly this surface's offers: the options came
 * from the old generic lists ("slim build" offered on an ogre), and an edit
 * was appended to the sentence's end instead of rewritten into it. The
 * sentence says what the studio read in the words that cast these eight, and
 * it never changes, because the pictures never change; the *"edited below,
 * not cast yet"* mark is the only link between it and the box. The guard his
 * §19 asked for ("chips and box can never disagree") is trivially true in
 * this shape and is its structural form: the sentence renders from the roll's
 * recorded brief only, and no control on it can write.
 *
 * ⚠ **WHAT WAS HERE UNTIL SLICE 3 OF THE OLD-LANE RETIREMENT (#1444), AND WHY
 * IT IS NOT A BEHAVIOUR CHANGE.** His ruling was delivered as a POLICY OBJECT
 * — `VaryPolicy { authorRoad }` — fed from the config's `authorRoadEnabled`,
 * with `factsHeld` short-circuiting every span to plain text on the author
 * road and the whole picker apparatus (`varyOffered`, `PendingAdjustments`,
 * `EchoAdjustment`, two `Popover` arms and an `onAdjust` channel) standing
 * behind it for the house road. **`CASTING_V2_SCOPE` has been `all` since the
 * V2 rollout**, so `factsHeld` has returned `true` for every account and not
 * one of those arms has been reachable; the flag's removal is what exposes
 * that, not what causes it. The pickers go with the road that was their only
 * reader — the same sentence the block above used to end on, now spent.
 *
 * The house road's own edit channel (the sheet store's `overrides`/`unlocked`
 * slice, and `createRoll`'s matching inputs) is NOT removed here: a store
 * slice and a wire input are each their own deploy-skew act. The page stops
 * reading them in this slice.
 */
export function BriefEcho({
  facts,
  followLabel,
  authorRoad,
}: {
  facts: BriefFacts;
  followLabel?: string | null;
  /**
   * ⚠ **THIS sheet's own road (#230), READ OFF THE ROLL ROW — not the config,
   * and not the retired flag.** It drops the differ-by caption, which is false
   * on a sheet one authored prompt painted, and 220 of 306 production sheets
   * read through it. It is the one `authorRoad` in this feature that is
   * PERMANENT: the sibling that came from `config.authorRoadEnabled` (a
   * `vary` policy about the NEXT roll) retired with the flag in #1444, and the
   * two sitting in one component was that slice's whole risk.
   */
  authorRoad?: boolean;
}) {
  const spans = composeEcho(facts, { followLabel, authorRoad });
  if (spans.length === 0) return null;

  return (
    /*
      The whole sentence carries an accessible label as one string. A screen
      reader walking six separate buttons interleaved with prose fragments hears
      rubble; this way the sentence is read as a sentence, and each button still
      announces what it adjusts when reached.
    */
    <p className="dpc-echo" aria-label={echoText(spans)}>
      {spans.map((span, index) => (
        <EchoSpanView key={index} span={span} />
      ))}
    </p>
  );
}

/**
 * One span, drawn. Every kind renders as plain text, and nothing here can
 * write — his read-only ruling (#535) in its structural form.
 *
 * ⚠ **THE FOUR ARMS THAT STOOD BELOW THIS ONE ARE GONE WITH THE FLAG (#1444),
 * AND EVERY ONE OF THEM WAS ALREADY UNREACHABLE.** They were the house road's
 * pickers: a `Popover` per pinned fact with the shared vocabulary as its
 * options, a second `Popover` treatment for a queued change (*"early 20s →
 * teens · next roll"*), and a `Let it vary` footer withheld by `varyOffered`.
 * `factsHeld` returned `true` for every account from the moment
 * `CASTING_V2_SCOPE` reached `all`, so every span short-circuited here — the
 * category and stated arms below were the only ones a customer has seen in a
 * year, and they returned exactly what this returns now.
 *
 * ⚠ **THE HISTORY THOSE ARMS CARRIED IS KEPT, BECAUSE IT IS ABOUT WHAT NOT TO
 * REBUILD** — read it in git at this file's parent commit. Its two paid
 * lessons: a queued change must stay CHANGEABLE (he mis-clicked Mediterranean
 * to Slavic and could not correct it — a control that cannot be corrected is
 * worse than one that can be pressed twice), and the pending treatment must key
 * on a DIFFERENCE rather than on an override merely existing, or a landed
 * override reads *"severe minimal → severe minimal · next roll"* forever and
 * the fact becomes permanently uneditable. Any future picker on this sentence
 * starts from those two, not from a blank page.
 */
function EchoSpanView({ span }: { span: EchoSpan }) {
  if (span.kind === "text") return <span className="dpc-echo__prose">{span.text}</span>;
  /*
    Everything else reads at full ink and is deliberately not a button. A
    pinned fact, the casting category and a stated accessory each opened a
    different reason for that — a category and a stated fact are the user's own
    free text, so an underline would promise a picker that cannot exist, and a
    pinned fact is the record of what was cast, which the brief box below is
    the only place to change. One arm now, because they all say the same thing.
  */
  return <span className="dpc-echo__role">{span.text}</span>;
}
