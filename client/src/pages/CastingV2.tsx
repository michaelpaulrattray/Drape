import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Plus, Search, Trash2, Upload } from "lucide-react";
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
import { classifyDispatchFailure } from "@/features/castingV2/dispatchFailure";
import heroPortrait from "@/assets/casting/hero-portrait.webp";
import heroSecondFrame from "@/assets/casting/hero-second-frame.webp";
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
 * The prototype's four were copied verbatim and two of them broke this:
 *   - "Night-routine voice, almost whispering" — voice-only concept. Voice is
 *     M8b, and M3 found prompt-based voice design is not reachable through
 *     either router yet. Returns when Voice ships.
 *   - "Gen-Z gym rat, ring light, fast talker" — "ring light" is a lighting
 *     instruction, and the framing law strips presentation words by design.
 *
 * Seeds are **capability-versioned**: when Voice ships a voice seed returns,
 * when a cohort certifies at M9 an anime seed joins. `requires` records the
 * gate so re-enabling is a deliberate edit rather than an act of memory.
 *
 * PROPOSED SET — awaiting the founder's pick. Chosen to show real range: one
 * per axis the compiler actually varies.
 */
const CASTING_SEEDS: Array<{ label: string; shows: string; requires?: string }> = [
  // The look axis. Verified: the interpreter emitted variationAxis="look" on
  // both graded calibration rounds for this brief.
  { label: "Editorial fashion model, early 20s", shows: "category + age lock, look variation" },
  // A character brief. "Unbothered" is a persona word the interpreter may map
  // to a stated energy — in which case it LOCKS flat across the eight rather
  // than varying, which is correct behaviour and worth being accurate about.
  { label: "Skincare founder, 40s, unbothered", shows: "character brief, stated energy locks" },
  // Dual heritage, now that the enum can hold both halves (founder ruling,
  // 2026-08-01). This is the shape real briefs arrive in.
  { label: "Nigerian-British woman, mid 30s", shows: "dual heritage + age lock" },
  // The older-age guard: age must be genuinely present in skin and structure.
  { label: "A retired fisherman in his 60s, weathered face", shows: "age band + skin texture" },
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

  const discardSheet = async (sessionId: string) => {
    if (abandoning) return;
    // One confirm. Exploratory work, but it is still the user's work.
    if (!window.confirm("Discard this sheet? The candidates on it are deleted.")) return;
    setAbandoning(sessionId);
    try {
      await abandonSession.mutateAsync({ sessionId });
      await utils.castingV2.openSessions.invalidate();
      toast("Sheet discarded");
    } catch (error) {
      toast(error instanceof Error ? error.message : "That sheet could not be discarded.");
    } finally {
      setAbandoning(null);
    }
  };

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
                placeholder="a dad in his 30s, dry humour, hands that have done some work"
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
              <img src={heroPortrait} alt="A cast member, portrait" />
            </div>
            <div className="dpc-hero__slot">
              <img src={heroSecondFrame} alt="The same cast member in a second frame" />
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

      {/* ---- search + scope. Empty-safe: it filters nothing gracefully. ---- */}
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
          <div className="dp-grid">
            {openSessions.data.map((entry) => (
              <Card key={entry.sessionId}>
                <button
                  type="button"
                  className="dpc-sheetcard__open"
                  onClick={() => navigate(`/casting/s/${entry.sessionId}`)}
                >
                  <span className="dp-label">{entry.briefText ?? "Untitled sheet"}</span>
                  <span className="dp-secondary">
                    {entry.rollCount} roll{entry.rollCount === 1 ? "" : "s"}
                    {entry.keptCount > 0 ? ` · ${entry.keptCount} kept` : ""}
                  </span>
                </button>
                {/*
                  Deliberate disposal. Destructive-on-hover per the foundation
                  button law, and one confirm — this is a pure delete of
                  exploratory work with no refund implications, since every
                  roll on the sheet was delivered.
                */}
                <Button
                  variant="quiet"
                  size="small"
                  destructive
                  disabled={abandoning === entry.sessionId}
                  onClick={() => discardSheet(entry.sessionId)}
                >
                  <Trash2 size={11} strokeWidth={2} aria-hidden="true" />
                  Discard this sheet
                </Button>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="dp-stack" style={{ gap: 12 }}>
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
