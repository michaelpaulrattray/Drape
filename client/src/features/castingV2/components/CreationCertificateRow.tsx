import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/foundation";

/**
 * THE CERTIFICATE OF CREATION — the one door on a signed cast's page, N2d-2
 * (#2312; design `docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`).
 *
 * One row and one button. Nothing to learn and nothing to decide (design §2,
 * Q1 and Q2): the record behind the Klieg ID is made by the Sign, and this
 * hands its owner a document saying so. The words are the customer's —
 * "evidence of when and by whom this character was made", the Klieg ID's own
 * tooltip sentence turned into a thing they can keep — and never a hash, a
 * signature or a service name (Q3).
 *
 * ⚠ **THE ROW OFFERS ITSELF ONLY WHEN A DOWNLOAD WOULD SUCCEED.** The room asks
 * the server first with a `HEAD` on the download's own path, which runs the
 * same door and the same record road: 200 draws the row; 409 means the
 * independent timestamp has not landed yet, so the row waits and asks again;
 * anything else — the scope off for this account (a 404 like a stranger's), a
 * cast the record road cannot certify, a refusal — draws nothing (design §5:
 * *"until a token lands the certificate simply does not offer itself"*).
 * Behind `CASTING_CREATION_RECORD_SCOPE`, therefore, with no client flag to
 * mirror it: the server is the only reader of the scope.
 */

export const CERTIFICATE_LABEL = "CERTIFICATE OF CREATION";
export const CERTIFICATE_BUTTON = "Download certificate";
export const CERTIFICATE_BODY =
  "Evidence of when and by whom this character was made, independently timestamped.";
export const CERTIFICATE_FAILED = "The certificate couldn't be prepared. Try again in a moment.";

/** Where the certificate lives — the one path the server serves it on. */
export function certificatePath(castId: string): string {
  return `/api/cast/${encodeURIComponent(castId)}/certificate`;
}

/** What the room does with the answer to its `HEAD`. */
export function certificateProbeAnswer(status: number): "offer" | "wait" | "hide" {
  if (status === 200) return "offer";
  if (status === 409) return "wait";
  return "hide";
}

/** How long to wait between asks while the timestamp lands, and how many asks. */
const PROBE_RETRY_MS = 15_000;
const PROBE_ATTEMPTS = 4;

export type CreationCertificatePanelProps = {
  busy: boolean;
  onDownload: () => void;
};

/** The row itself — drawn only once the server has said there is one to offer. */
export function CreationCertificatePanel({ busy, onDownload }: CreationCertificatePanelProps) {
  return (
    <section className="dpc-takes" aria-label="Certificate of creation">
      <div className="dpc-takes__head">
        <span className="dpc-rcard__label">{CERTIFICATE_LABEL}</span>
        <span className="dpc-takes__actions">
          <Button variant="quiet" size="small" disabled={busy} onClick={onDownload}>
            <Download size={12} strokeWidth={1.9} aria-hidden="true" />
            {busy ? "Preparing…" : CERTIFICATE_BUTTON}
          </Button>
        </span>
      </div>
      <p className="dpc-rcard__body">{CERTIFICATE_BODY}</p>
    </section>
  );
}

/**
 * The room's mount. `settled` is false while the cast's views are still being
 * made — the record is written as the Sign's last act, so there is nothing to
 * ask about until then.
 */
export function CreationCertificateRow({ castId, settled }: { castId: string; settled: boolean }) {
  const [offered, setOffered] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settled) return;
    let cancelled = false;
    let timer: number | undefined;
    const ask = async (attempt: number) => {
      let answer: ReturnType<typeof certificateProbeAnswer> = "hide";
      try {
        const response = await fetch(certificatePath(castId), { method: "HEAD", credentials: "same-origin" });
        answer = certificateProbeAnswer(response.status);
      } catch {
        answer = "hide";
      }
      if (cancelled) return;
      if (answer === "offer") setOffered(true);
      else if (answer === "wait" && attempt + 1 < PROBE_ATTEMPTS) {
        timer = window.setTimeout(() => void ask(attempt + 1), PROBE_RETRY_MS);
      }
    };
    void ask(0);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [castId, settled]);

  if (!offered) return null;

  const download = async () => {
    setBusy(true);
    try {
      const response = await fetch(certificatePath(castId), { credentials: "same-origin" });
      if (!response.ok) throw new Error(`certificate ${response.status}`);
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "certificate-of-creation.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast.error(CERTIFICATE_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return <CreationCertificatePanel busy={busy} onDownload={() => void download()} />;
}
