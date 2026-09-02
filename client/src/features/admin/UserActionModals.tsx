/**
 * The three account dialogs — suspend, adjust credits, change role (#421).
 *
 * # ⚠ THE FIX IS DELETION, NOT SUBSTITUTION, AND THAT IS THE WHOLE FINDING
 *
 * These dialogs drew a white box in a dark app because every one of them
 * over-wrote its own primitive: `bg-white border-[#E5E5E5] text-[#0A0A0A]` on
 * the content, `bg-[#F8F8F8] … placeholder:text-[#999]` on every field,
 * `border-[#E5E5E5] text-[#666]` on every Cancel.
 *
 * **The primitives underneath were already correct.** `client/src/index.css`
 * remaps every shadcn slot onto a foundation token — `--color-background` is
 * `--surface`, `--color-primary` is `--ink`, `--color-destructive` is
 * `--error` — and `DialogContent` already carries `bg-background`, `Input`
 * already carries `border-input` and `placeholder:text-muted-foreground`.
 * So the hard-coded classes were not adding a look; they were **spending a
 * themed component and painting over it in one theme's colours**.
 *
 * The repair is therefore to take the paint off, not to write
 * `bg-[var(--surface)]` where `bg-white` was. That is working law 4 — a second
 * statement of a value always drifts from the first — and it is why this file
 * ends up SHORTER than the one that had the bug.
 *
 * ⚠ **`text-foreground` on the content is the one addition and it is not
 * decoration.** `DialogContent` sets its background and not its text colour,
 * and it portals to `document.body`, outside `.dp-root` — so the ink it
 * inherits is the body's, not the app shell's.
 *
 * # Sentence case, because that is the house voice
 *
 * Brief 05 §"Labels": *"Labels are sentence case, not Title Case … House voice
 * throughout the product."* His reply #91 asks for these dialogs *"in our same
 * design language"*, and the design language says so in writing.
 *
 * # What is deliberately NOT here
 *
 * Not rebuilt onto `foundation/modals.css`'s promoted shell. #421 says so
 * explicitly: brief 09 routes *irreversible* acts through `ConfirmDialog`, and
 * these carry multi-field forms. Folding them in is its own decision.
 */
import {
  ShieldOff,
  Coins,
  Shield,
  UserCog,
  User,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RolePill } from "@/features/staff";
import { severityLook } from "@/foundation";

/* ── Suspend Modal ─────────────────────────────────────────── */

