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
import { useSheetState } from "@/features/castingV2/sheetState";
import { createDispatchLatch, type DispatchLatch } from "@/features/castingV2/singleFlight";
import { ConfirmDialog } from "@/features/castingV2/components/ConfirmDialog";
import { SheetCardMenu } from "@/features/castingV2/components/SheetCardMenu";
import { classifyDispatchFailure } from "@/features/castingV2/dispatchFailure";
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

export default function CastingV2() {
  const [, navigate] = useLocation();
  const [brief, setBrief] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<RosterScope>("All");
  const [starting, setStarting] = useState(false);
  /** Closes synchronously on click; see `startCasting` and `singleFlight.ts`. */
  const latchRef = useRef<DispatchLatch | null>(null);
  if (!latchRef.current) latchRef.current = createDispatchLatch();
  const castLatch = latchRef.current;
  const reset = useSheetState((state) => state.reset);
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
      toast("Sheet deleted");
    } catch (error) {
      toast(error instanceof Error ? error.message : "That sheet could not be discarded.");
    } finally {
      setAbandoning(null);
    }
  };

  /** The sheet a delete has been requested for, resolved to its row. */
  const armedSheet = openSessions.data?.find((entry) => entry.sessionId === armed) ?? null;

  const createSession = trpc.castingV2.createSession.useMutation();
  const createRoll = trpc.castingV2.createRoll.useMutation();

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
      reset();
      setStartingRoll(true);
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
        })
        .then(() => setStartingRoll(false))
        .catch((error: unknown) => setDispatchFailure(classifyDispatchFailure(error)));

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

  const signedCount = 0; // Sign lands in M7; until then the roster is truly empty.
  const scopeCounts: Record<RosterScope, number> = {
    All: signedCount,
    Signed: signedCount,
    Unsigned: 0,
  };

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
                {starting ? "Casting…" : `Cast it · ${price} cr`}
                {starting ? null : <ArrowRight size={12} strokeWidth={2.2} aria-hidden="true" />}
              </Button>
            </Field>

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
            </div>
          </div>

          {/*
            The split pair. Its construction is the point: a 1px gap over a
            `--border` background, plus a 1px outline, so the seam between the
            two frames and the edge around them are the same hairline. Two
            bordered boxes side by side would read as two cards; this reads as
            one pane, split.

            The art is platform-owned synthetic output from the M3 identity run
            — one anchor held across views, which is precisely the claim the
            pair makes: the same person, framed twice. No pills: SIGNED would
            be false until M7 signs someone, and the prototype's "212 FRAMES"
            is invented. Structure ships, claims do not (F5).
          */}
          <div className="dpc-hero__pair">
            <div className="dpc-hero__slot">
              <img src="/casting-hero/hero-left.png" alt="" />
            </div>
            {/*
              The right frame carries a faint pseudo-text artifact along its
              bottom edge. `--trim-bottom` overscales the image inside the
              clipped slot so that edge is always outside the frame — which
              `object-position` alone cannot guarantee, because at a slot
              narrower than 3:4 cover-fit shows the image's full height and the
              artifact would come back.
            */}
            <div className="dpc-hero__slot">
              <img className="dpc-hero__img--trim-bottom" src="/casting-hero/hero-right.png" alt="" />
            </div>
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
            {openSessions.data.map((entry) => (
              <Card key={entry.sessionId} className="dpc-sheetcard">
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
                  <span className="dp-label">{entry.briefText ?? "Untitled sheet"}</span>
                  <span className="dp-secondary">
                    {entry.rollCount} roll{entry.rollCount === 1 ? "" : "s"}
                    {entry.keptCount > 0 ? ` · ${entry.keptCount} kept` : ""}
                  </span>
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
                <SheetCardMenu
                  label={entry.briefText ?? "Untitled sheet"}
                  open={menuFor === entry.sessionId}
                  onToggle={() =>
                    setMenuFor(menuFor === entry.sessionId ? null : entry.sessionId)
                  }
                  onOpenSheet={() => navigate(`/casting/s/${entry.sessionId}`)}
                  onCopyLink={async () => {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/casting/s/${entry.sessionId}`,
                    );
                    setMenuFor(null);
                    toast("Link copied");
                  }}
                  onArm={() => {
                    setMenuFor(null);
                    setArmed(entry.sessionId);
                  }}
                  onCancel={() => setMenuFor(null)}
                />
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/*
        One dialog for the page, not one per card. A modal is a single
        conversation, and eight mounted copies waiting in the DOM would be
        eight things to keep in sync for no benefit.
      */}
      {armedSheet ? (
        <ConfirmDialog
          title="Delete this sheet?"
          body={`"${armedSheet.briefText ?? "Untitled sheet"}" and every candidate on it will be deleted. This cannot be undone.`}
          confirmLabel="Delete sheet"
          busyLabel="Deleting…"
          busy={abandoning === armedSheet.sessionId}
          onConfirm={() => discardSheet(armedSheet.sessionId)}
          onCancel={() => setArmed(null)}
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
        </div>

        {/* A sentence, so Archivo — mono is for machine facts only. */}
        <span className="dp-secondary">
          No one signed yet — cast a sheet, then sign the candidate you want to keep working
          with.
        </span>
      </section>
    </AppShell>
  );
}
