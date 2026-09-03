import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  DropZone,
  Field,
  Input,
  ScopePill,
  SectionHead,
} from "@/foundation";
import { AppChrome } from "@/components/AppChrome";
import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import { DEFAULT_CASTING_PATH, type CastingPath } from "@shared/castingPaths";
import { DEFAULT_IMAGINATION, type Imagination } from "@shared/imagination";
import { DEFAULT_CAST_STYLE, type CastStyle } from "@shared/castStyles";
import { BRIEF_TEXT_MIN, BRIEF_TOO_SHORT_MESSAGE } from "@shared/briefLength";
import { CASTING_PATH_LINES } from "@/features/castingV2/castingPathCopy";
import { CastSettingsButton } from "@/features/castingV2/components/CastSettingsModal";
import { BriefField } from "@/features/castingV2/components/BriefField";
import {
  ConceptUploadCard,
  type ConceptUploadHandle,
} from "@/features/castingV2/components/ConceptUploadCard";
import { briefWithDescription } from "@/features/castingV2/conceptUpload";
import { PathToggle } from "@/features/castingV2/components/PathToggle";
import { useSheetState } from "@/features/castingV2/sheetState";
import { createDispatchLatch, type DispatchLatch } from "@/features/castingV2/singleFlight";
import { ConfirmDialog } from "@/foundation";
import { Icon, P } from "@/foundation";
import { HeroDeck } from "@/features/castingV2/components/HeroDeck";
import { CardMenu } from "@/foundation";
import { DestructiveConfirm } from "@/foundation";
import { RenameDialog } from "@/foundation";
import { classifyDispatchFailure } from "@/features/castingV2/dispatchFailure";
import {
  RETENTION_EMPTY_STATE,
  isExpiryWarning,
  sheetAgeLine,
} from "@/features/castingV2/retentionCopy";
import "@/features/castingV2/castingV2.css";

/**
 * The Casting tab (handoff chapter 07, plan §K M5).
 *
 * Sentence in, sheet out. Two things are deliberately missing and both are
 * absences with reasons:
 *
 *   - **No hero band of ambient numbers.** The prototype's "184 performers
 *     cleared for paid ads", "99.4% retention" and "locks in ~4 min" are
 *     decorative fiction. The honest-capability law (§B-17) says real numbers
 *     or none, and right now there are none to state.
 *   - **No engine selector.** The prototype's "Klieg V2" dropdown was
 *     confirmed by the founder as prototype fiction — provider choice is
 *     server policy, app-wide, and no casting surface offers it.
 *
 * The roster grid is genuinely empty in M5, because Sign lands in M7 and no V2
 * cast can exist before it. It still renders, with the dashed create tile
 * first: the create action never hides behind the collection, and a section
 * that appears from nowhere at M7 would be a worse introduction than one that
 * has always been there.
 */

const ROLL_PRICE_FALLBACK = 0;

/**
 * ⚠ **THE SEED CHIPS ARE REMOVED (#375, his order 2026-09-01) AND THE SEED LAW
 * IS NOT LOST WITH THEM — it moved, whole, to `docs/specs/Casting-ui-ux-design/
 * casting-hero.md` §3a.**
 *
 * Six founder clauses lived in the docblock over this constant, every one of
 * them learned from a seed that broke it: honest to today's capability, a tiny
 * story rather than a demographic, rest-state and permanent rather than
 * performed, verified by a generated tile, a brief this audience would really
 * type, and sex stated wherever the detail is sex-coded. **Deleting the array
 * would have deleted the law**, and the law is not about chips — it is about
 * every example sentence this product ever puts in front of somebody, which
 * now means the DECK's briefs.
 *
 * The chips went because the deck does their job better: a chip filled the box
 * with a sentence someone wrote, a deck card fills it with the real brief that
 * cast a real face you are looking at. Two mechanisms for one job is working
 * law 4, and the deck is the one with the evidence attached.
 */

/**
 * F3: UNSIGNED is the vocabulary everywhere; DRAFT is retired. But the *casing*
 * is a separate question from the word — these are filter labels in a sentence
 * -case row, so they read as filters. Uppercase UNSIGNED is reserved for the
 * mono status pill on a cast card, where shouting is the point.
 */
const ROSTER_SCOPES = ["All", "Signed", "Unsigned"] as const;
type RosterScope = (typeof ROSTER_SCOPES)[number];

/**
 * What deleting a sheet actually does, said plainly.
 *
 * The §G.6 carve-outs are not a technicality the user can be spared: a Cast
 * signed from this sheet survives, and so do the kept faces her Siblings card
 * is made of. Names rather than a count — this is a promise about their own
 * people, and a bare number is not something they can check.
 */
function sheetDeleteCopy(sheet: {
  briefText: string | null;
  signedCastNames: string[];
}): string {
  const label = `"${sheet.briefText ?? "Untitled sheet"}"`;
  if (sheet.signedCastNames.length === 0) {
    return `${label} and every candidate on it will be deleted. This cannot be undone.`;
  }
  const names = sheet.signedCastNames.length === 1
    ? sheet.signedCastNames[0]
    : `${sheet.signedCastNames.slice(0, -1).join(", ")} and ${sheet.signedCastNames.at(-1)}`;
  /*
    Pronoun-free by construction. The card carries names, not records, so there
    is nothing here to derive a pronoun FROM — and "she's safe" about a cast the
    product has never looked at is the same defect as the room's, one surface
    along. The name does the work instead.
  */
  const who = sheet.signedCastNames.length === 1
    ? `${names} came from this sheet and is safe`
    : `${sheet.signedCastNames.length} casts came from this sheet — ${names} are safe`;
  return `${who}. The sheet and its unsigned candidates will be gone. This cannot be undone.`;
}

