/**
 * REGENERATE — the words on the one button (#1903 slice 2; renamed #2090).
 *
 * **His ruling, verbatim (2026-10-07):** *"maybe we should allow retry by
 * default incase they didnt like the outfit that was invented or whatever but
 * it costs per retry and regens all views not just one"*.
 *
 * **Why a module and not two literals in the component**, which is
 * `viewRetryRow.ts`'s reason and `retryFace.ts`'s before it: a rule tested
 * through a substring search of the component is a test that agrees with
 * whoever wrote it. These can be held against his own sentence, and the price
 * can be held against the server's number.
 *
 * # The disappearing-technology gate (law 5, clause 7), answered here
 *
 * 1. **What must the customer learn to use this?** Nothing. A menu item that
 *    says what it does and what it costs, on the row above the pictures it
 *    would replace (behind the ⋯ since #2144, his Option A).
 * 2. **What decision does it put in front of them, and on what basis?** *Do I
 *    like these?* — judged on the pictures themselves, which is their own taste
 *    and the only basis it needs. No eligibility, no verdict, no axis.
 * 3. **Where does the technology show?** Nowhere. Not the engine, not the
 *    plate, not the word *package*, not *redo*. **Regenerate** is his own word
 *    for it (#2090, below) and is already the customer's verb one panel over:
 *    the refine panel's version button says *Regenerate* and has since before
 *    this row existed.
 */
import { displayPrice, formatCredits } from "@shared/creditDisplay";
import type { CardMenuItem } from "@/foundation";
import { slotIsBeingAsked, type BusySlotRead } from "./roomBusy";

/**
 * The press, and the PRICE RIDES ON IT — his standing rule, prices on paid
 * buttons.
 *
 * ⚠ **THIS IS NOT IN TENSION WITH HIS 2026-09-26 RULING THAT TOOK THE NUMBER
 * OFF THE TRY AGAIN ROW** (*"No credit count in the row"*). That row is a muted
 * caption under one picture, and it had become louder than the broken tile
 * beside it. This is a deliberate purchase of a whole new set of views. A
 * caption and a button are not the same object, and the earlier rule — prices
 * on paid buttons — is the one that governs a button.
 *
 * ⚠ **THE WORDS WERE "Ask for all views again" UNTIL #2090.** His word,
 * 2026-10-08 (terminal), verbatim: *"also the wording "Ask for all views
 * again · 650 credits" is way too long just call it Regenerate ~ 350
 * credits"*, then, asked to confirm the price: *"Call it Regnerated ~ 650
 * credits yes"*. The price is unchanged and stays derived below; his "~" is
 * read as this row's separator, the same " · " every other paid button wears.
 */
export const PACKAGE_REDO_LINK = "Regenerate";

/**
 * THE MENU ITEM'S WORD — **"Regenerate"**, his verb alone. His Option A of
 * 2026-10-09 (#2144; *"Mike approved Option A"*) moved Regenerate into the
 * character sheet row's ⋯ menu, first as *"Regenerate character sheet"*; the
 * same day, looking at the live menu, verbatim: *"in the menu just call it
 * Regenerate and Delete not those full sentences"* (#2150). The menu already
 * sits under the CHARACTER SHEET title and is named "Actions for the character
 * sheet" to a screen reader, so the item does not need to repeat it. It is the
 * verb constant itself rather than a second copy of the word.
 *
 * ⚠ **It was a link reading "Regenerate · 650 credits" until #2144**, with the
 * price joined to the words by " · ". In the menu the price is the item's own
 * grey line on the right (`packageRedoPrice`), which keeps his standing rule —
 * prices on paid buttons — on the item a customer actually presses.
 */
export const PACKAGE_REDO_MENU_LABEL = PACKAGE_REDO_LINK;

