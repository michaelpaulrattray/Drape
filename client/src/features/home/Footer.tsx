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
      <p className="text-white/60 mb-4">Sign up for our monthly newsletter.</p>
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
              Signing up...
            </span>
          ) : status === "success" ? (
            "Thank You!"
          ) : status === "duplicate" ? (
            "This email is already on the list."
          ) : (
            <span className="overflow-hidden h-5 block">
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
                Sign up
              </span>
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
                Sign up
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
    <footer className="py-12 sm:py-24 bg-[#0A0A0A] text-white">
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
              Whether you're building a brand, designing a product, or simply want to explore an idea, we'd love to hear from you.
            </p>
            <div className="space-y-2">
              <FooterLink href="mailto:hello@formastudio.ai" className="underline underline-offset-4">hello@formastudio.ai</FooterLink>
              <FooterLink href="tel:+1234567890" className="underline underline-offset-4">(123) 456-7890</FooterLink>
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
            <FooterLink href="/#contact">Contact</FooterLink>
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

        {/* Copyright */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeIn}
          className="flex items-center justify-between pt-8 border-t border-white/10 text-sm text-white/40"
        >
          <span>© 2025 All rights reserved</span>
          <span>Designed with AI</span>
        </motion.div>
      </div>
    </footer>
  );
}
