import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  AppShell,
  Button,
  Card,
  Chip,
  DropZone,
  Field,
  Input,
  ScopePill,
  SectionHead,
} from "@/foundation";
import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import { DEFAULT_CASTING_PATH, type CastingPath } from "@shared/castingPaths";
import { DEFAULT_IMAGINATION, type Imagination } from "@shared/imagination";
import { CASTING_PATH_LINES } from "@/features/castingV2/castingPathCopy";
import { ImaginationToggle } from "@/features/castingV2/components/ImaginationToggle";
import { PathToggle } from "@/features/castingV2/components/PathToggle";
import { useSheetState } from "@/features/castingV2/sheetState";
import { createDispatchLatch, type DispatchLatch } from "@/features/castingV2/singleFlight";
import { ConfirmDialog } from "@/features/castingV2/components/ConfirmDialog";
import { HeroMotion } from "@/features/castingV2/components/HeroMotion";
import { CardMenu } from "@/features/castingV2/components/CardMenu";
import { DeleteCastConfirm } from "@/features/castingV2/components/DeleteCastConfirm";
import { RenameCastDialog } from "@/features/castingV2/components/RenameCastDialog";
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
 * Seed chips — starting points, not presets. One tap fills the box; nothing is
 * applied until the user reads it and rolls.
 *
 * **Seed law (founder, 2026-07-31): every seed must be a brief the compiler
 * fully honours TODAY.** A seed is a promise about what the product can do,
 * and a seed the system silently strips is a worse lie than no seed — the user
 * taps it, pays, and gets something that ignored half of what they clicked.
 *
 * Four clauses, all founder-set, all learned from a seed that broke one:
 *
 *   1. **Honest** — the compiler must fully honour it today. No voice-only
 *      concepts (M8b), no presentation or lighting words (the framing law
 *      strips them by design), photoreal humans only until M9 certifies more.
 *   2. **A tiny story** — an archetype plus one vivid detail, in the register
 *      of "Bodega owner, Brooklyn, gravelly". The test is whether a stranger
 *      would tap it out of curiosity. A demographic description nobody would
 *      touch is capability-honest and useless.
 *   3. **Rest-state and permanent** — the detail must be structural and
 *      visible in a still, closed-mouth frame: a scar, a shaved head,
 *      freckles, bleached brows. Never a performed expression; a grin is
 *      performance, and mouth-closed framing would hide it anyway.
 *   4. **Verified** — a seed ships only once a sample tile has been generated
 *      and the detail confirmed to render. Two candidates were cut by this:
 *      "gap-toothed grin" (performance) and "scar through one eyebrow", which
 *      came back as a faint brow break rather than a scar.
 *
 * Seeds are **capability-versioned**: when Voice ships a voice seed returns,
 * when a cohort certifies at M9 an anime seed joins. `requires` records the
 * gate so re-enabling is a deliberate edit rather than an act of memory.
 *
 * Deliberately loose: these state little, so the sheet's own latitude is what
 * the user sees demonstrated. Stated facts lock; everything else varies.
 */
