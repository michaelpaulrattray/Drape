import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/foundation";
import { trpc } from "@/lib/trpc";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import {
  PUBLIC_CHECK_CONSEQUENCE,
  PUBLIC_CHECK_TOGGLE,
  publicCheckPath,
} from "@shared/creationCheckCopy";

import { CreationCheckRecordView, type CreationCheckRecordData } from "./CreationCheckRecord";
import "@/features/settings/settings.css";
import "./creationCheck.css";

/**
 * THE OWNER'S ONE TOGGLE — the public check page, off by default (N2d-3, #2313).
 *
 * Design §2 Q2 (`docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`): the
 * ONE decision this rung puts in front of a customer, and it has a basis
 * because the consequence is STATED (the design's sentence, verbatim) and
 * SHOWN: pressing the switch while it is off never turns the page on — it
 * shows the page first, drawn by the same component the public page draws,
 * from the same server projector, and only "Turn on" under it does it.
 * Turning it OFF is immediate: taking something private needs no preview.
 *
 * The switch is the house one (`dp-set__toggle`, the settings and add-credits
 * switch) — a real `<button role="switch">` with `aria-checked`, not a second
 * drawing of the same control.
 *
 * Dark: `status` answers `available: false` outside the creation-record scope,
 * and this card then draws nothing at all.
 */
export type PublicCheckStage = "idle" | "previewing";

export type PublicCheckPanelProps = {
  isPublic: boolean;
  stage: PublicCheckStage;
  /** The preview, once it has arrived; `undefined` while it is being prepared. */
  preview: CreationCheckRecordData | undefined;
  /** A sentence saying why the last action didn't happen, or null. */
  refusal: string | null;
  busy: boolean;
  /** The page's full address, shown only while it is on. */
  pageUrl: string;
  onSwitch: () => void;
  onTurnOn: () => void;
  onCancel: () => void;
  onCopy: () => void;
};

export function PublicCheckPanel({
  isPublic,
  stage,
  preview,
  refusal,
  busy,
  pageUrl,
  onSwitch,
  onTurnOn,
  onCancel,
  onCopy,
}: PublicCheckPanelProps) {
  const previewing = !isPublic && stage === "previewing";
  return (
    <section className="dpc-rcard" aria-label={PUBLIC_CHECK_TOGGLE.switchName}>
      <div className="dpx-toggle__head">
        <span className="dpc-rcard__label">{PUBLIC_CHECK_TOGGLE.label}</span>
        <span className="dpx-toggle__state">
          <span className="dpx-toggle__word" aria-hidden="true">
            {isPublic ? PUBLIC_CHECK_TOGGLE.on : PUBLIC_CHECK_TOGGLE.off}
          </span>
          <button
            type="button"
            className="dp-set__toggle"
            role="switch"
            aria-checked={isPublic}
            aria-label={PUBLIC_CHECK_TOGGLE.switchName}
            aria-disabled={busy || previewing ? "true" : undefined}
            onClick={() => {
              if (busy || previewing) return;
              onSwitch();
            }}
          />
        </span>
      </div>
      <p className="dpc-rcard__body">{PUBLIC_CHECK_CONSEQUENCE}</p>

      {previewing ? (
        <>
          <p className="dpx-toggle__intro">
            {preview ? PUBLIC_CHECK_TOGGLE.previewIntro : PUBLIC_CHECK_TOGGLE.previewLoading}
          </p>
          {preview ? (
            <div className="dpx-toggle__preview">
              <CreationCheckRecordView record={preview} headingLevel={3} />
            </div>
          ) : null}
          <div className="dpx-toggle__actions">
            <Button variant="quiet" size="small" onClick={onCancel} disabled={busy}>
              {PUBLIC_CHECK_TOGGLE.cancel}
            </Button>
            <Button variant="primary" size="small" onClick={onTurnOn} disabled={busy || !preview}>
              {PUBLIC_CHECK_TOGGLE.turnOn}
            </Button>
          </div>
        </>
      ) : null}

      {isPublic ? (
        <div className="dpx-toggle__link">
          <a className="dpx-toggle__url" href={pageUrl} target="_blank" rel="noreferrer">
            {pageUrl}
          </a>
          <Button variant="secondary" size="small" onClick={onCopy}>
            {PUBLIC_CHECK_TOGGLE.copyLink}
          </Button>
        </div>
      ) : null}

      {refusal ? <p className="dpx-toggle__refusal" role="alert">{refusal}</p> : null}
    </section>
  );
}

/** The panel, wired to the store. `castId` is the cast's public Klieg ID. */
export function PublicCheckCard({ castId }: { castId: string }) {
  const utils = trpc.useUtils();
  const status = trpc.creationCheck.status.useQuery({ castId }, { enabled: Boolean(castId) });
  const [stage, setStage] = useState<PublicCheckStage>("idle");
  const [refusal, setRefusal] = useState<string | null>(null);
  /* The preview is fetched only when the owner asks to see it, and only once per
     opening: it can make the record, so it is never refetched on a focus. */
  const preview = trpc.creationCheck.preview.useQuery(
    { castId },
    { enabled: stage === "previewing", retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
  );
  const setPublic = trpc.creationCheck.setPublic.useMutation();

  if (!status.data?.available) return null;
  const isPublic = status.data.isPublic;
  const pageUrl = `${window.location.origin}${publicCheckPath(castId)}`;

  const flip = async (on: boolean) => {
    setRefusal(null);
    try {
      await setPublic.mutateAsync({ castId, public: on });
      setStage("idle");
    } catch (error) {
      logRawFailure("creationCheck.setPublic", error);
      setRefusal(readableFailure(error, PUBLIC_CHECK_TOGGLE.failedSwitch));
    } finally {
      void utils.creationCheck.status.invalidate({ castId });
    }
  };

  const previewRefusal = preview.error
    ? readableFailure(preview.error, PUBLIC_CHECK_TOGGLE.failedPreview)
    : null;

  return (
    <PublicCheckPanel
      isPublic={isPublic}
      stage={stage}
      preview={preview.data}
      refusal={refusal ?? (stage === "previewing" ? previewRefusal : null)}
      busy={setPublic.isPending || status.isFetching}
      pageUrl={pageUrl}
      onSwitch={() => {
        setRefusal(null);
        if (isPublic) void flip(false);
        else setStage("previewing");
      }}
      onTurnOn={() => void flip(true)}
      onCancel={() => {
        setRefusal(null);
        setStage("idle");
      }}
      onCopy={async () => {
        try {
          await navigator.clipboard.writeText(pageUrl);
          setRefusal(null);
          toast(PUBLIC_CHECK_TOGGLE.copied);
        } catch {
          setRefusal(PUBLIC_CHECK_TOGGLE.copyFailed);
        }
      }}
    />
  );
}
