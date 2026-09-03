/**
 * File a request — the moderator's structured change-request form (#421, then
 * #436).
 *
 * # ⚠ THE ONE HE NAMED, AND THE ONE NO GUARD COULD SEE
 *
 * Crew reply #91, verbatim: *"id like the change request modal and any other
 * staff modals to be re-designed in our same design language. also the buttons
 * copy 'new change request' is so long just called it file a request or
 * something."*
 *
 * This file held **89 hex literals** — more than the other four staff dialogs
 * combined — and it was on none of the lists. Brief 09 §6 enrolled
 * `features/moderator/` in `token-guard` **file by file** precisely so it could
 * skip this one, and #421 was written from two admin-side reports so its table
 * named three admin files. **The founder found it by opening it.**
 *
 * # The fix is deletion, not substitution
 *
 * `client/src/index.css` already remaps every shadcn slot onto a foundation
 * token, so `DialogContent`, `Input`, `Textarea` and `SelectContent` were
 * theme-correct before this change and were being painted over in one theme's
 * colours. Most of this diff is classes coming OFF. See
 * `features/admin/UserActionModals.tsx`'s header for the full reasoning; the
 * short version is working law 4 — a second statement of a value drifts from
 * the first.
 *
 * # Two things that are not colour
 *
 * - **The button copy is his.** `New Change Request` → `File a request`. The
 *   empty state in `MyRequestsTab.tsx` quotes that button back at the reader
 *   and moves in the same commit; a rename that leaves the quote behind names
 *   a control that no longer exists.
 * - **Sentence case**, because brief 05 §"Labels" makes it the house voice:
 *   *"Labels are sentence case, not Title Case … House voice throughout the
 *   product."* `Block IP` keeps its capitals — an initialism is not Title Case.
 *
 * # ⚠ BRIEF 11 (#436): THE DEFECT THIS FORM IS THE TYPE SPECIMEN FOR
 *
 * The content was `max-h-[90vh] overflow-y-auto` — **`overflow` on the CARD,
 * so the whole card scrolled, footer included.** With `stripe_refund` selected
 * this form is fifteen fields, and `Submit request` sat below the fold: the
 * most reachable control on the longest form in the product was then whatever
 * happened to be in view.
 *
 * Brief 03 §3's rule, which this is the third surface to break: **a modal's
 * primary action never lives inside its scrolling region.** Header and footer
 * are `flex: none`; only the body scrolls. It is `STAFF_DIALOG_CONTENT` /
 * `STAFF_DIALOG_BODY` now, one string for all seven staff dialogs.
 *
 * ⚠ **`max-w-lg` → `max-w-2xl` is part of the same defect, not a taste
 * change.** At 512px the `grid-cols-2` columns are ~240px and *"Original
 * amount (cents)"* does not fit its own label; fifteen fields in two 240px
 * columns was the narrowest form in the product.
 *
 * ⚠ **AND IT IS `sm:max-w-2xl`, NOT `max-w-2xl`, WHICH IS THE WHOLE REASON
 * THIS SENTENCE IS HERE.** `DialogContent`'s own base carries `sm:max-w-lg`.
 * `cn()` is tailwind-merge, and a RESPONSIVE variant and a base variant are
 * different class groups to it — so a bare `max-w-2xl` does not replace
 * `sm:max-w-lg`, it loses to it at every width from 640px up. Measured in the
 * running app rather than reasoned about: the first build of this change
 * rendered the card at **512px**, exactly the width it was meant to leave.
 * A source read would have called it done.
 *
 * ⚠ **The same shadow is on `AuditActionModals`' two `max-w-md` dialogs** —
 * they have never been 448px above 640px, since before this brief. Left alone
 * and filed rather than fixed here: narrowing them is a visible change to two
 * dialogs whose width brief 11 does not mention.
 *
 * ⚠ **`space-y-*` is gone in favour of `gap`, and that is a real bug too**:
 * this form hides fields by TYPE, and margin-based spacing leaves collapsed
 * margins where the hidden siblings were.
 */
