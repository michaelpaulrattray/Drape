import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { FooterLink } from "@/components/design-system";
import { fadeInUp, fadeIn, staggerContainer } from "./homeData";

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [validationError, setValidationError] = useState("");

  // Email validation regex
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const subscribeMutation = trpc.newsletter.subscribe.useMutation({
    onSuccess: (data) => {
      if (data.isNew) {
        setStatus("success");
      } else {
        setStatus("duplicate");
      }
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message || "Something went wrong. Please try again.");
      // Reset error after 5 seconds
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage("");
      }, 5000);
    },
  });

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    // Clear validation error when user starts typing
    if (validationError) setValidationError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading" || status === "success" || status === "duplicate") return;
    
    // Validate email format
    if (!isValidEmail(email)) {
      setValidationError("Please enter a valid email address");
      return;
    }
    
    setStatus("loading");
    subscribeMutation.mutate({ email, source: "website_footer" });
  };

  const isSubmitted = status === "success" || status === "duplicate";

  return (
    <div className="max-w-sm">
      <p className="text-white/60 mb-4">Get launch updates and early access.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="Email"
          disabled={status === "loading" || isSubmitted}
          className={`w-full px-4 py-3 bg-white/10 border rounded-full text-white placeholder:text-white/40 focus:outline-none transition-colors disabled:opacity-70 ${
            validationError 
              ? "border-red-400 focus:border-red-400" 
              : "border-white/20 focus:border-white/40"
          }`}
        />
        {validationError && (
          <p className="text-red-400 text-sm -mt-1 ml-4">{validationError}</p>
        )}
        <button 
          type="submit" 
          disabled={status === "loading" || isSubmitted}
          className={`group w-full py-3 rounded-full font-medium transition-all duration-300 bg-[#EBEBEB] text-[#0A0A0A] disabled:opacity-70 ${
            isSubmitted ? "" : "hover:bg-[#DEDEDE]"
          }`}
        >
          {status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Joining...
            </span>
          ) : status === "success" ? (
            "Thank You!"
          ) : status === "duplicate" ? (
            "This email is already on the list."
          ) : (
            <span className="overflow-hidden h-5 block">
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
                Join waitlist
              </span>
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
                Join waitlist
              </span>
            </span>
          )}
        </button>
      </form>
      {errorMessage && (
        <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
      )}
    </div>
  );
}

export function Footer() {
  return (
    <footer id="contact" className="py-12 sm:py-24 bg-[#0A0A0A] text-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12">
        {/* Large Wordmark */}
        <motion.h2 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-[clamp(1.75rem,10vw,8rem)] font-bold tracking-tighter mb-8 sm:mb-16 text-surface"
        >
          Forma® Studio
        </motion.h2>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid lg:grid-cols-2 gap-8 sm:gap-16 mb-8 sm:mb-16"
        >
          {/* Left - Contact */}
          <div>
            <p className="text-white/60 mb-8 max-w-md">
              We're building the next generation of AI-powered creative tools. Have questions, want early access, or just want to say hello?
            </p>
            <div className="space-y-2">
              <FooterLink href="mailto:hello@formastudio.ai" className="underline underline-offset-4">hello@formastudio.ai</FooterLink>
            </div>
          </div>

          {/* Right - Newsletter */}
          <NewsletterForm />
        </motion.div>

        {/* Links Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeIn}
          className="grid grid-cols-2 md:grid-cols-3 gap-8 py-12 border-t border-white/10"
        >
          <div className="space-y-3">
            <FooterLink href="/">Home</FooterLink>
            <FooterLink href="#about">About</FooterLink>
            <FooterLink href="#work">Projects</FooterLink>
            <FooterLink href="#blog">Blog</FooterLink>
            <FooterLink href="#contact">Contact</FooterLink>
          </div>
          <div className="space-y-3">
            <FooterLink href="#">Terms & Conditions</FooterLink>
            <FooterLink href="#">Privacy Policy</FooterLink>
          </div>
          <div className="space-y-3">
            <FooterLink href="#">Twitter/X</FooterLink>
            <FooterLink href="#">Instagram</FooterLink>
            <FooterLink href="#">LinkedIn</FooterLink>
          </div>
        </motion.div>

        {/* Powered By */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeIn}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 py-8 border-t border-white/10"
        >
          <span className="text-xs uppercase tracking-widest text-white/30">Powered by</span>
          <div className="flex items-center gap-6 sm:gap-10">
            {/* Google Gemini */}
            <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 0C14 7.732 7.732 14 0 14C7.732 14 14 20.268 14 28C14 20.268 20.268 14 28 14C20.268 14 14 7.732 14 0Z" fill="url(#gemini-gradient)"/>
                <defs>
                  <linearGradient id="gemini-gradient" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4285F4"/>
                    <stop offset="0.5" stopColor="#9B72CB"/>
                    <stop offset="1" stopColor="#D96570"/>
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-sm font-medium">Gemini</span>
            </a>

            <span className="w-px h-5 bg-white/15" />

            {/* Nano Banana */}
            <a href="https://deepmind.google/technologies/gemini/nano-banana/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors">
              <span className="text-lg leading-none">🍌</span>
              <span className="text-sm font-medium">Nano Banana</span>
            </a>

            <span className="w-px h-5 bg-white/15" />

            {/* Manus */}
            <a href="https://manus.im" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C11.5 4 10 5 8.5 5.5C7 6 6 7 5.5 8.5C5 10 4 11.5 2 12C4 12.5 5 14 5.5 15.5C6 17 7 18 8.5 18.5C10 19 11.5 20 12 22C12.5 20 14 19 15.5 18.5C17 18 18 17 18.5 15.5C19 14 20 12.5 22 12C20 11.5 19 10 18.5 8.5C18 7 17 6 15.5 5.5C14 5 12.5 4 12 2Z" fill="currentColor"/>
                <circle cx="8" cy="3" r="1" fill="currentColor"/>
                <circle cx="18" cy="5" r="0.8" fill="currentColor"/>
                <circle cx="20" cy="9" r="0.6" fill="currentColor"/>
              </svg>
              <span className="text-sm font-medium">Manus</span>
            </a>
          </div>
        </motion.div>

        {/* Copyright */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeIn}
          className="flex items-center justify-between pt-8 border-t border-white/10 text-sm text-white/40"
        >
          <span>© 2026 FormaStudio™. All rights reserved.</span>
        </motion.div>
      </div>
    </footer>
  );
}