export default function CastingV2() {
  const [, navigate] = useLocation();
  const [brief, setBrief] = useState("");
  /*
    WHICH PATH THE NEXT CAST IS BORN ON — the two paths' toggle (design §6).

    `DEFAULT_CASTING_PATH` rather than a literal, and the constant carries the
    founder's own unprompted ruling for why it is Wardrobe: *"basics is more of
    a advanced selection because if someone truely wanted to cast someone in
    basics they would say that in the prompt?"*

    Held here and not in the store, deliberately: it is a property of the roll
    about to be bought from THIS page, not of a sheet, and it should reset the
    way the brief box does.
  */
  const [path, setPath] = useState<CastingPath>(DEFAULT_CASTING_PATH);
  /*
    THE SETTINGS (#142): the style and the imagination meter, both set in the
    modal the gear opens, both his defaults (photoreal, LOW), both drawn only
    on the author road. Page state and nothing else — leaving the page resets
    them, which is the design's ephemerality ruling by construction.
  */
  const [style, setStyle] = useState<CastStyle>(DEFAULT_CAST_STYLE);
  const [imagination, setImagination] = useState<Imagination>(DEFAULT_IMAGINATION);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<RosterScope>("All");
  const [starting, setStarting] = useState(false);
  /** Closes synchronously on click; see `startCasting` and `singleFlight.ts`. */
  const latchRef = useRef<DispatchLatch | null>(null);
  if (!latchRef.current) latchRef.current = createDispatchLatch();
  const castLatch = latchRef.current;
  /*
    Addressed writes, not ambient ones. This component fires the roll and
    unmounts in the same tick, so its late `.catch` resolves while the user may
    already be standing on a DIFFERENT sheet. Passing the session id it just
    created means the failure lands on the sheet it belongs to rather than on
    whichever one happens to be open.
  */
  const setStartingRoll = useSheetState((state) => state.setStartingRoll);
  const setDispatchFailure = useSheetState((state) => state.setDispatchFailure);

  /*
    A REF, NOT A SELECTOR. This used to reach for
    `input[aria-label="Casting brief"]`, which is a query about the box's HTML
    TAG dressed up as a query about the box — so the day the field grew into a
    textarea (it had to, see `BriefField`), the New-cast-member tile would have
    gone quietly dead with nothing to notice it. Two surfaces now put the caret
    here and neither should have to know what element it is.
  */
  const briefField = useRef<HTMLTextAreaElement>(null);
  /*
    THE CONCEPT CARD'S SECOND DOOR (#435 §2e) — the hero's `Start from photos`
    opens the card's own dialog, empty on its drop zone, exactly as tapping the
    card does. A handle rather than lifted state: see `ConceptUploadHandle`.
  */
  const conceptCard = useRef<ConceptUploadHandle>(null);
  const focusBrief = () => {
    const field = briefField.current;
    if (!field) return;
    field.focus();
    /*
      And brought into view, because both callers are BELOW it: the tile is
      under the roster and the concept card is under the hero, so on a short
      window the box they just filled can be off the top of the screen.

      No caret arithmetic here on purpose. Setting the selection would read
      `field.value` before React has painted the new text, so it would measure
      the OLD sentence — and a caret at the start of a description she is about
      to read is the right place for it anyway.
    */
    field.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const utils = trpc.useUtils();
  const config = trpc.castingV2.config.useQuery({});
  const openSessions = trpc.castingV2.openSessions.useQuery(
    {},
    { enabled: config.data?.enabled === true },
  );

  /*
    UPLOAD A CONCEPT (#185). House money, no credits, nothing kept — and the
    card is only handed this door where the server says the scope admits her.
  */
  const describeConcept = trpc.castingV2.concept.describe.useMutation();
  const abandonSession = trpc.castingV2.abandonSession.useMutation();
  const [abandoning, setAbandoning] = useState<string | null>(null);
  /** The sheet whose delete is armed. One at a time, and never on load. */
  const [armed, setArmed] = useState<string | null>(null);
  /** Which card has its overflow menu open. One at a time. */
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const discardSheet = async (sessionId: string) => {
    // The confirmation is the modal; this only runs once it is answered.
    if (abandoning) return;
    setAbandoning(sessionId);
    try {
      await abandonSession.mutateAsync({ sessionId });
      await utils.castingV2.openSessions.invalidate();
      setArmed(null);
      setMenuFor(null);
      /*
        KEPT, and it was very nearly removed.

        The D-110 pass took this out on the reasoning that the card leaves the
        strip in front of the user. Then it was MEASURED: **the card takes 7.1
        seconds to go.** `openSessions` runs four queries per sheet, so a lobby
        with two dozen sheets refetches about a hundred times against a remote
        database before anything on screen changes.

        Seven seconds of nothing after a destructive action is worse than a
        redundant pill. The surface does not own this notice yet — it will when
        the removal is optimistic or the projection is one query — and until
        then the toast is the only thing that answers.

        The rule held; the assumption about the surface did not, and only
        driving it found that out.
      */
      toast("Sheet deleted");
    } catch (error) {
      toast(error instanceof Error ? error.message : "That sheet could not be discarded.");
    } finally {
      setAbandoning(null);
    }
  };

  /** The sheet a delete has been requested for, resolved to its row. */
  /*
    WHAT A CAST'S MENU MAY OFFER, in one place — the roster card and the room
    header show the same thing because they are the same decision.

    Delete is ABSENT rather than disabled on both counts. The deletion authority
    excludes a `provisioning` model by design, so a Delete on a building tile
    could only ever refuse; and the door itself is a server flag. A menu item
    that always refuses is a dead control (D-107).
  */
  const castMenuItems = (cast: NonNullable<typeof roster.data>[number]) => [
    {
      label: "Rename",
      onSelect: () => {
        setCastMenu(null);
        setRenaming({
          castId: cast.castId,
          name: cast.name ?? "",
          imageUrl: cast.imageUrl,
        });
      },
    },
    ...(deleteDoorOpen && cast.status !== "building"
      ? [{
        label: "Delete",
        danger: true,
        onSelect: () => {
          setCastMenu(null);
          setDeletingCast(cast);
        },
      }]
      : []),
  ];

  const armedSheet = openSessions.data?.find((entry) => entry.sessionId === armed) ?? null;

  /** Which roster card has its menu open. One at a time, like the sheet cards. */
  const [castMenu, setCastMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<
    { castId: string; name: string; imageUrl: string | null } | null
  >(null);
  const [deletingCast, setDeletingCast] = useState<
    NonNullable<typeof roster.data>[number] | null
  >(null);

  /*
    THE DOOR THE SERVER OWNS. Permanent deletion sits behind
    `ENABLE_FINAL_MODEL_DELETE`; the client asks rather than assumes. The
    ceremony asserts the same flag itself, so this only decides whether to offer
    a control that would otherwise refuse — never whether deletion is allowed.
  */
  const deleteDoorOpen = trpc.models.deleteAvailability.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  }).data?.enabled ?? false;

  const renameCast = trpc.castingV2.renameCast.useMutation();
  const deleteCast = trpc.castingV2.deleteCast.useMutation();

  const createSession = trpc.castingV2.createSession.useMutation();
  const createRoll = trpc.castingV2.createRoll.useMutation();
  /*
    ABOVE THE EARLY RETURNS, and that is not a style point.

    This page returns early while the config loads and again when casting is not
    enabled for the account. A hook declared after those returns runs on some
    renders and not others, and React ends the page with "rendered more hooks
    than during the previous render" — which is exactly how the roster shipped
    as a white error screen for a minute. Every hook lives up here with the
    others.
  */
  const roster = trpc.castingV2.roster.useQuery(
    {},
    {
      enabled: config.data?.enabled === true,
      // A Cast still building its package resolves within a couple of minutes.
      // Poll only while one is.
      refetchInterval: (query) =>
        query.state.data?.some((cast) => cast.status === "building") ? 5_000 : false,
    },
  );

  if (config.isLoading) {
    return (
      <AppChrome breadcrumb="Casting" current="casting" width="working" gutter="tight">
        <span className="dp-metadata">Loading…</span>
      </AppChrome>
    );
  }

  /*
    Flag off is a real state, not a blank page. The rail links here for every
    signed-in user while the scope is founder-only, so this is what most
    accounts see — and it should read as "not yet" rather than as breakage.
  */
  if (!config.data?.enabled) {
    return (
      <AppChrome breadcrumb="Casting" current="casting" width="working" gutter="tight">
        <div className="dp-stack" style={{ gap: 9, maxWidth: 520 }}>
          <span className="dp-eyebrow">Casting</span>
          <h1 className="dp-headline">Not open on this account yet.</h1>
          <p className="dp-body">
            Casting is being tested with a small group first. Nothing here is
            charged, and your existing models are unaffected.
          </p>
        </div>
      </AppChrome>
    );
  }

  const price = config.data.rollPriceCredits ?? ROLL_PRICE_FALLBACK;
  const candidatesPerRoll = config.data.candidatesPerRoll ?? 8;
  /*
    THE HERO'S RECEIPT LINE, DERIVED (#435 §2d). Every segment comes from the
    server's own roll constants — the count and the price from the numbers that
    charge, the duration from a dated measurement of real rolls.

    ⚠ **A SEGMENT THE SERVER DID NOT SEND IS ABSENT, NEVER GUESSED.** An older
    bundle against a server without `rollTypicalSeconds`, or a config still
    settling, would otherwise print a fallback literal — which is precisely the
    hand-written number his rule for this line forbids, arriving through the
    back door marked "default". Two true facts read better than three with one
    invented among them, and nothing on the line can ever disagree with the
    charge.
  */
  const rollSeconds = config.data.rollTypicalSeconds;
  /*
    WHETHER THE CONCEPT DOOR IS OPEN — the same server answer the card itself
    reads, so the hero's `Start from photos` link and the card can never
    disagree about whether the flow exists (D-180: absent, not disabled).
  */
  const conceptUploadEnabled = config.data.conceptUploadEnabled === true;
  /*
    WHETHER THIS ACCOUNT CHOOSES ITS PATH — server-owned, asked not decided.

    `=== true` rather than a truthy read: an older bundle against a server
    without the field, or a config still loading, must draw NO control. §6 is
    explicit that the toggle is absent rather than disabled when the scope is
    off, and absent-by-default is the only reading of that which survives a
    field arriving as `undefined`.
  */
  const twoPathsEnabled = config.data.twoPathsEnabled === true;
  /*
    THE AUTHOR ROAD RETIRES THE PATH SWITCH (#131 slice E, ruling rule 11: "let
    the engine decide the outfits based on the prompt") and draws the
    IMAGINATION meter in its place. Server-owned like `twoPathsEnabled`: the
    page asks, never decides.
  */
  const authorRoad = config.data.authorRoadEnabled === true;
  const pathToggleVisible = twoPathsEnabled && !authorRoad;

  /*
    THE ONE ROLL FLOW — and it takes its brief as an ARGUMENT now (#196, his
    first amendment: *"it automatically casts the prompt the same flow the
    original prompt and casting takes just through the modal"*).

    The concept modal casts words she has just edited inside a dialog, and those
    words are not in `brief` yet. Reading them out of state would mean a
    `setBrief` immediately followed by a read of the value it has not committed
    — React's oldest race, on the money path. So the text is passed in, and
    there is still exactly ONE function in the product that starts a roll: same
    session, same latch, same gear settings, same charge, same sheet.
  */
  const startCasting = async (briefText: string) => {
    /*
      The latch is a ref because `setStarting(true)` does not take effect until
      the next render — two clicks (or two Enters) in one frame both pass a
      state-based guard and both create a session and a paid roll. The ref
      closes on the click that opened it.
    */
    /*
      ⚠ IT SPEAKS NOW — the gate review's finding 2, and the repair is the CLASS
      rather than the instance. This was a silent `return`, which was survivable
      while the only way to reach it was the hero button beside a nearly-empty
      box; #196's modal made it reachable from behind a PRICE, and a priced
      button that closes its dialog and does nothing is D-180 exactly.

      Aligning the modal's own threshold instead would have been the cheaper
      repair and the wrong one: what the entrance refuses is the MERGED text,
      which the dialog cannot see, so the dialog would have had to be told how
      long her existing brief is — page state leaking into a presentational
      component to answer a question the page already knows.

      The number and the sentence are the SERVER'S (`shared/briefLength.ts`,
      read by `briefCompiler.ts`'s own refusal), so the two sides cannot drift
      and a customer never meets two wordings of one rule.
    */
    if (briefText.trim().length < BRIEF_TEXT_MIN) {
      toast(BRIEF_TOO_SHORT_MESSAGE);
      return;
    }
    // No session exists yet, so there is no id to wait on — the latch here is
    // purely "one ceremony at a time", released only on failure.
    if (!castLatch.tryAcquire(null)) return;
    setStarting(true);
    try {
      const session = await createSession.mutateAsync({ originType: "roster" });

      /*
        Fire the roll and leave immediately — do NOT await it.

        `createRoll` awaits all eight candidates before it returns, which M3
        measured at 66–82 seconds. Awaiting it here would park the user on this
        page staring at a spinner for a minute, and then drop them onto a sheet
        where all eight images appear at once. That is precisely the batch flip
        the prototype does and the reconciliation rejects.

        The mutation survives this component unmounting, and the roll's rows
        commit before dispatch — so by the time the sheet's first poll lands,
        eight queued candidates are there to render as skeletons, each swapping
        on its own arrival.
      */
      // No reset: a session id this new has no slice, and absence IS the empty
      // state. Cleanliness by construction rather than by remembering to call.
      setStartingRoll(session.sessionId, true);
      /*
        `mutateAsync().catch(...)` rather than `mutate(..., { onError })`.

        React Query does not invoke `mutate`'s callbacks once the component
        that called it has unmounted — and this one navigates away in the same
        tick, so `onError` never ran. A refused brief left the pending flag set
        and the sheet showed eight skeletons forever. A promise chain has no
        such rule: it settles wherever it was created, and writes the failure
        into the store, which outlives the navigation.
      */
      void createRoll
        .mutateAsync({
          clientRequestId: createClientRequestId(),
          sessionId: session.sessionId,
          briefText: briefText.trim(),
          /*
            THE PATH TRAVELS ONLY WHEN THE CONTROL WAS DRAWN (design §6).

            Absent is not `wardrobe` — the field is optional precisely so that
            *the toggle was not sent* stays distinguishable from *the toggle
            said Wardrobe*, and `rollService` turns an unsent toggle into the
            default only INSIDE the flag. Sending a path an account has no
            control for would be this client asserting a choice nobody made,
            and it is the shape that would make `casting_rolls.path` NON-NULL
            on rolls cast without the feature.

            The server is already safe either way — a path from an account
            outside the flag is ignored, read at `rollService`'s `bornPath`.
            This is the client not lying, not the client enforcing.
          */
          ...(pathToggleVisible ? { path } : {}),
          /* The settings travel only where the gear was drawn — the path's rule, one control over. */
          ...(authorRoad ? { imagination, style } : {}),
        })
        .then(() => setStartingRoll(session.sessionId, false))
        .catch((error: unknown) =>
          setDispatchFailure(session.sessionId, {
            ...classifyDispatchFailure(error),
            // The sheet had no roll when this fired, so ANY roll appearing
            // proves the failure stale and dismisses the banner.
            afterRollId: null,
          }),
        );

      // Navigating IS the confirmation, so no toast — the toast law fires on
      // actions that leave you where you were, never on ones that move you.
      navigate(`/casting/s/${session.sessionId}`);
    } catch (error) {
      // Only a failure reopens the latch. On success we navigate away, and
      // this page unmounts — reopening it there would briefly re-arm a button
      // the user has already spent on.
      castLatch.release();
      setStarting(false);
      toast(error instanceof Error ? error.message : "That roll could not start.");
    }
  };

  /*
    THE ROSTER, WHICH USED TO BE A HARDCODED ZERO.

    `const signedCount = 0` was honest while Sign did not exist and became a lie
    the moment it did: the founder signed a Cast for 500 credits and she
    appeared nowhere on this page. A count is not a placeholder — it is a claim
    about someone's property.

    Unsigned stays zero and says so. There is no such thing as an unsigned cast
    member in V2: an unsigned face is a candidate, and candidates live on their
    sheet, which is what the Unsigned sheets row above is for.
  */
  const casts = roster.data ?? [];
  const scopeCounts: Record<RosterScope, number> = {
    All: casts.length,
    Signed: casts.length,
    Unsigned: 0,
  };
  const shownCasts = scope === "Unsigned" ? [] : casts;

  return (
    <AppChrome breadcrumb="Casting" current="casting" width="working" gutter="tight">
      <div className="dp-stack" style={{ gap: 12 }}>
        {/* ---- hero card: copy left, the pair right, one seam between ---- */}
        <div className="dpc-hero">
          {/*
            THREE PARTS, NOT A CENTRED STACK (#435, his brief 10 §2a — and it is
            the reason he filed the card: *"the issue with our current one is
            its not balanced and just feels poorly designed."*)

            The column was one `justify-content: center` stack of ~277px inside
            a 452px card, so ALL its slack collected above and below the
            content at once — the copy floated in the middle while the deck
            beside it read full height. Pitch group, a spacer, ask group: the
            headline now top-aligns with the deck and the brief row bottom-
            aligns with the deck's own brief block, and the surplus sits in the
            middle where slack reads as air rather than as a mistake.

            ⚠ **THE SPACER IS AN ELEMENT, NEVER `margin-top: auto`** — his brief
            gives the reason and it is the same one briefs 05, 06, 07 and 09
            give: any computed-style read resolves an auto margin to hard
            pixels, which overflows a wrapping row and is then clipped by this
            card's `overflow: hidden`. Live layout fine, every screenshot and
            export broken.
          */}
          <div className="dpc-hero__copy">
            <div className="dpc-hero__pitch">
            <span className="dp-eyebrow">Casting</span>
            {/*
              "Meet eight of them." — the copy law's own exemplar. A numeral
              here would be the cheapest possible way to break it, which is
              exactly why the handoff uses this line to make the point.
            */}
            <h1 className="dpc-hero__title">
              Say who you need.
              <br />
              Meet eight of them.
            </h1>
            {/*
              Adapted until M8b (founder ruling, 2026-08-01). The prototype's
              line — "a face, a voice and a way of talking … or start from
              photos of a real person" — claims two capabilities that do not
              exist: voice is M8b, and upload is the inert card below. Voice
              had already been adapted out of the search placeholder, so
              keeping it here was the audit contradicting itself.

              Restore the full line when Voice ships.
            */}
            <span className="dp-body dpc-hero__explainer">
              A cast member is a face and a presence — signed once, reusable in every campaign.
            </span>
            </div>

            {/* The air. An element, for the reason at the top of this card. */}
            <span className="dpc-hero__air" aria-hidden="true" />

            <div className="dpc-hero__ask">

            {/*
              THE BOX YOU CAN READ WHAT YOU ARE ABOUT TO BUY IN.

              It was a single-line `<input>` here long after the sheet's own
              brief box stopped being one, and the reason `BriefField` was
              written applies to this box more than to that one: past about
              sixty characters the beginning of your own sentence scrolls out
              of view, so the thing you are about to spend 160 credits on
              cannot be checked before you spend it — and THIS is the box a
              first roll is typed into. Same component, same four-line cap, and
              the resting state is identical: it grows from one line, so a
              customer typing a sentence sees exactly what they saw before.

              The class, not the instance (working law 7): the fix landed on
              the sheet in its own commit and the start page kept the defect,
              which is what a sweep at the time would have caught.
            */}
            <Field className="dpc-hero__field dpc-briefrow">
              <BriefField
                ref={briefField}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                onKeyDown={(event) => {
                  /*
                    ENTER STILL CASTS — the affordance this box has always had,
                    kept rather than lost to the element change. Shift+Enter is
                    the new line, which is the convention everywhere else a
                    submit lives on a textarea, and it is what makes a
                    two-paragraph brief typeable at all.
                  */
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void startCasting(brief);
                  }
                }}
                /*
                  PLACEHOLDER LAW (founder, 2026-08-01): a placeholder obeys every
                  clause the seeds obey. It is the most-read example on the page —
                  seen by everyone, tapped by nobody — so a bad one teaches the
                  wrong shape to every visitor.

                  The previous text broke four at once: "a dad in his 30s, dry
                  humour, hands that have done some work" was the wrong audience,
                  named a pronoun (which pins sex), asked for humour (performance,
                  which the expression law forbids), and promised HANDS — which the
                  waist-up frame with arms at the sides cannot show at all.
                */
                placeholder="a fitness creator in their 30s, close-cropped hair"
                aria-label="Casting brief"
              />
              <Button
                variant="primary"
                size="small"
                onClick={() => void startCasting(brief)}
                disabled={starting}
              >
                {starting ? "Casting…" : "Cast it"}
                {starting ? null : <ArrowRight size={12} strokeWidth={2.2} aria-hidden="true" />}
              </Button>
            </Field>
            {/*
              THE RECEIPT LINE (#435, his brief 10 §2d) — what you get, what it
              costs, how long it takes, directly under the box that buys it.

              His reason: *"Every paid button in the product is priced except
              this one."* The sheet prices its roll, the composer prices its
              run, the templates modal prices its run — the hero's primary was
              the only unpriced spend in the product, and this also answers
              *what do I get* before the money rather than after it.

              ⚠ **ALL THREE VALUES ARE DERIVED, AND THAT IS THE WHOLE POINT** —
              his rule, verbatim: *"A hand-written price that disagrees with the
              charge does the opposite of what this line is for."* The count and
              the price are the server's own roll constants; the duration is a
              measurement with a date (`server/castingV2/rollDuration.ts`).

              ⚠ **HIS BRIEF'S OWN EXAMPLE READ `4 CR` AND THE CHARGE IS 160** —
              the rule above is what settles it, and the rule is his. Numerals
              rather than words, because mono is this system's machine-value
              face and these are machine values.
            */}
            <p className="dpc-hero__receipt">
              <span className="dpc-hero__receiptvals">
                {candidatesPerRoll} CANDIDATES
                {price ? (
                  <>
                    {" · "}
                    {/*
                      ⚠ **THE TILDE STAYS ON THE PRICE, AND HIS BRIEF'S EXAMPLE
                      PUTS IT ONLY ON THE DURATION.** D-109 is why: every cost
                      line in this product hedges the same way, because *"a
                      number presented as exact that then differs is worse than
                      one that never claimed to be"* — a roll is eight
                      independently refundable slices, so what is finally paid
                      can be less than what is quoted. It is one character on a
                      money surface against a written rule, so the rule keeps
                      it; the Sign confirm and the dock's cost line wear the
                      same one.
                    */}
                    <span className="dpc-modal__tilde">~</span>
                    {price} CR
                  </>
                ) : null}
                {rollSeconds ? ` · ~${rollSeconds} SECONDS` : null}
              </span>
              <span className="dpc-hero__receiptrule" aria-hidden="true" />
            </p>
            {/*
              THE PATH, CHOSEN BEFORE THE MONEY (design §6; founder ruling
              2026-08-21, *"this is the way foward 100%"*).

              Under the brief field and above the cost line, which is where §6
              put it when the anchor below it was the TRY row (#375 removed
              that row; the spec's §6 moved with it in the same commit). The
              intent is unchanged and is what the anchor was FOR: the tradeoff
              is read on the way to the button rather than beside it. It is not
              a modal and it is not a step: one control, two states, default
              Wardrobe.

              ABSENT, never disabled, when the scope is off — §6's own words,
              and it is D-180's rule: a disabled toggle is a question with no
              answer wearing a tap target. Which means for every account in
              production today this hero is byte-for-byte what it was.

              The note under the pills is the SELECTED path's line, which is
              how the tradeoff gets told before the roll (his condition,
              verbatim: *"as long as we make it clear before they go to cast
              someone"*). One line rather than both: the default's own line
              already states the bound a Basics customer would be choosing away
              from, and two grey sentences under a control is the wall of small
              print that stops being read.
            */}
            {pathToggleVisible ? (
              <PathToggle
                idPrefix="dpc-hero-path"
                label="How this cast is born"
                value={path}
                onChange={setPath}
                note={CASTING_PATH_LINES[path]}
              />
            ) : null}
            {/*
              THE ACTIONS ROW (#435, his brief 10 §2e) — the two ways in, in the
              row where you decide, with the slack between them.

              LEFT is the settings control (#142's gear, restyled). Three of his
              choices here each correct a specific misread, and none is
              cosmetic:

                · **NO CHEVRON.** The topbar already teaches the distinction —
                  the account chip has a chevron and drops a list, the credits
                  chip has none and opens a modal. This control opened a modal
                  while wearing dropdown grammar.
                · **RADIUS 8, NOT A PILL.** Pills in this system are read-only
                  state (kind badges, count pills, IN USE). A rounded rect is
                  what clickable controls wear, so the shape says press.
                · **THE VALUE IN MONO**, which ties it to the receipt line
                  directly above so the pair reads as one thought: what this
                  costs, how it is set.

              RIGHT is `Start from photos`. The explainer already promises photos and
              the flow already existed — but the only door was a card further
              down the page, so the promise and the way in were nowhere near
              each other.

              The two carry different weights on purpose: the settings control
              DISPLAYS state as well as acting, so it is a chip; this is purely
              an action, so it is a link.

              ⚠ **EACH IS ABSENT RATHER THAN DISABLED WHERE ITS DOOR IS SHUT**
              (D-180) — the settings chip off the author road, the photos link
              where the server did not open concept upload. An account with
              neither sees no row at all.
            */}
            {authorRoad || conceptUploadEnabled ? (
              <div className="dpc-hero__actions">
                {authorRoad ? (
                  <CastSettingsButton
                    idPrefix="dpc-hero"
                    style={style}
                    imagination={imagination}
                    onStyle={setStyle}
                    onImagination={setImagination}
                  />
                ) : null}
                <span className="dpc-hero__actionsair" aria-hidden="true" />
                {conceptUploadEnabled ? (
                  <button
                    type="button"
                    className="dpc-hero__photos"
                    onClick={() => conceptCard.current?.openEmpty()}
                  >
                    <Icon d={P.image} size={13} />
                    Start from photos
                  </button>
                ) : null}
              </div>
            ) : null}
            </div>
          </div>

          {/*
            THE DECK (#234, founder-ordered — his own spec is filed at
            `docs/specs/Casting-ui-ux-design/casting-hero.md`).

            It replaces the split-face pair, which was brand art: one
            composition, four looks, the same set. His words on it were
            *"boring"*, and the reason the deck is better is not that it moves
            — it is that every card is a REAL signed performer from this
            account, shown beside the REAL sentence that cast them. A prompt
            field asks the customer to imagine the result; this shows it, and
            teaches what a good brief looks like by displaying real ones.

            ⚠ **IT IS A SHOWCASE, NOT THIS ACCOUNT'S SHELF (#240).** The
            first build read the roster and fell back to a curated set, which
            is what his spec §5 said; he corrected it the hour he saw it, and
            the reason is the whole point of the section — the customer who
            needs a hero is the one who has cast nobody, and a fresh account
            would have opened on an empty column. One deck, the same for
            everyone, and no card opens a room because none of them is anyone's
            property. A click fills the box below, like a TRY chip.
          */}
          <HeroDeck
            onUseBrief={(cardBrief) => {
              setBrief(cardBrief);
              /*
                And the caret goes to the box, which is the whole confirmation
                this action gets. The chips sit inches from the field; a deck
                card is a column away, so a silent fill would read as a dead
                control. `focusBrief` is the same helper the concept card and
                the new-cast tile use — one place that knows where the box is.
              */
              focusBrief();
            }}
          />
        </div>

        {/* ---- the two entry cards ---- */}
        <div className="dpc-entries">
          {/*
            UPLOAD A CONCEPT (#185, his order 2026-08-28) — the card that was
            the F5 placeholder, now the door to it where the scope admits her.

            His rename is the first half of the order ("the upload a person
            should be upload a concept or somthing like that"), and it is not
            only a name: *a real person* promised likeness upload, which the
            product still does not do and this road deliberately does not
            become. The picture is read once and dropped; what casts is words.

            The server decides which state is drawn, as with every other gate on
            this page — the client asks rather than assumes.
          */}
          <ConceptUploadCard
            ref={conceptCard}
            describe={
              config.data.conceptUploadEnabled
                ? async (imageBase64) =>
                  (await describeConcept.mutateAsync({ imageBase64 })).description
                : null
            }
            /* Server-derived, straight through to the modal's cost line (D-15). */
            priceCredits={price}
            /*
              CAST FROM THE MODAL — his first amendment on #196, verbatim:
              *"the button should be cast it and it automatically casts the
              prompt the same flow the original prompt and casting takes just
              through the modal"*.

              What casts is EXACTLY what "Use this brief" would have put in the
              box — the same merge, so the two actions can never disagree about
              what her brief is, and the append rule (founder record on #185:
              the description lands beside her words, never on top of them)
              governs the paid road as well as the free one.

              ⚠ `setBrief` FIRST, and it is not the dispatch source — the
              explicit argument is. It is the safety net: the dialog has already
              closed by the time this runs, so if the session or the roll is
              refused, her edited words would otherwise be gone with it. This
              way they are sitting in the box under the failure toast, one tap
              from trying again.
            */
            onCast={(description) => {
              const text = briefWithDescription(brief, description);
              setBrief(text);
              void startCasting(text);
            }}
            onDescribed={(description) => {
              /*
                It fills the box and STOPS. Nothing is rolled, nothing is
                charged, and the words are hers to edit first — which is the
                whole promise of reading them into her own brief rather than
                attaching a picture to a purchase.

                Since #196 this fires on her CONFIRM rather than on the read's
                arrival: the card shows her the photograph beside the words
                first, and hands them over when she taps "Use this brief". The
                contract here is unchanged — the page still decides where words
                go, and they still land BESIDE anything she has already typed.
              */
              setBrief((current) => briefWithDescription(current, description));
              focusBrief();
            }}
          />

          {/*
            The Klieg-owned catalog of ready-made signed casts — a future
            product, not this account's roster (founder correction, 2026-08-01;
            an earlier reading wired it to scroll to the grid below, which just
            duplicated what was already on screen).

            Ships as an honest skeleton per F5: the card keeps its place as the
            eventual front door, and says plainly that it is coming. The
            backlog entry it belongs to is the pre-made roster / starter casts
            catalog.
          */}
          <div className="dpc-entry dpc-entry--inert" aria-disabled="true">
            <span className="dpc-entry__stack" aria-hidden="true">
              <span className="dpc-entry__chip" />
              <span className="dpc-entry__chip" />
              <span className="dpc-entry__chip" />
            </span>
            <span className="dp-stack" style={{ gap: 4, minWidth: 0 }}>
              <span className="dp-label">Browse the signed roster</span>
              <span className="dp-secondary">
                A ready-made roster of signed cast members, cleared to use without casting —
                coming.
              </span>
            </span>
          </div>
        </div>
      </div>

      {openSessions.data && openSessions.data.length > 0 ? (
        <section className="dp-stack" style={{ gap: 12 }}>
          {/*
            Retention stated wherever unsigned sheets surface. A sheet that
            quietly disappears after a week is a worse surprise than one that
            said so.
          */}
          <SectionHead
            eyebrow="Unsigned sheets"
            aside="Unsigned sheets clear after 7 quiet days."
          />
          {/*
            One row that scrolls, not a grid that grows.

            Unsigned sheets are working state — scratch, kept for seven days —
            and a grid of them expands forever until it outweighs the roster it
            sits above. The cast is the subject of this page; the scratch should
            never be able to push it below the fold.

            A row also says the right thing about what these are: a shelf you
            scan sideways and pick from, rather than a collection you browse.
          */}
          <div
            className="dpc-sheetrow"
            role="group"
            aria-label="Unsigned sheets"
            tabIndex={0}
          >
            {openSessions.data.map((entry, index) => (
              <Card key={entry.sessionId} className="dpc-sheetcard dpc-menuhost">
                <button
                  type="button"
                  className="dpc-sheetcard__open"
                  onClick={() => navigate(`/casting/s/${entry.sessionId}`)}
                >
                  {/*
                    Faces, so the card looks like the sheet it opens.

                    A contact strip rather than one hero image: this is a
                    casting product, and four faces in a row is what a sheet
                    IS — one big thumbnail would say "an image" instead. The
                    tiles keep the candidate 4:5 so they read as the same
                    objects the sheet is made of.

                    A sheet whose candidates have all expired or not landed
                    shows nothing rather than a row of grey boxes: an empty
                    strip is quieter than a broken one.
                  */}
                  {entry.previewUrls.length > 0 ? (
                    <span className="dpc-sheetcard__strip" aria-hidden="true">
                      {entry.previewUrls.map((url) => (
                        <span key={url} className="dpc-sheetcard__frame">
                          <img src={url} alt="" loading="lazy" />
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {/*
                    Two lines, then an ellipsis (fable-891 §2). The `title`
                    keeps the whole brief one hover away rather than losing it
                    — and the card's menu label already carries the full string,
                    so a screen reader was never reading the clamp.
                  */}
                  <span
                    className="dp-label dpc-sheetcard__brief"
                    title={entry.briefText ?? undefined}
                  >
                    {entry.briefText ?? "Untitled sheet"}
                  </span>
                  <span className="dp-secondary">
                    {entry.rollCount} roll{entry.rollCount === 1 ? "" : "s"}
                    {entry.keptCount > 0 ? ` · ${entry.keptCount} kept` : ""}
                    {/*
                      Which one you were last working on, said once and
                      quietly. The row is ordered by activity, so this only
                      names what the ordering already implies — a tag on every
                      card would be a legend, not a signal.
                    */}
                    {index === 0 ? <span className="dpc-sheetcard__latest">latest</span> : null}
                  </span>
                  {/*
                    The retention confession, per card.

                    Normally it just says how long the sheet has been sitting —
                    which is useful on its own and costs nothing. Inside the
                    last two days it says when the sheet goes instead, in the
                    same quiet register: no colour, no icon, no countdown. The
                    goal is that expiry is never a surprise, not that anyone
                    feels chased.
                  */}
                  {(() => {
                    const line = sheetAgeLine(entry);
                    if (!line) return null;
                    return (
                      <span
                        className={
                          isExpiryWarning(line)
                            ? "dp-secondary dpc-sheetcard__expiry"
                            : "dp-secondary"
                        }
                      >
                        {line}
                      </span>
                    );
                  })()}
                </button>
                {/*
                  Deliberate disposal, quietly. A full destructive button sat
                  under every sheet and made disposal the loudest thing on a
                  card whose subject is the work — so it becomes the
                  foundation's over-media chip: dark glass, in the corner,
                  revealed on hover.

                  Still deliberate, not hidden. It carries a real label for
                  screen readers, appears on keyboard focus, and stays visible
                  on touch, where there is no hover to reveal it.

                  A BIN, not an ×. An × means close — it is the glyph on every
                  dialog and every dismissed banner — so putting it on a
                  permanent delete asks the user to learn an exception.

                  And the confirm is ours now. It was `window.confirm`: an OS
                  dialog with the browser's chrome, the browser's typography and
                  a title bar naming localhost, dropped into the middle of a
                  monochrome editorial product. Arming the chip in place is the
                  same single deliberate confirmation, in our own voice — and it
                  disarms on a second thought, which a system dialog's Cancel
                  makes into an event.
                */}
                <span className="dpc-sheetmenu">
                  <CardMenu
                    label={`the sheet "${entry.briefText ?? "Untitled sheet"}"`}
                    open={menuFor === entry.sessionId}
                    onToggle={() =>
                      setMenuFor(menuFor === entry.sessionId ? null : entry.sessionId)
                    }
                    onCancel={() => setMenuFor(null)}
                    items={[
                      {
                        label: "Open sheet",
                        onSelect: () => navigate(`/casting/s/${entry.sessionId}`),
                      },
                      {
                        label: "Copy link",
                        onSelect: async () => {
                          await navigator.clipboard.writeText(
                            `${window.location.origin}/casting/s/${entry.sessionId}`,
                          );
                          setMenuFor(null);
                          toast("Link copied");
                        },
                      },
                      {
                        label: "Delete",
                        danger: true,
                        onSelect: () => {
                          setMenuFor(null);
                          setArmed(entry.sessionId);
                        },
                      },
                    ]}
                  />
                </span>
              </Card>
            ))}
          </div>
        </section>
      ) : openSessions.isFetched ? (
        /*
          THE EMPTY STATE, which said nothing at all.

          A sheet that expired and a sheet that was never cast leave exactly
          the same empty page — expired sessions are gone from the projection
          entirely, so the client genuinely cannot tell them apart. Stating the
          RULE is true in both cases; claiming an event would be inventing a
          history to fill a silence.

          Gated on `isFetched` so it does not flash before the query answers.
        */
        <section className="dp-stack" style={{ gap: 12 }}>
          <SectionHead eyebrow="Unsigned sheets" />
          <p className="dp-secondary">{RETENTION_EMPTY_STATE}</p>
        </section>
      ) : null}

      {/*
        One dialog for the page, not one per card. A modal is a single
        conversation, and eight mounted copies waiting in the DOM would be
        eight things to keep in sync for no benefit.
      */}
      {/*
        THE CONFIRM NAMES WHO SURVIVES (D-107). "Every candidate on it will be
        deleted" was true when a sheet made nothing permanent, and became a lie
        the moment one could be signed - the retention law protects a signed
        Cast and the siblings her card is made of, so the sentence promised a
        deletion that does not happen and frightened the user about work that
        was never at risk.
      */}
      {armedSheet ? (
        <ConfirmDialog
          title="Delete this sheet?"
          body={sheetDeleteCopy(armedSheet)}
          confirmLabel="Delete sheet"
          busyLabel="Deleting…"
          busy={abandoning === armedSheet.sessionId}
          onConfirm={() => discardSheet(armedSheet.sessionId)}
          onCancel={() => setArmed(null)}
        />
      ) : null}

      {/*
        THE DIALOG THAT HAD NO FIELD. It said "Rename this cast?" and offered
        Save name with nothing to type into — the one control it existed for was
        missing, which is a defect no amount of styling would have fixed.
      */}
      {renaming ? (
        <RenameDialog
          currentName={renaming.name || "Unnamed"}
          imageUrl={renaming.imageUrl}
          busy={renameCast.isPending}
          onCancel={() => setRenaming(null)}
          onSave={async (name) => {
            try {
              await renameCast.mutateAsync({ castId: renaming.castId, name });
              await utils.castingV2.roster.invalidate();
              setRenaming(null);
              /*
                KEPT, conservatively. This one waits on `roster` rather than
                `openSessions`, so it may well be fast — but it was not
                measured, and the sheet delete on this same page proved that
                assuming a surface refreshes promptly is exactly the mistake
                this pass exists to stop making. It goes when somebody times it.
              */
              toast("Renamed");
            } catch (error) {
              toast(error instanceof Error ? error.message : "That name could not be saved.");
            }
          }}
        />
      ) : null}

      {deletingCast ? (
        <DestructiveConfirm
          name={deletingCast.name ?? "this cast"}
          imageUrl={deletingCast.imageUrl}
          busy={deleteCast.isPending}
          onCancel={() => setDeletingCast(null)}
          onConfirm={async () => {
            try {
              await deleteCast.mutateAsync({
                clientRequestId: createClientRequestId(),
                castId: deletingCast.castId,
              });
              await utils.castingV2.roster.invalidate();
              await utils.castingV2.openSessions.invalidate();
              /*
                KEPT for the same measured reason as the sheet delete above:
                this awaits `openSessions.invalidate()` too, so it inherits the
                same seven-second refresh before anything visibly changes.
                Removing it would have traded a duplicate for a silence.
              */
              toast(`${deletingCast.name ?? "That cast"} was deleted.`);
              setDeletingCast(null);
            } catch (error) {
              toast(error instanceof Error
                ? error.message
                : `${deletingCast.name ?? "That cast"} could not be deleted.`);
            }
          }}
        />
      ) : null}

      <section className="dp-stack" style={{ gap: 12 }}>
        {/*
          Search and scope belong to the ROSTER, and now sit with it.

          They were above the unsigned-sheets row, which put a control two
          sections away from the only thing it acts on — and next to a row of
          sheets it does not filter at all, which is worse than merely distant.
          A filter reads as belonging to whatever it is nearest.

          This is also what the prototype drew: "filter row above" meant above
          the roster grid. The unsigned-sheets section landed between them
          later and quietly took the search with it.
        */}
        <div className="dpc-filters">
          <Field compact className="dpc-filters__search">
            <Search size={13} strokeWidth={2} aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cast by name or look"
              aria-label="Search cast"
            />
          </Field>
          {ROSTER_SCOPES.map((option) => (
            <ScopePill key={option} active={scope === option} onClick={() => setScope(option)}>
              {option}
            </ScopePill>
          ))}
        </div>

        {/*
          Scope label + count, as drawn. The count is real — and when it is
          zero it says zero, which is the whole difference between this and
          "184 performers already cleared for paid ads".
        */}
        <div className="dpc-rosterhead">
          <span className="dp-label" style={{ fontSize: 13.5 }}>
            {scope === "All" ? "All cast" : scope === "Signed" ? "Signed" : "Unsigned"}
          </span>
          <span className="dp-small">
            {scopeCounts[scope]} {scopeCounts[scope] === 1 ? "cast member" : "cast members"}
          </span>
        </div>

        {/* 178px 4:5 tiles, dashed create tile first (10-shared-patterns). */}
        <div className="dpc-roster">
          <DropZone className="dpc-roster__new" onClick={focusBrief}>
            <Plus size={17} strokeWidth={1.7} aria-hidden="true" />
            <span className="dp-secondary">New cast member</span>
          </DropZone>
          {shownCasts.map((cast) => (
            <div className="dpc-castcard__wrap dpc-menuhost" key={cast.castId}>
            <button
              type="button"
              className="dpc-castcard"
              onClick={() => navigate(`/casting/cast/${cast.castId}`)}
            >
              <span className="dpc-castcard__frame">
                {cast.imageUrl ? <img src={cast.imageUrl} alt="" /> : null}
                {cast.status === "building" ? (
                  <span className="dpc-castcard__building">BUILDING</span>
                ) : null}
              </span>
              <span className="dpc-castcard__name">{cast.name ?? "Unnamed"}</span>
              <span className="dp-metadata">{cast.personaLine ?? cast.castId}</span>
            </button>
            {/*
              Delete needs BOTH the server's door open AND her package
              finished. The second is the founder's ruling: the deletion
              authority excludes a `provisioning` model by design, so a Delete
              on a building tile could only ever refuse, and a menu item that
              always refuses is a dead control. It appears when she finishes.
            */}
            <span className="dpc-castmenu">
              <CardMenu
                label={cast.name ?? "this cast"}
                open={castMenu === cast.castId}
                onToggle={() => setCastMenu(castMenu === cast.castId ? null : cast.castId)}
                onCancel={() => setCastMenu(null)}
                items={castMenuItems(cast)}
              />
            </span>
            </div>
          ))}
        </div>

        {/* A sentence, so Archivo — mono is for machine facts only. */}
        {casts.length === 0 ? (
          <span className="dp-secondary">
            No one signed yet — cast a sheet, then sign the candidate you want to keep working
            with.
          </span>
        ) : null}
      </section>
    </AppChrome>
  );
}
