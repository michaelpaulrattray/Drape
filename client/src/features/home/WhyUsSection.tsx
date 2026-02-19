import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/design-system";
import { fadeIn, fadeInUp, staggerContainer } from "./homeData";
import { SectionLabel } from "./SectionLabel";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function WhyUsSection() {
  const [email, setEmail] = useState("");
  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      toast.success("You're on the list. We'll be in touch.");
      setEmail("");
    },
    onError: (err) => {
      if (err.message.includes("already")) {
        toast.info("You're already on the waitlist.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    joinWaitlist.mutate({ email: email.trim() });
  };

  return (
    <section id="whyus" className="py-12 sm:py-24 bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="Why us" number="03" />
        </motion.div>

        {/* Two-tone Headline */}
        <motion.h2 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-[clamp(2rem,5vw,3.375rem)] font-medium leading-[1.15] mb-8 sm:mb-16 w-full lg:w-[1018px]"
        >
          <span className="text-[#0A0A0A]">Power without friction. </span>
          <span className="text-gray-secondary">Control without complexity.</span>
        </motion.h2>

        {/* 4-Column Bento Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1"
        >
          {/* Card 1 - Dark card + bullet list */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2 flex flex-col gap-2">
            {/* Top: Dark card */}
            <div className="relative rounded-xl overflow-hidden bg-[#0A0A0A] min-h-[240px] h-bento-card flex flex-col justify-between">
              <img
                src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80"
                alt="Architecture"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale"
              />
              <div className="relative z-10 p-5">
                <h3 className="text-card-title font-semibold text-white leading-tight">Built for Creative<br />Directors.</h3>
                <p className="text-white/50 text-xs mt-2">Not prompt engineers.</p>
              </div>
              <div className="relative z-10 p-5 pt-0">
                <Button href="/#contact" variant="secondary" size="sm" showPlus>
                  Join waitlist
                </Button>
              </div>
            </div>
            {/* Bottom: Bullet list card */}
            <div className="bg-white rounded-xl p-4">
              <ul className="space-y-2">
                {["Visual-first controls", "Identity persistence", "Studio-grade fidelity", "Ownership built in", "Brand-safe defaults"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-body-md text-[#0A0A0A]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Card 2 - Waitlist CTA */}
          <div className="bg-[#EBEBEB] rounded-2xl p-5 flex flex-col justify-between min-h-[400px]">
            {/* Top: Waitlist heading */}
            <div>
              <h3 className="text-xl font-semibold text-[#0A0A0A] mb-2">Join the waitlist</h3>
              <p className="text-sm text-[#757575] leading-relaxed">
                Be among the first creative directors to access Drape. Early members get priority access and founding pricing.
              </p>
            </div>
            {/* Bottom: Email form */}
            <div>
              <form onSubmit={handleWaitlistSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 rounded-full bg-white border border-[#0A0A0A]/10 text-sm text-[#0A0A0A] placeholder:text-[#757575] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={joinWaitlist.isPending}
                  className="w-full px-4 py-3 rounded-full bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#0A0A0A]/90 transition-colors disabled:opacity-50"
                >
                  {joinWaitlist.isPending ? "Joining..." : "Request early access"}
                </button>
              </form>
              <p className="text-xs text-[#757575] mt-3 text-center">No spam. Just launch updates.</p>
            </div>
          </div>

          {/* Card 3 - Feature cards */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2 flex flex-col gap-2">
            {[
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, title: "Zero Prompting", desc: "Prompts run in the background. You stay in the creative headspace while the system handles complexity." },
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>, title: "Identity Persistence", desc: "Your model stays consistent across casting, wardrobe, and campaigns. No drift, no re-rolling." },
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>, title: "Ownership & Export", desc: "Casting sheet, unique identifiers, and documentation. Built for client handoff and brand governance." },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-4 flex-1">
                <div className="text-[#0A0A0A] mb-3">{feature.icon}</div>
                <h4 className="font-semibold text-[#0A0A0A] text-lg mb-1.5">{feature.title}</h4>
                <p className="text-body-md text-gray-secondary">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Column 4 - Tall dark card */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0A0A0A] min-h-[300px] sm:min-h-[500px] md:min-h-full flex flex-col justify-between">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80"
              alt="Model identity"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale"
            />
            <div className="relative z-10 p-6 text-right">
              <span className="text-white/80 text-lg font-medium mr-20">Drape</span>
            </div>
            <div className="relative z-10 p-6">
              <h3 className="text-2xl font-semibold text-white leading-tight">From casting to campaigns.</h3>
              <p className="text-white/60 text-sm mt-1">Consistency, locked in.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
