import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  RowId,
  StatePill,
  StaffBarAdmin,
  StaffLoading,
  StaffSurface,
  pageRange,
} from "@/features/staff";
import { Shuffle } from "lucide-react";
import { Button, DataTable, Field, IconButton, Input, TableHead } from "@/foundation";
import type { DataRow } from "@/foundation";
import { INVITE_CODE_MAX_LENGTH, INVITE_CODE_NOTE_MAX_LENGTH } from "@shared/inputLimits";

/* ─── helpers ─── */

type CodeStatus = "active" | "used_up" | "expired" | "deactivated";

/**
 * ⚠ **THE ONLY STATE HERE THAT ASKS FOR ATTENTION IS `active`, WHICH INVERTS
 * THE USUAL READING — and it is correct.** Everywhere else on staff, the
 * resting state is the quiet one; on this page an `active` code is a live
 * door into the product, and `expired` / `used_up` / `deactivated` are all
 * closed doors that need nothing from anybody.
 *
 * That is exactly why the rule is `attention`, a question about the reader,
 * rather than a colour per status name (brief 06 §4).
 */
const ATTENTION_STATUS = new Set<CodeStatus>(["active"]);

const STATUS_LABELS: Record<CodeStatus, string> = {
  active: "Active",
  used_up: "Used up",
  expired: "Expired",
  deactivated: "Deactivated",
};

function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `DRAPE-${seg()}-${seg()}`;
}

function formatDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── page ─── */

export default function AdminInviteCodes() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  /* ─── form state ─── */
  const [code, setCode] = useState(generateRandomCode);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const isAdmin = isAuthenticated && user?.role === "admin";

  /* ─── queries / mutations ─── */
  const codesQuery = trpc.admin.listInviteCodes.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 10_000,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.admin.createInviteCode.useMutation({
    onSuccess: () => {
      toast.success("Invite code created");
      utils.admin.listInviteCodes.invalidate();
      setCode(generateRandomCode());
      setMaxUses(1);
      setExpiresInDays(null);
      setNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateMutation = trpc.admin.deactivateInviteCode.useMutation({
    onSuccess: () => {
      toast.success("Code deactivated");
      utils.admin.listInviteCodes.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim()) return;
      createMutation.mutate({
        code: code.trim(),
        maxUses,
        expiresInDays,
        note: note.trim() || null,
      });
    },
    [code, maxUses, expiresInDays, note, createMutation]
  );

  const handleCopy = useCallback((id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  /* ─── auth guards ─── */
  if (authLoading) {
    return <StaffLoading />;
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  /* Brief 05 §6 — the redirect is silent now. The `toast.error` that used to
     sit here fired from the render body, which double-fires under strict mode,
     and somebody who cannot see Admin does not need telling why. */
  if (user?.role !== "admin") return <Redirect to="/app" />;

  const codes = codesQuery.data ?? [];

  const rows: DataRow[] = codes.map((c) => {
    const status = c.status as CodeStatus;
    return {
      id: String(c.id),
      cells: [
        <RowId key="code">{c.code}</RowId>,
        <StatePill key="status" label={STATUS_LABELS[status]} attention={ATTENTION_STATUS.has(status)} />,
        <span key="uses">{c.currentUses}/{c.maxUses}</span>,
        <span key="created">{formatDate(c.createdAt)}</span>,
        <span key="expires">{formatDate(c.expiresAt)}</span>,
      ],
      facts: [
        { label: "CODE", value: c.code },
        { label: "USED", value: `${c.currentUses} of ${c.maxUses}` },
        { label: "CREATED", value: formatDate(c.createdAt) },
        { label: "EXPIRES", value: c.expiresAt ? formatDate(c.expiresAt) : "Never" },
      ],
      evidence: c.note || undefined,
      actions: [
        {
          key: "copy",
          label: copiedId === c.id ? "Copied" : "Copy code",
          onClick: () => handleCopy(c.id, c.code),
        },
        ...(status === "active"
          ? [
              {
                key: "deactivate",
                label: "Retire this code",
                onClick: () => deactivateMutation.mutate({ codeId: c.id }),
                disabled: deactivateMutation.isPending,
                destructive: true as const,
                /* His own worked example of the rule, §5. */
                consequence:
                  "Retiring a code stops anyone new using it. It never affects anyone who already used it — their account stays exactly as it is.",
              },
            ]
          : []),
      ],
    };
  });

  return (
    <StaffSurface breadcrumb="Admin / Invite codes" bar={<StaffBarAdmin />}>
      <main className="space-y-6">
        {/*
          The create form, on the foundation's own field and button primitives.
          Its shape is unchanged — a code with a shuffle beside it, then max
          uses, expiry and note — and every colour in it now flips with the
          theme, which is the point: this page had never been opened in dark
          mode, so a white form on a dark surface had simply never been seen.
        */}
        <section className="dp-panel">
          <span className="dp-eyebrow">Generate a code</span>
          <form onSubmit={handleCreate} className="dp-stack" style={{ gap: 12 }}>
            <div className="dp-inviteform__code">
              <Field>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="DRAPE-XXXX-XXXX"
                  aria-label="The code itself"
                  required
                  maxLength={INVITE_CODE_MAX_LENGTH}
                />
              </Field>
              <IconButton label="Make up a new code" onClick={() => setCode(generateRandomCode())}>
                <Shuffle size={15} />
              </IconButton>
            </div>

            <div className="dp-inviteform__row">
              <label className="dp-stack" style={{ gap: 4 }}>
                <span className="dp-chrome">MAX USES</span>
                <Field compact>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                  />
                </Field>
              </label>
              <label className="dp-stack" style={{ gap: 4 }}>
                <span className="dp-chrome">EXPIRES IN (DAYS)</span>
                <Field compact>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={expiresInDays ?? ""}
                    onChange={(e) =>
                      setExpiresInDays(e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="Never"
                  />
                </Field>
              </label>
              <label className="dp-stack" style={{ gap: 4 }}>
                <span className="dp-chrome">NOTE</span>
                <Field compact>
                  <Input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. For @mike"
                    maxLength={INVITE_CODE_NOTE_MAX_LENGTH}
                  />
                </Field>
              </label>
            </div>

            <span>
              <Button type="submit" variant="primary" disabled={createMutation.isPending || !code.trim()}>
                {createMutation.isPending ? "Creating…" : "Create code"}
              </Button>
            </span>
          </form>
        </section>

        {/* ─── the codes ─── */}
        <TableHead eyebrow="Invite codes" />

        <DataTable
          columns={[
            { label: "Code", width: "1 1 0" },
            { label: "Status", width: "0 0 104px" },
            { label: "Uses", width: "0 0 72px", align: "center" },
            { label: "Created", width: "0 0 118px" },
            { label: "Expires", width: "0 0 118px" },
          ]}
          rows={rows}
          loading={codesQuery.isLoading}
          empty={{
            title: "No invite codes yet.",
            body: "Create one above and send it to whoever you want inside.",
          }}
          footer={{ meta: pageRange({ offset: 0, count: codes.length, total: codes.length }) }}
        />
      </main>
    </StaffSurface>
  );
}
