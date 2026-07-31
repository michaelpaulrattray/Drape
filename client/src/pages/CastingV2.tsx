import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  AppShell,
  Button,
  Card,
  Chip,
  DropZone,
  Field,
  Input,
  SectionHead,
} from "@/foundation";
import { trpc } from "@/lib/trpc";
import { createClientRequestId } from "@shared/clientRequestId";
import { useSheetState } from "@/features/castingV2/sheetState";

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
 * Starting points, not presets. They fill the box so the first sentence is
 * easy to write; nothing is applied until the user reads it and rolls.
 */
const TRY_BRIEFS = [
  "Skincare founder, 40s, unbothered",
  "Gen-Z gym rat, fast talker",
  "Bodega owner, Brooklyn, gravelly",
  "A retired boxer with a broken nose",
];

export default function CastingV2() {
  const [, navigate] = useLocation();
  const [brief, setBrief] = useState("");
  const [starting, setStarting] = useState(false);
  const reset = useSheetState((state) => state.reset);
  const setStartingRoll = useSheetState((state) => state.setStartingRoll);

  const config = trpc.castingV2.config.useQuery({});
  const openSessions = trpc.castingV2.openSessions.useQuery(
    {},
    { enabled: config.data?.enabled === true },
  );

  const createSession = trpc.castingV2.createSession.useMutation();
  const createRoll = trpc.castingV2.createRoll.useMutation();

  if (config.isLoading) {
    return (
      <AppShell breadcrumb="Casting" current="casting" width="working">
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
    if (brief.trim().length < 3 || starting) return;
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
      createRoll.mutate(
        {
          clientRequestId: createClientRequestId(),
          sessionId: session.sessionId,
          briefText: brief.trim(),
        },
        {
          onError: (error) => {
            setStartingRoll(false);
            toast(error.message);
          },
          onSettled: () => setStartingRoll(false),
        },
      );

      // Navigating IS the confirmation, so no toast — the toast law fires on
      // actions that leave you where you were, never on ones that move you.
      navigate(`/casting/s/${session.sessionId}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "That roll could not start.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppShell breadcrumb="Casting" current="casting" width="working">
      <div className="dp-stack" style={{ gap: 9 }}>
        <span className="dp-eyebrow">Casting</span>
        <h1 className="dp-headline">
          Say who you need.
          <br />
          Meet {candidatesPerRoll} of them.
        </h1>
        {/*
          The prototype's pitch is "a face, a voice and a way of talking".
          Voice is M8b and does not exist, and M3 found prompt-based voice
          design is not even reachable through either router yet — so the copy
          promises what the product does today. The honest-capability law is
          not only about controls.
        */}
        <p className="dp-body">
          A cast member is a face you can use again. Describe one in a sentence and pick from
          a sheet of {candidatesPerRoll}.
        </p>
      </div>

      <section className="dp-stack" style={{ gap: 12, maxWidth: 760 }}>
        <Field>
          <Sparkles size={13} strokeWidth={1.9} aria-hidden="true" />
          <Input
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void startCasting();
            }}
            placeholder="a dad in his 30s in a cluttered garage, dry humour"
            aria-label="Casting brief"
          />
          <Button variant="primary" size="small" onClick={startCasting} disabled={starting}>
            Cast it · {price} cr
            <ArrowRight size={12} strokeWidth={2.2} aria-hidden="true" />
          </Button>
        </Field>
        <span className="dp-metadata">
          {candidatesPerRoll} candidates · about a minute · you're charged once, when the roll
          starts
        </span>

        {/*
          Nudge chips. One tap fills the box — they do not roll, and they carry
          no price of their own. The plan is explicit about why: a chip that
          both spends and hides the cost is how a one-tap affordance stops
          reading as a purchase. The priced button sits directly above them
          (D-15), so the cost is never more than a glance away.
        */}
        <div className="dp-row" style={{ gap: 8 }}>
          <span className="dp-chrome">TRY</span>
          {TRY_BRIEFS.map((suggestion) => (
            <Chip key={suggestion} onClick={() => setBrief(suggestion)}>
              {suggestion}
            </Chip>
          ))}
        </div>
      </section>

      {openSessions.data && openSessions.data.length > 0 ? (
        <section className="dp-stack" style={{ gap: 12 }}>
          <SectionHead eyebrow="Unsigned sheets" aside="pick up where you left off" />
          <div className="dp-grid">
            {openSessions.data.map((entry) => (
              <Card
                key={entry.sessionId}
                interactive
                onClick={() => navigate(`/casting/s/${entry.sessionId}`)}
              >
                <span className="dp-label">{entry.briefText ?? "Untitled sheet"}</span>
                <span className="dp-secondary">
                  {entry.rollCount} roll{entry.rollCount === 1 ? "" : "s"}
                  {entry.keptCount > 0 ? ` · ${entry.keptCount} kept` : ""}
                </span>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="dp-stack" style={{ gap: 12 }}>
        <SectionHead eyebrow="Your roster" aside="signed cast members" />
        <div className="dp-grid">
          {/*
            The dashed create tile comes first and, until someone signs,
            it is the only tile. The create action never hides behind the
            collection (10-shared-patterns), and an empty grid with one real
            affordance beats a grid padded out with an explanation card the
            same size as a cast member.
          */}
          <DropZone
            style={{ aspectRatio: "4 / 5" }}
            onClick={() => document.querySelector<HTMLInputElement>(".dp-input")?.focus()}
          >
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
            <span className="dp-secondary">New cast member</span>
          </DropZone>
        </div>
        <span className="dp-metadata">
          No one signed yet — cast a sheet, then sign the candidate you want to keep working
          with.
        </span>
      </section>
    </AppShell>
  );
}
