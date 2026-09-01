import { useState, useEffect, useCallback } from "react";

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

interface SystemStatusCardProps {
  activeBanners: number;
  serverStartedAt: string | Date;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SystemStatusCard({ activeBanners, serverStartedAt }: SystemStatusCardProps) {
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
        <span className="dp-ov__blocklabel">SYSTEM</span>
        <span className="dp-ov__spacer" />
        {error && <span className="dp-ov__unreachable">Unreachable</span>}
      </div>

      <div className="dp-ov__leaders">
        <div className="dp-ov__leader">
          <span className="dp-ov__leaderlabel">Server uptime</span>
          <span className="dp-ov__spacer" />
          <span className="dp-ov__leadervalue">
            {health ? formatUptime(health.uptime) : "—"}
          </span>
        </div>
        <div className="dp-ov__leader">
          <span className="dp-ov__leaderlabel">Database latency</span>
          <span className="dp-ov__spacer" />
          <span className="dp-ov__leadervalue">
            {dbStatus ? `${dbStatus.latencyMs.toFixed(0)}ms` : "—"}
          </span>
        </div>
        <div className="dp-ov__leader">
          <span className="dp-ov__leaderlabel">Active banners</span>
          <span className="dp-ov__spacer" />
          <span className="dp-ov__leadervalue">{activeBanners}</span>
        </div>
      </div>

      <p className="dp-ov__stamp">
        Server started {new Date(serverStartedAt).toLocaleString()}
      </p>
    </div>
  );
}