interface SuspendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function SuspendModal({ open, onOpenChange, reason, onReasonChange, onConfirm, isPending }: SuspendModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-foreground">
        <DialogHeader>
          {/*
            The one red, and it is earned: suspension logs the account out and
            keeps it out. `text-destructive` resolves to `--error`, the single
            colour the foundation allows beside the accent.
          */}
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldOff className="w-5 h-5" />
            Suspend user
          </DialogTitle>
          <DialogDescription>
            This will immediately block the user from accessing their account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground font-medium">Reason for suspension</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Enter the reason for suspending this user..."
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!reason.trim() || isPending}>
            {isPending ? "Suspending..." : "Suspend user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Credit Adjustment Modal ───────────────────────────────── */

interface CreditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "add" | "deduct";
  amount: string;
  onAmountChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function CreditModal({ open, onOpenChange, action, amount, onAmountChange, reason, onReasonChange, onConfirm, isPending }: CreditModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="text-muted-foreground" />
            {action === "add" ? "Add credits" : "Deduct credits"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground font-medium">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="Enter amount..."
              min="1"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground font-medium">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Enter the reason for this adjustment..."
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {/*
            R6 pile (b): money actions wear the house ink, not a colour code —
            and the default variant IS the house ink now (`--color-primary` is
            `--ink`), so the class that used to say it has nothing left to say.
          */}
          <Button
            onClick={onConfirm}
            disabled={!amount || !reason.trim() || isPending}
          >
            {isPending ? "Processing..." : action === "add" ? "Add credits" : "Deduct credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Role Change Modal ─────────────────────────────────────── */

interface RoleChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetRole: "user" | "moderator";
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isPending: boolean;
  selectedUser: {
    user: {
      name: string | null;
      email: string | null;
      avatarUrl: string | null;
      role: "user" | "admin" | "moderator";
    };
  } | undefined;
}

export function RoleChangeModal({ open, onOpenChange, targetRole, reason, onReasonChange, onConfirm, isPending, selectedUser }: RoleChangeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-foreground">
        <DialogHeader>
          {/*
            ⚠ The blue and the amber are gone and neither is replaced by another
            colour. Brief 07 §3: accent means STATE in this product, and a role
            change is neither urgent nor selected — the icon and the words carry
            it. Promote and demote are both reversible, which is why neither
            wears the one red.
          */}
          <DialogTitle className="flex items-center gap-2">
            {targetRole === "moderator" ? (
              <><Shield className="w-5 h-5 text-muted-foreground" />Promote to moderator</>
            ) : (
              <><UserCog className="w-5 h-5 text-muted-foreground" />Demote to user</>
            )}
          </DialogTitle>
          <DialogDescription>
            {targetRole === "moderator"
              ? "This user will gain access to the moderator dashboard with read-only audit logs, user activity, and the ability to escalate issues to admins via Slack."
              : "This user will lose moderator access and return to standard user permissions."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {selectedUser && (
            <div className="bg-muted rounded-xl p-3 border border-border">
              <div className="flex items-center gap-3">
                {selectedUser.user.avatarUrl ? (
                  <img src={selectedUser.user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <div className="font-medium text-foreground">{selectedUser.user.name || "Unnamed"}</div>
                  <div className="text-sm text-muted-foreground">{selectedUser.user.email || "No email"}</div>
                </div>
                {/*
                  ⚠ `RolePill`, NOT this feature's own `RoleBadge` — and the
                  swap is a measured one, not a preference. `RoleBadge` drew a
                  purple `admin` crown and a blue `moderator` shield inside a
                  dialog this change just made monochrome. `features/staff`'s
                  `RolePill` already exists and holds the colour rule for every
                  staff surface in ONE function, which is the point of the swap.

                  Read before it was believed: `RoleBadge`'s ONLY consumer in
                  the product is this dialog — `UserTable.tsx` imports
                  `formatDate` and `getUserStatus` from that module and nothing
                  else, because brief 06 already moved the table to `StatePill`.
                  So no other surface moves.

                  ⚠ **SINCE #422 (2026-09-02) `admin` CARRIES ACCENT** — his
                  ruling, because who has the keys is worth spotting fast. This
                  comment used to quote the old "every role is greyscale" rule
                  as its justification; that quote is gone rather than left to
                  rot beside the behaviour it contradicts.

                  ⚠ **Only the LEFT pill can ever show it.** `targetRole` is
                  typed `"user" | "moderator"`, so this dialog cannot promote
                  anyone TO admin — the before/after pair reads *accent → grey*
                  when demoting an admin, and grey → grey otherwise. It never
                  shows two accents facing each other.
                */}
                <div className="ml-auto flex items-center gap-2 text-sm">
                  <RolePill role={selectedUser.user.role} />
                  <span className="text-muted-foreground">&rarr;</span>
                  <RolePill role={targetRole} />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm text-muted-foreground font-medium">Reason for role change</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={targetRole === "moderator"
                ? "e.g., Trusted community member, needs access to review reports..."
                : "e.g., No longer needed, stepping down from moderation duties..."}
              className="mt-1"
            />
          </div>
          {/*
            The amber slab becomes the foundation's own `warning` look, through
            the foundation's own helper rather than an approximation of it —
            `severityLook` is what brief 00 §4 built for this exact job, and
            three tints collapsing to one bordered well is its whole point.
            Reaching for `bg-muted border-border` here would have LOOKED the
            same today and drifted the moment the helper moved.
          */}
          <div className="rounded-xl p-3" style={severityLook("warning")}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              This action will be logged and reported to Slack
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={!reason.trim() || isPending}
          >
            {isPending ? "Processing..." : targetRole === "moderator" ? "Promote to moderator" : "Demote to user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