const CASTING_SEEDS: Array<{ label: string; shows: string; requires?: string }> = [
  /*
    A FIFTH CLAUSE, founder 2026-08-01: a seed must be a brief this audience
    would actually type.

    The previous set obeyed every other clause and still missed. A blacksmith
    with soot in the creases and a nurse at the end of a double shift are good
    briefs — they are simply not what someone opening this product came to cast.
    People here are making UGC creators, AI influencers, models and founders,
    and a seed row is a claim about what the product is FOR. Interesting is not
    the bar; recognisable is.

    CLAUSE 6 (founder, 2026-08-01): a seed whose DETAIL or ARCHETYPE is
    strongly sex-coded states its sex. Curation, not capability.

    "Beauty creator, late 20s, bleached brows" left sex open and the male
    tiles read costume-y. Nothing malfunctioned — the system obeyed a brief
    that said nothing about sex, exactly as it should. The seed gambled and
    lost. "Silver at the temples" is the same bet: idiomatically a phrase
    about men, and it had been sitting open too.

    So the four split deliberately. Two leave sex open because their details
    read well on anybody — a shaved head, freckles — and those are the seeds
    that demonstrate latitude. Two state it, because their details do not.

    This does not contradict clause 5. That one is about pinning sex by
    ACCIDENT, on a word nobody noticed writing; this one is about pinning it
    on purpose, where the alternative is a tile that undersells the product.

    AND NO PRONOUNS (clause 5) — "Freckles she never covered" made the founder ask whether
    the sex lock was intended — it was not. The interpreter reads "she"
    correctly and pins sex, so that seed quietly closed an axis it existed to
    demonstrate. A seed showing latitude must not spend it on a word nobody
    noticed writing — which is why the two that DO state sex say so in plain
    words rather than leaking it.
  */
  // Sex left OPEN — the detail reads well on anyone, so these are the two
  // seeds that demonstrate latitude.
  { label: "Runway model, early 20s, shaved head", shows: "category + age lock, look varies" },
  { label: "UGC creator, mid-20s, freckles across the nose", shows: "creator-type, sex varies" },
  // Sex STATED — the detail is sex-coded, so leaving it open was a gamble.
  { label: "A skincare founder in his 40s, silver at the temples", shows: "founder-type, age reads in the hair" },
  { label: "A beauty creator in her late 20s, bleached brows", shows: "influencer-type, grooming detail renders" },
];

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
  /* The imagination meter (#131 slice E): LOW is his default; drawn only on the author road. */
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

  const focusBrief = () =>
    document.querySelector<HTMLInputElement>('input[aria-label="Casting brief"]')?.focus();

  const utils = trpc.useUtils();
  const config = trpc.castingV2.config.useQuery({});
  const openSessions = trpc.castingV2.openSessions.useQuery(
    {},
    { enabled: config.data?.enabled === true },
  );

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
      <AppShell breadcrumb="Casting" current="casting" width="browse">
        <span className="dp-metadata">Loading…</span>
      </AppShell>
    );
  }

  /*
    Flag off is a real state, not a blank page. The rail links here for every
    signed-in user while the scope is founder-only, so this is what most
    accounts see — and it should read as "not yet" rather than as breakage.
  */
  if (!config.data?.enabled) {
    return (
      <AppShell breadcrumb="Casting" current="casting" width="browse">
        <div className="dp-stack" style={{ gap: 9, maxWidth: 520 }}>
          <span className="dp-eyebrow">Casting</span>
          <h1 className="dp-headline">Not open on this account yet.</h1>
          <p className="dp-body">
            Casting is being tested with a small group first. Nothing here is
            charged, and your existing models are unaffected.
          </p>
        </div>
      </AppShell>
    );
  }

  const price = config.data.rollPriceCredits ?? ROLL_PRICE_FALLBACK;
  const candidatesPerRoll = config.data.candidatesPerRoll ?? 8;
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

  const startCasting = async () => {
    /*
      The latch is a ref because `setStarting(true)` does not take effect until
      the next render — two clicks (or two Enters) in one frame both pass a
      state-based guard and both create a session and a paid roll. The ref
      closes on the click that opened it.
    */
    if (brief.trim().length < 3) return;
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
          briefText: brief.trim(),
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
          /* The meter travels only where it was drawn — the path's rule, one control over. */
          ...(authorRoad ? { imagination } : {}),
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
    <AppShell breadcrumb="Casting" current="casting" width="browse">
      <div className="dp-stack" style={{ gap: 12 }}>
        {/* ---- hero card: copy left, the pair right, one seam between ---- */}
        <div className="dpc-hero">
          <div className="dpc-hero__copy">
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
            <span className="dp-body">
              A cast member is a face and a presence — signed once, reusable in every campaign.
            </span>

            <Field className="dpc-hero__field">
              <Input
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void startCasting();
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
              <Button variant="primary" size="small" onClick={startCasting} disabled={starting}>
                {starting ? "Casting…" : "Cast it"}
                {starting ? null : <ArrowRight size={12} strokeWidth={2.2} aria-hidden="true" />}
              </Button>
            </Field>
            {/*
              THE PATH, CHOSEN BEFORE THE MONEY (design §6; founder ruling
              2026-08-21, *"this is the way foward 100%"*).

              Under the brief field and above the TRY row, which is where §6
              puts it — between the sentence and the seeds, so the tradeoff is
              read on the way to the button rather than beside it. It is not a
              modal and it is not a step: one control, two states, default
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
            {authorRoad ? (
              <ImaginationToggle
                idPrefix="dpc-hero-imagination"
                label="How far the author goes"
                value={imagination}
                onChange={setImagination}
              />
            ) : null}
            {/*
              Nudge chips. One tap fills the box — they do not roll, and they
              carry no price of their own. A chip that both spends and hides
              the cost is how a one-tap affordance stops reading as a purchase;
              the priced button sits directly above them (D-15).
            */}
            <div className="dp-row" style={{ gap: 7 }}>
              <span className="dp-chrome">TRY</span>
              {CASTING_SEEDS.map((seed) => (
                <Chip key={seed.label} onClick={() => setBrief(seed.label)}>
                  {seed.label}
                </Chip>
              ))}
              {/*
                THE COST, IN THE ROW THAT IS ALREADY THERE.

                It had its own line under the field, which pushed the seeds down
                and left a gap between the box and them — a price is metadata
                and metadata should not cost a row. Folded to the end of the TRY
                row it sits at the same optical distance from the button and
                takes no vertical space at all.

                NO BALANCE HERE (founder ruling, 2026-08-03). Casting from the
                lobby happens once; "how much is left" answers a question nobody
                is asking yet. It earns its place on the sheet, where you roll
                again and again and the number is actually moving.
              */}
              <span className="dpc-hero__cost">
                <span className="dpc-signm__tilde">~</span> {price} credits
              </span>
            </div>
          </div>

          {/*
            The split pair. Its construction is the point: a 1px gap over a
            `--border` background, plus a 1px outline, so the seam between the
            two frames and the edge around them are the same hairline. Two
            bordered boxes side by side would read as two cards; this reads as
            one pane, split.

            The art is the founder's split-face series (2026-08-05): one
            composition, four looks, an identical studio background — carried
            as seam-anchored halves so the CSS seam IS the art's dividing
            line. HeroMotion flicks the faces through the looks while the set
            never moves, which is the product told as a picture: same shoot,
            take after take. Motion laws live in the component. No pills:
            structure ships, claims do not (F5).
          */}
          <div className="dpc-hero__pair">
            <HeroMotion />
          </div>
        </div>

        {/* ---- the two entry cards ---- */}
        <div className="dpc-entries">
          {/*
            Upload-a-real-person ships as drawn, inert, with copy that says so
            (F5 supersedes the earlier decision to omit it). The prototype's
            "Six photos or one 20-second clip. Likeness locks in about four
            minutes." is a promise about a feature that does not exist, so the
            structure stays and the claim goes.
          */}
          <div className="dpc-entry dpc-entry--inert" aria-disabled="true">
            <span className="dpc-entry__icon">
              <Upload size={14} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="dp-stack" style={{ gap: 4, minWidth: 0 }}>
              <span className="dp-label">Upload a real person</span>
              <span className="dp-secondary">
                Casting from your own photos is coming. For now, describe the person and cast
                them.
              </span>
            </span>
          </div>

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
        <RenameCastDialog
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
        <DeleteCastConfirm
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
    </AppShell>
  );
}
