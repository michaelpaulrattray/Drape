/**
 * HeroContent — centered hero block with headline, subtitle, email waitlist CTA.
 *
 * Uses Instrument Serif italic for emphasis, Geist for UI, Barlow for body.
 * Framer Motion staggered fade-up + blur animations.
 * Email validation + submission via tRPC waitlist.join mutation.
 */
import { motion } from "framer-motion";
import { ArrowRight, Users, Check, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 30, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.7, delay, ease: "easeOut" as const },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function HeroContent() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.alreadyRegistered) {
        toast.info("You're already on the waitlist.");
      } else {
        toast.success("You're on the list — we'll be in touch.");
      }
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  const handleSubmit = useCallback(() => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    joinMutation.mutate({ email: trimmed, name: "" });
  }, [email, joinMutation]);

  const isLoading = joinMutation.isPending;

  return (
    <div className="flex flex-col items-center text-center px-4 pt-24 pb-4">
      <div className="max-w-[1200px] w-full flex flex-col items-center gap-8">
        {/* Main Heading */}
        <motion.h1
          {...fadeUp(0.1)}
          className="font-geist font-medium tracking-[-0.04em] text-white leading-[0.95]"
          style={{ fontSize: "clamp(40px, 5.5vw, 80px)" }}
        >
          Your next{" "}
          <span
            className="font-heading italic"
            style={{ fontSize: "clamp(50px, 6.9vw, 100px)" }}
          >
            campaign,
          </span>
          <br />
          cast in minutes
        </motion.h1>

        {/* Description */}
        <motion.p
          {...fadeUp(0.3)}
          className="font-body text-lg max-w-[554px] leading-relaxed text-white/80"
        >
          AI-generated models with studio-grade consistency.
          Cast, dress, and shoot — without a single booking.
        </motion.p>

        {/* Email Input Block */}
        <motion.div {...fadeUp(0.5)} className="flex flex-col items-center gap-4 w-full max-w-[480px]">
          {!submitted ? (
            <>
              <div className="liquid-glass flex items-center w-full rounded-[40px] px-2 py-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Enter your email"
                  className="flex-1 bg-transparent px-5 py-3 text-sm font-body text-white placeholder:text-white/40 outline-none"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-[32px] px-6 py-3 text-sm font-geist font-medium bg-white text-slate-900 transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Join Waitlist
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-white/50" />
                <span className="font-body text-sm text-white/70 font-medium">
                  Join 500+ creatives on the waitlist
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-white/90 font-body text-sm font-medium">
              <Check className="h-4 w-4 text-green-400" />
              Thank you — you're on the list
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
