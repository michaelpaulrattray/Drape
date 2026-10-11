/**
 * THE `#N` TOKEN, AS THE BRIEFING'S OWN SURFACES WRITE IT — one reader, in
 * `shared/` because three trees now ask it (#2247).
 *
 * Two of his page's sections are hand-written prose that names the card it
 * lives on, and both are read back mechanically: a milestone STEP reads as done
 * when a card it names has closed (#1201), and a PROBLEM row is retired when a
 * card it names has closed (his *"problems never seems to update"*, #1201). The
 * card number inside a plain English sentence is the whole join.
 *
 * ⚠ **WHY IT MOVED HERE, AND IT IS WORKING LAW 4 WITH A MEASURED COST (#2247).**
 * It lived in `client/src/features/admin/components/crew/crewTypes.ts`, whose
 * own docblock already said *"one reader for the three surfaces that ask it …
 * a third copy is the drift working law 4 names"*. The fourth consumer is the
 * DESK SWEEP, which is a script — and a script cannot import the page. So the
 * only two roads were a copy in `scripts/` or this move, and a copy is the one
 * thing that sentence forbids. **The page's reader and the sweep's must agree
 * exactly**, because they answer the identical question from the two ends: the
 * page decides whether a stale row is DRAWN, and the sweep decides whether it
 * is NAMED for repair. Two spellings and the sweep would report rows his page
 * hides, or stay silent about rows it draws.
 *
 * ⚠ **AND THE COPY THAT SENTENCE WAS WORRIED ABOUT ALREADY EXISTED — THE MOVE
 * FOUND IT.** `server/crew/liveDesk.ts`'s `cardsNamedIn` carried this regex
 * character for character, with a `known`-set gate on top, and nothing in
 * either file knew about the other. It composes on this reader now, so there is
 * ONE token in the tree and two questions built over it. **It was found by a
 * guard rather than by reading**: `server/unwiringDiffer.test.ts`'s *"no name
 * is declared under both `server/` and `shared/`"* arm reddened the moment this
 * module arrived carrying the page's name, which is why the declaration here is
 * `cardsNamedInText` and the gated reader keeps its own. That arm exists for
 * the un-wiring differ's name-level union (#274, #1030) and caught a working
 * law 4 instance on the way past — the cheapest finding in this card.
 *
 * ⚠ **IT IS NOT `cardNumbersIn` (`shared/crewQueuePossiblyDone.ts`) AND MUST
 * NOT BE DERIVED FROM IT.** That reader answers a DIFFERENT question — *which
 * cards does a card BODY name* — and carries exclusions this one must not have
 * (`reply #114` and `run #26` are other numbering spaces there, and it drops
 * the card's own number). Deriving from a set that answers a different question
 * is a silent behaviour change, not a deduplication: a problem row reading
 * *"the reply #168 road"* would silently stop being retired by its card. The
 * two are deliberately two functions, and this paragraph is why.
 */

/**
 * Every card (`#N`) a sentence names, in the order it names them.
 *
 * ⚠ **THE TWO EDGES ARE THE CONTRACT, NOT A DETAIL**: what PRECEDES a `#` must
 * not be a letter or a digit, and what FOLLOWS the number may be anything but a
 * digit. So `abc#99` names nothing and `#1278a` names #1278. Moving either
 * changes how every problem row and every milestone step on his page is read.
 * `client/src/features/admin/components/crew/crewTypes.test.ts` pins both.
 *
 * The regex is built per call rather than once at module scope: a global
 * `lastIndex` shared between calls drops the second caller's first match, and
 * both consumers here call it in a loop.
 */
export function cardsNamedInText(text: string): number[] {
  const token = /(?:^|[^0-9A-Za-z])#0*([1-9][0-9]*)(?![0-9])/g;
  const found: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = token.exec(text)) !== null) found.push(Number(match[1]));
  return found;
}
