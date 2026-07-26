import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { loadPrivateEvidenceImage } from "./privateEvidenceImageLoader";

export interface PrivateEvidenceImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: ReactNode;
}

type ImageState =
  | { phase: "loading"; objectUrl: null }
  | { phase: "loaded"; objectUrl: string }
  | { phase: "unavailable"; objectUrl: null };

/**
 * Owner-private image surface. The endpoint is never assigned directly to an
 * <img>, so retryable HTTP/stream failures cannot flash a broken-image icon.
 */
export function PrivateEvidenceImage({
  src,
  alt,
  className,
  placeholder,
}: PrivateEvidenceImageProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<ImageState>({
    phase: "loading",
    objectUrl: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setState({ phase: "loading", objectUrl: null });
    void loadPrivateEvidenceImage({
      src,
      signal: controller.signal,
    }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "loaded") {
        objectUrl = URL.createObjectURL(result.blob);
        setState({ phase: "loaded", objectUrl });
      } else {
        setState({ phase: "unavailable", objectUrl: null });
      }
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState({ phase: "unavailable", objectUrl: null });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [retryKey, src]);

  if (state.phase === "loaded") {
    return (
      <img
        src={state.objectUrl}
        alt={alt}
        className={className}
        onError={() => {
          URL.revokeObjectURL(state.objectUrl);
          setState({ phase: "unavailable", objectUrl: null });
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-canvas-surface-inset",
        className,
      )}
      aria-busy={state.phase === "loading"}
      aria-label={state.phase === "loading" ? `Loading ${alt}` : undefined}
    >
      {placeholder ?? (
        state.phase === "loading"
          ? <span className="sr-only">Loading image</span>
          : null
      )}
      {state.phase === "unavailable" && (
        <button
          type="button"
          className="text-canvas-xs text-canvas-ink-muted underline-offset-2 hover:underline"
          onClick={() => setRetryKey((value) => value + 1)}
        >
          Try image again
        </button>
      )}
    </div>
  );
}
