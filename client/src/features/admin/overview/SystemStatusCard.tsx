import { useState, useEffect, useCallback } from "react";
import { LeaderRow } from "@/foundation";
import { staffDateTime } from "@/foundation/staffDate";

/**
 * SYSTEM (brief 07 §8) — leader rows, mono values, no status badge ramp.
 *
 * Uptime, DB latency, active banners and the server start stamp, read live from
 * `/api/health` on the same 30s cadence as before. **The endpoint, the interval
 * and every number are unchanged**; what goes is the emerald/amber/red badge
 * and the `latencyColor` ramp.
 *
 * ## Why latency stopped being a traffic light
 *
 * `latencyColor` painted <100ms emerald, <500ms amber, else red — so a
 * perfectly healthy database made the card green, which is §3's whole
 * argument: *"a healthy platform is as colourful as a broken one, so colour
 * carries no information."* Latency is a measured number and reads as one now.
 *
 * **The one state that keeps colour is the one that is genuinely wrong**: an
 * unreachable health endpoint. That is `--errorInk`, and it is the only accent
 * this card can ever show.
 *
 * ⚠ `--errorInk` rather than `--error` on the word: `tokens.css` records that
 * plain `--error` on the dark surface measures 3.40:1, below the 4.5:1 AA
 * floor, which is why `--errorInk` exists and is overridden in dark and
 * `--error` deliberately is not.
 *
 * ## The voice ration rows (#2471)
 *
 * His card: *"the house can see the month's ration before a customer meets its
 * end"*. They live HERE rather than in a third card for two reasons, and the
 * second is the load-bearing one: the section's head reads *"System and
 * banners"* and its own comment records that naming both cards is what the
 * head is for, so a third card would make the head untrue; and the ration IS a
 * system capacity reading, the same kind of fact as uptime and latency.
 *
 * ⚠ **THEY DO NOT TOUCH THE `Unreachable` BADGE, AND THAT IS DELIBERATE.**
 * That badge means `/api/health` did not answer — our own server. A quiet
 * voice vendor is a different fact, and lighting one lamp for both would tell
 * a staff member the platform is down when a third party is. The rows carry
 * their own words in the value slot instead, which is where this card already
 * puts an unknown (`—`).
 *
 * ⚠ **AND THEY ADD NO ACCENT, which keeps `--errorInk` the only one this card
 * can show.** Words where a number belongs is the signal — `Not readable`
 * cannot be mistaken for a count — and §3's argument is exactly that colour
 * carrying no information is worse than none.
 */

interface HealthResponse {
  status: "healthy" | "unhealthy";
  uptime: number;
  timestamp: string;
  checks: {
    database: {
      status: "up" | "down";
      latencyMs: number;
    };
  };
}

/**
 * What `admin.getVoiceAllowance` answers. Structural rather than imported from
 * the server so this card stays a client module; the page passes the query's
 * own data straight through, so the compiler holds the two in step at the call
 * site (it refused this prop until the shapes agreed).
 */
type VoiceAllowanceView =
  | {
      state: "read";
      operationsLeft: number;
      operationsTotal: number;
      slotsLeft: number;
      slotsTotal: number;
    }
  | { state: "not_configured" }
  | { state: "unreadable"; failureClass: string };

interface SystemStatusCardProps {
  activeBanners: number;
  serverStartedAt: string | Date;
  /** `undefined` while the query is in flight — drawn as the card's own `—`. */
  voiceAllowance?: VoiceAllowanceView;
}

/**
 * `12 of 95`, because a bare remainder cannot be judged.
 *
 * ⚠ **The card asks for "a count" and this prints two numbers per row on
 * purpose**: `12` left is healthy on a 95 ration and nearly spent on a 15 one,
 * and the whole point of the row is seeing the end coming. The total is also
 * the only thing that shows a plan change — his went from pay-as-you-go to 30
 * slots in one day while #2469 was being built.
 */
function ofTotal(left: number, total: number): string {
  return `${left.toLocaleString()} of ${total.toLocaleString()}`;
}

/**
 * The three states as words a staff member can act on.
 *
 * `not_configured` says there is no voice road rather than implying a fault:
 * boot refuses when the scope names anyone and the key is absent, so a running
 * process without one gives nobody a voice (`SENTRY_DSN`'s posture). The
 * failure class rides the unreadable line because it is the one thing that
 * says where to look — our account, or the vendor being slow — and this is a
 * staff surface, where operational metadata belongs.
 */
function voiceRowValue(
  allowance: VoiceAllowanceView | undefined,
  read: (a: Extract<VoiceAllowanceView, { state: "read" }>) => string,
): string {
  if (!allowance) return "—";
  if (allowance.state === "not_configured") return "Not set up";
  if (allowance.state === "unreadable") return "Not readable";
  return read(allowance);
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SystemStatusCard({
  activeBanners,
  serverStartedAt,
  voiceAllowance,
}: SystemStatusCardProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        setHealth(await res.json());
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const dbStatus = health?.checks.database;

  return (
    <div className="dp-ov__card">
      <div className="dp-ov__cardhead">
        <span className="dp-eyebrow dp-ov__blocklabel">SYSTEM</span>
        <span className="dp-ov__spacer" />
        {error && <span className="dp-ov__unreachable">Unreachable</span>}
      </div>

      <div className="dp-leaders dp-leaders--divided">
        <LeaderRow
          label="Server uptime"
          value={health ? formatUptime(health.uptime) : "—"}
        />
        <LeaderRow
          label="Database latency"
          value={dbStatus ? `${dbStatus.latencyMs.toFixed(0)}ms` : "—"}
        />
        <LeaderRow label="Active banners" value={activeBanners} />
        {/*
          BOTH VOICE NUMBERS, BECAUSE EITHER ONE ENDS A KEEP (#2471). The
          server refuses a Keep on operations OR slots — two separate
          refusals — so operations alone would hide half the cliff: an account
          with forty operations left and every slot full cannot keep a voice,
          and this card would read healthy while customers met a wall.
        */}
        {/*
          "Keeps" and not "makes": designing three voices to listen to spends
          NO operation — `max_voice_add_edits` counts saves and clones, and
          `keepCastVoice` spends exactly one. A row labelled "makes" would
          have had staff watching the wrong number fall.
        */}
        <LeaderRow
          label="Voice keeps left this month"
          value={voiceRowValue(voiceAllowance, (a) =>
            ofTotal(a.operationsLeft, a.operationsTotal),
          )}
        />
        <LeaderRow
          label="Voice slots free"
          value={voiceRowValue(voiceAllowance, (a) => ofTotal(a.slotsLeft, a.slotsTotal))}
        />
      </div>

      {/* The one thing a staff member can act on when the row says so: which
          side is quiet. Drawn only in that state, so the card gains no line
          when all is well. */}
      {voiceAllowance?.state === "unreadable" && (
        <p className="dp-ov__stamp">
          The voice service did not answer ({voiceAllowance.failureClass})
        </p>
      )}

      {/*
        ⚠ **#900 — this was a bare `toLocaleString()`**, so it took the
        machine's locale in full and rendered `13/09/2026, 10:30:33 pm`: a
        12-hour clock, and a numeric date, on a page whose every other stamp
        reads `Sep 13`. It draws from the admin house formatter now rather
        than gaining a fourth copy of the options — one fewer formatter, not
        one more.
      */}
      <p className="dp-ov__stamp">Server started {staffDateTime(serverStartedAt)}</p>
    </div>
  );
}
