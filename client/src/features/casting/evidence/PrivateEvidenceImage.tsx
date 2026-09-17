import { useCallback, useEffect, useState } from "react";
import { loadPrivateEvidenceImage } from "./privateEvidenceImageLoader";

type ImageState =
  | { phase: "loading"; objectUrl: null }
  | { phase: "loaded"; objectUrl: string }
  | { phase: "unavailable"; objectUrl: null };

export interface PrivateEvidenceImageState {
  phase: ImageState["phase"];
  objectUrl: string | null;
  retry: () => void;
}

/**
 * Owner-private image loading. The endpoint is never assigned directly to an
 * <img>, so retryable HTTP/stream failures cannot flash a broken-image icon —
 * the surface hands out an object URL only once the bytes have arrived. (The
 * ruling lived on a `PrivateEvidenceImage` component nothing rendered, deleted
 * #108 slice 4; the hook is where the behaviour is.)
 */
export function usePrivateEvidenceImage(
  src: string | null,
): PrivateEvidenceImageState {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<ImageState>(() => src
    ? { phase: "loading", objectUrl: null }
    : { phase: "unavailable", objectUrl: null });

  useEffect(() => {
    if (!src) {
      setState({ phase: "unavailable", objectUrl: null });
      return;
    }
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

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);
  return { ...state, retry };
}

