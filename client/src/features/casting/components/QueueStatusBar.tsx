/**
 * QueueStatusBar — Shows queue position ONLY when there is a queue.
 *
 * Polls the queue status endpoint every 3s while a generation is active.
 * Only renders when there are pending items in the queue.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

interface QueueStatusBarProps {
  /** Whether a generation is currently in progress */
  isGenerating: boolean;
}

export function QueueStatusBar({ isGenerating }: QueueStatusBarProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (isGenerating) {
      setEnabled(true);
    } else {
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

  const { queue } = data;
  const isQueueBusy = queue.imagePending > 0;

  // Only show when there's actually a queue
  if (!isQueueBusy) return null;

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      style={{
        fontSize: 11,
        color: "rgba(255,255,255,0.35)",
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.06em",
        marginTop: 16,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#f59e0b",
          boxShadow: "0 0 6px rgba(245,158,11,0.4)",
          animation: "loadDotPulse 1.5s ease-in-out infinite",
        }}
      />
      <span>Place in queue: {queue.imagePending}</span>
    </div>
  );
}

export default QueueStatusBar;
