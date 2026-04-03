/**
 * WaitlistModal — centered glassmorphism overlay with two-step beta signup.
 *
 * Step 1: Email + name capture with beta-invite urgency copy.
 * Step 2: Optional pill-chip questionnaire (role + referral source).
 *
 * Triggered by "Claim a Spot" navbar CTA only.
 */
import { useState, useCallback, useEffect } from "react";
import { X, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ─── constants ─── */

const ROLE_OPTIONS = [
  "Creative Director",
  "Photographer",
  "Brand Manager",
  "Agency",
  "Other",
] as const;

const SOURCE_OPTIONS = [
  "Social media",
  "Friend / colleague",
  "Search",
  "Newsletter",
  "Other",
] as const;

/* ─── types ─── */

interface WaitlistModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | "done";

/* ─── component ─── */

export function WaitlistModal({ open, onClose }: WaitlistModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: (data) => {
      if (data.alreadyRegistered) {
        toast.info("You've already claimed a spot.");
        setStep("done");
      } else {
        setStep(2);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const updateMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setStep("done");
    },
    onError: () => {
      setStep("done");
    },
  });

  useEffect(() => {
    if (open) {
      setStep(1);
      setEmail("");
      setName("");
      setRole(null);
      setSource(null);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const handleStep1Submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;
      joinMutation.mutate({
        email: email.trim(),
        name: name.trim() || undefined,
        source: "claim_a_spot_modal",
      });
    },
    [email, name, joinMutation]
  );

  const handleStep2Submit = useCallback(() => {
    updateMutation.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
      role: role ?? undefined,
      source: source ?? "claim_a_spot_modal",
    });
  }, [email, name, role, source, updateMutation]);

  const handleSkip = useCallback(() => {
    setStep("done");
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[199] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          >
            <div
              className="relative w-full max-w-[420px] rounded-2xl border border-white/20 overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(24px) saturate(1.4)",
                WebkitBackdropFilter: "blur(24px) saturate(1.4)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5 text-white/70" />
              </button>

              {/* ─── Step 1: Email + Name ─── */}
              {step === 1 && (
                <form onSubmit={handleStep1Submit} className="px-7 py-8">
                  <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="w-4 h-4 text-white/60" />
                    <span className="text-xs font-medium text-white/50 uppercase tracking-widest font-body">
                      Beta access
                    </span>
                  </div>

                  <h3 className="text-2xl font-semibold text-white mb-2 font-geist tracking-tight">
                    Claim your spot
                  </h3>
                  <p className="text-sm text-white/60 mb-6 leading-relaxed font-body">
                    We're opening the studio to a small group of creatives.
                    Beta invites go out weekly — get in line before we close the list.
                  </p>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-11 px-4 rounded-full border border-white/15 bg-white/8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 placeholder:text-white/30 font-body"
                      autoComplete="name"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="w-full h-11 px-4 rounded-full border border-white/15 bg-white/8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 placeholder:text-white/30 font-body"
                      autoComplete="email"
                    />
                    <button
                      type="submit"
                      disabled={joinMutation.isPending || !email.trim()}
                      className="w-full h-11 rounded-full bg-white text-slate-900 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-body"
                    >
                      {joinMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Claim my spot
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-white/30 text-center mt-4 font-body">
                    No spam. Unsubscribe anytime.
                  </p>
                </form>
              )}

              {/* ─── Step 2: Pill Chip Questionnaire ─── */}
              {step === 2 && (
                <div className="px-7 py-8">
                  <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="w-4 h-4 text-white/60" />
                    <span className="text-xs font-medium text-white/50 uppercase tracking-widest font-body">
                      Beta access
                    </span>
                  </div>

                  <h3 className="text-2xl font-semibold text-white mb-2 font-geist tracking-tight">
                    Almost there
                  </h3>
                  <p className="text-sm text-white/60 mb-6 leading-relaxed font-body">
                    This helps us prioritize your invite. Creatives with clear use cases get access faster.
                  </p>

                  {/* Role */}
                  <div className="mb-5">
                    <label className="block text-xs font-medium text-white/70 mb-2.5 font-body">
                      What's your role?
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLE_OPTIONS.map((opt) => (
                        <PillChip
                          key={opt}
                          label={opt}
                          selected={role === opt}
                          onClick={() => setRole(role === opt ? null : opt)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Source */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-white/70 mb-2.5 font-body">
                      How did you hear about us?
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {SOURCE_OPTIONS.map((opt) => (
                        <PillChip
                          key={opt}
                          label={opt}
                          selected={source === opt}
                          onClick={() => setSource(source === opt ? null : opt)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleStep2Submit}
                      disabled={updateMutation.isPending}
                      className="flex-1 h-11 rounded-full bg-white text-slate-900 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50 font-body"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Submit
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleSkip}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2 font-body"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Done ─── */}
              {step === "done" && (
                <div className="px-7 py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-2 font-geist tracking-tight">
                    Spot claimed
                  </h3>
                  <p className="text-sm text-white/60 mb-6 leading-relaxed font-body">
                    Beta invites go out every Thursday.<br />
                    You'll hear from us soon.
                  </p>
                  <button
                    onClick={onClose}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2 font-body"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── PillChip ─── */

function PillChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 font-body ${
        selected
          ? "bg-white text-slate-900 border-white"
          : "bg-white/5 text-white/60 border-white/15 hover:border-white/30"
      }`}
    >
      {label}
    </button>
  );
}