import { X, Upload, File, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { severityLook } from "@/foundation";
import {
  StaffDialogHeader,
  StaffField,
  STAFF_DIALOG_BODY,
  STAFF_DIALOG_CONTENT,
} from "@/features/staff";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { ChangeRequestType, ChangeRequestPriority } from "./moderatorConstants";

export interface UploadedAttachment {
  id: number;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

interface ChangeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (attachmentIds: number[]) => void;
  crType: ChangeRequestType;
  setCrType: (v: ChangeRequestType) => void;
  crPriority: ChangeRequestPriority;
  setCrPriority: (v: ChangeRequestPriority) => void;
  crTargetUserId: string;
  setCrTargetUserId: (v: string) => void;
  crTargetUserName: string;
  setCrTargetUserName: (v: string) => void;
  crTitle: string;
  setCrTitle: (v: string) => void;
  crDescription: string;
  setCrDescription: (v: string) => void;
  crEvidenceSummary: string;
  setCrEvidenceSummary: (v: string) => void;
  crRelatedAuditLogId: string;
  setCrRelatedAuditLogId: (v: string) => void;
  crCreditAmount: string;
  setCrCreditAmount: (v: string) => void;
  crCreditReason: string;
  setCrCreditReason: (v: string) => void;
  crIpAddress: string;
  setCrIpAddress: (v: string) => void;
  crStripeSessionId: string;
  setCrStripeSessionId: (v: string) => void;
  crRefundType: "full" | "proportional";
  setCrRefundType: (v: "full" | "proportional") => void;
  crOriginalAmountCents: number;
  setCrOriginalAmountCents: (v: number) => void;
  crOriginalCredits: number;
  setCrOriginalCredits: (v: number) => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/csv", "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/**
 * Four short mutually-exclusive options, which is what the segmented control
 * is for (brief 11 §6): *"A select hides three of four options behind a click
 * and gives no sense of scale; a segmented control shows the whole ladder,
 * which is what someone setting a priority is judging."*
 *
 * ⚠ **Request type (nine) and Duration (five, with a `Permanent` outlier) stay
 * selects.** His line: *"Nine is a list."*
 */
const PRIORITIES: { value: ChangeRequestPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function ChangeRequestModal(props: ChangeRequestModalProps) {
  const {
    open, onOpenChange, isPending, onSubmit,
    crType, setCrType, crPriority, setCrPriority,
    crTargetUserId, setCrTargetUserId, crTargetUserName, setCrTargetUserName,
    crTitle, setCrTitle, crDescription, setCrDescription,
    crEvidenceSummary, setCrEvidenceSummary,
    crRelatedAuditLogId, setCrRelatedAuditLogId,
    crCreditAmount, setCrCreditAmount, crCreditReason, setCrCreditReason,
    crIpAddress, setCrIpAddress,
    crStripeSessionId, setCrStripeSessionId,
    crRefundType, setCrRefundType,
    crOriginalAmountCents, setCrOriginalAmountCents,
    crOriginalCredits, setCrOriginalCredits,
  } = props;

  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.moderatorAttachments.uploadAttachment.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_FILES - attachments.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const toUpload = files.slice(0, remaining);
    setIsUploading(true);

    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const result = await uploadMutation.mutateAsync({
          filename: file.name,
          mimeType: file.type,
          base64Data: base64,
        });
        setAttachments((prev) => [...prev, result]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: number) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = () => {
    onSubmit(attachments.map((a) => a.id));
  };

  const handleClose = (v: boolean) => {
    if (!v) setAttachments([]);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`${STAFF_DIALOG_CONTENT} sm:max-w-2xl`}>
        {/* `FileText` came out of the title and out of the submit button
            (brief 11 §3). `Upload` and `Trash2` stay: one labels an
            affordance, the other IS the control. */}
        <StaffDialogHeader
          eyebrow="CHANGE REQUEST"
          title="File a request"
          description="Submit a structured request for admin review. This will be tracked and you can follow its status."
        />

        <div className={STAFF_DIALOG_BODY}>
          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <StaffField label="Request type">
              <Select value={crType} onValueChange={(v) => setCrType(v as ChangeRequestType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="refund_credits">Refund credits</SelectItem>
                  <SelectItem value="add_credits">Add credits</SelectItem>
                  <SelectItem value="flag_account">Flag account</SelectItem>
                  <SelectItem value="note_incident">Note incident</SelectItem>
                  <SelectItem value="suspend_user">Suspend user</SelectItem>
                  <SelectItem value="unsuspend_user">Unsuspend user</SelectItem>
                  <SelectItem value="block_ip">Block IP</SelectItem>
                  <SelectItem value="stripe_refund">Stripe refund</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </StaffField>
            <StaffField label="Priority">
              <div className="dp-segmented" role="group" aria-label="Priority">
                {PRIORITIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={option.value === crPriority}
                    className={`dp-segmented__seg${option.value === crPriority ? " dp-segmented__seg--on" : ""}`}
                    onClick={() => setCrPriority(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </StaffField>
          </div>

          {/* Target User */}
          <div className="grid grid-cols-2 gap-3">
            {/* ⚠ `Target user ID *` was two jobs in one string. The marker is
                the attribute on the control now (brief 11 §5). */}
            <StaffField label="Target user ID" htmlFor="cr-target-id">
              <Input id="cr-target-id" value={crTargetUserId} onChange={(e) => setCrTargetUserId(e.target.value)} placeholder="e.g., 42" required />
            </StaffField>
            <StaffField label="Target user name" htmlFor="cr-target-name">
              <Input id="cr-target-name" value={crTargetUserName} onChange={(e) => setCrTargetUserName(e.target.value)} placeholder="User name (optional)" />
            </StaffField>
          </div>

          {/* Credit fields */}
          {(crType === "refund_credits" || crType === "add_credits") && (
            <div className="grid grid-cols-2 gap-3">
              <StaffField label="Credit amount" htmlFor="cr-credit-amount">
                <Input id="cr-credit-amount" type="number" value={crCreditAmount} onChange={(e) => setCrCreditAmount(e.target.value)} placeholder="e.g., 100" min="1" required />
              </StaffField>
              <StaffField label="Credit reason" htmlFor="cr-credit-reason">
                <Input id="cr-credit-reason" value={crCreditReason} onChange={(e) => setCrCreditReason(e.target.value)} placeholder="e.g., Service disruption" />
              </StaffField>
            </div>
          )}

          {/* IP field */}
          {crType === "block_ip" && (
            <StaffField label="IP address" htmlFor="cr-ip">
              <Input id="cr-ip" value={crIpAddress} onChange={(e) => setCrIpAddress(e.target.value)} placeholder="e.g., 192.168.1.1" required />
            </StaffField>
          )}

          {/* Stripe refund fields */}
          {/*
            The amber slab was the one place in this form that said "money"
            with a colour. It takes the foundation's own `warning` look
            instead — through `severityLook`, the helper brief 00 §4 built for
            collapsing seven tints to three, rather than an approximation of it
            in Tailwind classes.

            ⚠ **THIS SLAB SURVIVES BRIEF 11 §7 AND THE ONE IN
            `UserActionModals` DOES NOT, WHICH IS THE WHOLE POINT OF THAT
            SECTION.** His words: warning weight on a routine fact *"devalues
            the treatment where it is earned (the Stripe refund block, which
            genuinely is)"*. Taking money back out of a customer's card is not
            the same kind of fact as "this will be logged".
          */}
          {crType === "stripe_refund" && (
            <div className="flex flex-col gap-3 p-3 rounded-xl" style={severityLook("warning")}>
              <p className="text-xs font-medium">Stripe refund details</p>
              <StaffField label="Stripe session ID" htmlFor="cr-stripe-session">
                <Input id="cr-stripe-session" value={crStripeSessionId} onChange={(e) => setCrStripeSessionId(e.target.value)} placeholder="cs_test_..." className="font-mono text-xs" required />
              </StaffField>
              <div className="grid grid-cols-2 gap-3">
                <StaffField
                  label="Original amount (cents)"
                  htmlFor="cr-original-amount"
                  helper={crOriginalAmountCents > 0 ? `$${(crOriginalAmountCents / 100).toFixed(2)}` : undefined}
                >
                  <Input id="cr-original-amount" type="number" value={crOriginalAmountCents || ""} onChange={(e) => setCrOriginalAmountCents(parseInt(e.target.value) || 0)} placeholder="e.g., 1500" />
                </StaffField>
                <StaffField label="Original credits" htmlFor="cr-original-credits">
                  <Input id="cr-original-credits" type="number" value={crOriginalCredits || ""} onChange={(e) => setCrOriginalCredits(parseInt(e.target.value) || 0)} placeholder="e.g., 150" />
                </StaffField>
              </div>
              <StaffField
                label="Refund type"
                helper={crRefundType === "proportional"
                  ? "Refunds only the unused portion. Credits deducted, balance floors at 0."
                  : "Refunds full amount regardless of usage. Credits deducted, balance floors at 0."}
              >
                <Select value={crRefundType} onValueChange={(v) => setCrRefundType(v as "full" | "proportional")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proportional">Proportional (unused credits only)</SelectItem>
                    <SelectItem value="full">Full refund (goodwill)</SelectItem>
                  </SelectContent>
                </Select>
              </StaffField>
            </div>
          )}

          {/* Title + Description */}
          {/* ⚠ `Title * (min 5 characters)` — the rule moves under the field,
              where it is read at the moment the button stays dead. */}
          <StaffField label="Title" htmlFor="cr-title" helper="At least 5 characters.">
            <Input id="cr-title" value={crTitle} onChange={(e) => setCrTitle(e.target.value)} placeholder="Brief summary of the request" required />
          </StaffField>
          <StaffField
            label="Description"
            htmlFor="cr-description"
            helper={`At least 10 characters — ${crDescription.length}/5000 used.`}
          >
            <Textarea id="cr-description" value={crDescription} onChange={(e) => setCrDescription(e.target.value)} placeholder="Detailed description of the issue and why this action is needed..." className="min-h-[80px]" required />
          </StaffField>

          {/* Evidence Summary */}
          <StaffField label="Evidence summary" htmlFor="cr-evidence" helper="Optional.">
            <Textarea id="cr-evidence" value={crEvidenceSummary} onChange={(e) => setCrEvidenceSummary(e.target.value)} placeholder="Links, screenshots, or other evidence supporting this request..." className="min-h-[60px]" />
          </StaffField>

          {/* File Attachments */}
          <StaffField
            label={`Attachments (${attachments.length}/${MAX_FILES})`}
            helper="JPEG, PNG, GIF, WebP, PDF, CSV, TXT, XLSX — max 10MB each."
          >
            <input ref={fileInputRef} type="file" multiple accept={ALLOWED_TYPES.join(",")} onChange={handleFileSelect} className="hidden" />

            {/* Upload area */}
            {attachments.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border border-dashed border-border rounded-xl p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-50"
              >
                {/* The label swap, here too: one pending pattern across the
                    five dialogs (brief 11 §7). `Upload` stays because it
                    labels the affordance rather than a heading. */}
                {isUploading ? (
                  "Uploading…"
                ) : (
                  <><Upload className="w-4 h-4" /> Drop files or click to upload</>
                )}
              </button>
            )}

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border">
                    {isImageMime(att.mimeType) ? (
                      <img src={att.url} alt={att.filename} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-accent flex items-center justify-center flex-shrink-0">
                        <File className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{att.filename}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeAttachment(att.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </StaffField>

          {/* Related audit log */}
          {crRelatedAuditLogId && (
            <StaffField label="Related audit log">
              <div>
                <Badge className="bg-muted text-muted-foreground">
                  #{crRelatedAuditLogId}
                  <button className="ml-1 hover:text-foreground" onClick={() => setCrRelatedAuditLogId("")}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            </StaffField>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || isUploading || crTitle.length < 5 || crDescription.length < 10 || !crTargetUserId}
          >
            {isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // Strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