/**
 * The price, as the menu item's grey line: "650 credits", from the LEDGER
 * number on the wire.
 *
 * `credits` is spelled out rather than abbreviated to `CR` — #1908's rule, and
 * the same reasoning: an abbreviation is the product's shorthand, not the
 * customer's word.
 *
 * ⚠ **IT TAKES THE LEDGER NUMBER AND CONVERTS HERE.** `shared/creditDisplay.ts`
 * is the only thing allowed to turn one into the other (#1600), and
 * `creditDisplayGuard.test.ts` reads the expression that sits beside the word
 * *credits* — so the conversion is inline, where the census can see it routed,
 * and the room does no arithmetic at all.
 *
 * `displayPrice` and not `displayBalance`: a price rounds UP, so a customer is
 * never quoted less than the till will take.
 */
export function packageRedoPrice(priceCredits: number): string {
  return `${formatCredits(displayPrice(priceCredits))} credits`;
}

/**
 * The destructive item's word — **"Delete"**, red, with its bin. It read
 * *"Delete this character"* (his Desk wording, 2026-10-09) until his word the
 * same day (#2150): *"in the menu just call it Regenerate and Delete not those
 * full sentences"*. The library card's menu already says "Delete". The confirm
 * this item opens keeps its full sentence — only the menu word is short.
 */
export const CHARACTER_SHEET_DELETE_LABEL = "Delete";

/**
 * WHAT THE ⋯ MENU ON THE CHARACTER SHEET ROW OFFERS (#2144), in his order:
 * Regenerate first, then — below the rule a danger item draws — Delete.
 *
 * Each item is PRESENT only when it can happen, never disabled (D-107, and
 * `CardMenu`'s own rule): Regenerate only when the server offered a redo and
 * none is already being asked for; Delete only when the caller says the door is
 * open and the cast is not still being made. An empty list draws no dots at all.
 *
 * Both items open exactly what they opened as links before the move: Regenerate
 * presses straight through (no confirm — the price is on the item), Delete
 * opens the destructive confirm.
 */
export function characterSheetMenuItems(options: {
  redo: { priceCredits: number } | null | undefined;
  askingAll: boolean;
  deleteOffered: boolean;
  onRegenerate: () => void;
  onDelete: () => void;
}): CardMenuItem[] {
  const items: CardMenuItem[] = [];
  if (options.redo && !options.askingAll) {
    items.push({
      label: PACKAGE_REDO_MENU_LABEL,
      meta: packageRedoPrice(options.redo.priceCredits),
      onSelect: options.onRegenerate,
    });
  }
  if (options.deleteOffered) {
    items.push({ label: CHARACTER_SHEET_DELETE_LABEL, danger: true, onSelect: options.onDelete });
  }
  return items;
}

/**
 * THE COUNT BESIDE THE TITLE — "3 of 5" WHILE VIEWS ARE BEING MADE, AND
 * NOTHING ONCE THEY ARE DONE (#2144; Yuna's suggestion on the Desk item, and
 * his word of 2026-10-09, verbatim: *"on yunas call - yes"*).
 *
 * The same reading the old *"N of 5 views"* hint made — views that are
 * `ready`, over every slot, the Master never counted — with one refinement it
 * needs to be a PROGRESS count: a view being asked for again is not counted as
 * done while it is being re-made, or a Regenerate would read "5 of 5" for its
 * whole run.
 *
 * Returns null when nothing is being made: the cast is not building, no slot
 * is building, and no slot is being asked for again. A view that failed and
 * was refunded is not being made, so it does not hold the count up forever.
 */
export function characterSheetCount(
  castStatus: string,
  slots: readonly BusySlotRead[],
  asking: ReadonlySet<string>,
): string | null {
  const making = castStatus === "building"
    || slots.some((slot) => slot.state === "building" || slotIsBeingAsked(slot, asking));
  if (!making) return null;
  const done = slots.filter(
    (slot) => slot.state === "ready" && !slotIsBeingAsked(slot, asking),
  ).length;
  return `${done} of ${slots.length}`;
}

/**
 * What the room says while the new set is being made.
 *
 * Present tense and about HER pictures, never about the machine: the five tiles
 * beside it are already drawing their own working state, so this only has to
 * say that the thing she pressed is happening.
 */
export const PACKAGE_REDO_WORKING = "Making a new set of views…";
