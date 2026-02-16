/**
 * WaitlistModal — floating bottom-right card with two-step signup flow.
 *
 * Step 1: Email + name capture (highest priority conversion).
 * Step 2: Optional pill-chip questionnaire (role + referral source).
 *
 * Design: obsidian (#0A0A0A) active state, rounded-2xl card, rounded-full pills.
 */
import { useState, useCallback, useEffect } from "react";
import { X, ArrowRight, Check, Loader2 } from "lucide-react";
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
        toast.info("You're already on the waitlist.");
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
      // Silently move to done — questionnaire is optional
      setStep("done");
    },
  });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setEmail("");
      setName("");
      setRole(null);
      setSource(null);
    }
  }, [open]);

  const handleStep1Submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;
      joinMutation.mutate({
        email: email.trim(),
        name: name.trim() || undefined,
        source: "waitlist_modal",
      });
    },
    [email, name, joinMutation]
  );

  const handleStep2Submit = useCallback(() => {
    // Re-submit with role + source appended
    updateMutation.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
      role: role ?? undefined,
      source: source ?? "waitlist_modal",
    });
  }, [email, name, role, source, updateMutation]);

  const handleSkip = useCallback(() => {
    setStep("done");
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[200] w-[calc(100vw-2rem)] sm:w-[380px]"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E5E5] overflow-hidden">
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <img
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png"
                  alt="Forma®"
                  className="w-5 h-5"
                />
                <span className="text-xs font-medium text-[#999]">
                  {step === 1
                    ? "Join the waitlist"
                    : step === 2
                    ? "Quick question"
                    : "You're in"}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F0F0F0] transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5 text-[#999]" />
              </button>
            </div>

            {/* ─── Step 1: Email + Name ─── */}
            {step === 1 && (
              <form onSubmit={handleStep1Submit} className="px-5 pb-5 pt-1">
                <h3 className="text-lg font-semibold text-[#0A0A0A] mb-1">
                  Get early access
                </h3>
                <p className="text-xs text-[#757575] mb-4 leading-relaxed">
                  Be the first to create with AI models that remember who they
                  are. No prompts needed.
                </p>

                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full h-10 px-4 rounded-full border border-[#D5D5D5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 placeholder:text-[#bbb]"
                    autoComplete="name"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full h-10 px-4 rounded-full border border-[#D5D5D5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 placeholder:text-[#bbb]"
                    autoComplete="email"
                  />
                  <button
                    type="submit"
                    disabled={joinMutation.isPending || !email.trim()}
                    className="w-full h-10 rounded-full bg-[#0A0A0A] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {joinMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Join waitlist
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ─── Step 2: Pill Chip Questionnaire ─── */}
            {step === 2 && (
              <div className="px-5 pb-5 pt-1">
                <h3 className="text-lg font-semibold text-[#0A0A0A] mb-1">
                  One more thing
                </h3>
                <p className="text-xs text-[#757575] mb-4 leading-relaxed">
                  Help us tailor your experience. Both questions are optional.
                </p>

                {/* Role */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-[#0A0A0A] mb-2">
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
                <div className="mb-5">
                  <label className="block text-xs font-medium text-[#0A0A0A] mb-2">
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
                    className="flex-1 h-10 rounded-full bg-[#0A0A0A] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222] transition-colors disabled:opacity-50"
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
                    className="text-xs text-[#999] hover:text-[#0A0A0A] transition-colors underline underline-offset-2"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* ─── Done ─── */}
            {step === "done" && (
              <div className="px-5 pb-5 pt-1 text-center">
                <div className="w-10 h-10 rounded-full bg-[#0A0A0A] flex items-center justify-center mx-auto mb-3">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-[#0A0A0A] mb-1">
                  You're on the list
                </h3>
                <p className="text-xs text-[#757575] mb-4 leading-relaxed">
                  We'll reach out when your spot is ready. Keep an eye on your
                  inbox.
                </p>
                <button
                  onClick={onClose}
                  className="text-xs text-[#999] hover:text-[#0A0A0A] transition-colors underline underline-offset-2"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </motion.div>
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
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
        selected
          ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
          : "bg-white text-[#555] border-[#D5D5D5] hover:border-[#0A0A0A]/30"
      }`}
    >
      {label}
    </button>
  );
}
