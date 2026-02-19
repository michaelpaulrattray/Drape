/**
 * QueueStatusBar — Shows queue position and daily quota during generation.
 *
 * Polls the queue status endpoint every 3s while a generation is active.
 * Displays:
 *   - Current queue load (active/capacity)
 *   - Daily generation quota remaining
 *
 * Renders inline below the loading overlay status message.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

interface QueueStatusBarProps {
  /** Whether a generation is currently in progress */
  isGenerating: boolean;
}

export function QueueStatusBar({ isGenerating }: QueueStatusBarProps) {
  const [enabled, setEnabled] = useState(false);

  // Only start polling once generation begins, stop when it ends
  useEffect(() => {
    if (isGenerating) {
      setEnabled(true);
    } else {
      // Small delay before disabling to show final state
      const timer = setTimeout(() => setEnabled(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isGenerating]);

  const { data } = trpc.generation.getStatus.useQuery(undefined, {
    enabled,
    refetchInterval: enabled ? 3000 : false,
    refetchIntervalInBackground: false,
  });

  if (!enabled || !data) return null;

  const { queue, dailyQuota } = data;
  const queueLoad = queue.imageActive + queue.imagePending;
  const isQueueBusy = queue.imagePending > 0;

  return (
    <div
      className="flex items-center justify-center gap-4"
      style={{
        fontSize: 9,
        color: "rgba(255,255,255,0.35)",
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.06em",
        marginTop: 16,
      }}
    >
      {/* Queue load indicator */}
      <span
        className="flex items-center gap-1.5"
        title={`${queue.imageActive} active, ${queue.imagePending} waiting`}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: isQueueBusy
              ? "#f59e0b"
              : queue.imageActive > 0
                ? "#22c55e"
                : "rgba(255,255,255,0.15)",
            boxShadow: isQueueBusy
              ? "0 0 6px rgba(245,158,11,0.4)"
              : "none",
            transition: "all 0.3s ease",
          }}
        />
        {isQueueBusy
          ? `Queue: ${queueLoad}/${queue.imageCapacity}`
          : `Active: ${queue.imageActive}/${queue.imageCapacity}`}
      </span>

      <span style={{ color: "rgba(255,255,255,0.1)" }}>|</span>

      {/* Daily quota */}
      <span
        style={{
          color:
            dailyQuota.remaining <= 5
              ? "rgba(239,68,68,0.6)"
              : "rgba(255,255,255,0.35)",
        }}
      >
        Today: {dailyQuota.used}/{dailyQuota.limit}
      </span>
    </div>
  );
}

export default QueueStatusBar;
