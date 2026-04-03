/**
 * HomeNavbar — floating glassmorphism navigation bar for the hero landing page.
 * 
 * Fixed at top, transparent over video background with liquid-glass pill nav.
 * Drape wordmark left, nav links + CTA right.
 */
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = ["Product", "Pricing", "About"];

export function HomeNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-4 left-0 right-0 z-50 px-6 lg:px-16">
      <div className="flex items-center justify-between">
        {/* Logo / Wordmark */}
        <span className="font-geist font-semibold text-xl text-white tracking-tight">
          drape
        </span>

        {/* Desktop nav — glass pill */}
        <div className="hidden md:flex items-center liquid-glass rounded-full px-2 py-1.5 gap-1">
          {navLinks.map((link) => (
            <a
              key={link}
              href="#"
              className="px-3 py-2 text-sm font-medium text-white/90 font-body hover:text-white transition-colors"
            >
              {link}
            </a>
          ))}
          <button className="bg-white text-slate-900 rounded-full px-3.5 py-1.5 text-sm font-medium font-body flex items-center gap-1 hover:opacity-90 transition-opacity">
            Join Waitlist
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mt-3 liquid-glass rounded-2xl p-4 flex flex-col gap-3"
          >
            {navLinks.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm font-medium text-white/90 font-body hover:text-white transition-colors py-1"
              >
                {link}
              </a>
            ))}
            <button className="bg-white text-slate-900 rounded-full px-4 py-2 text-sm font-medium font-body flex items-center justify-center gap-1 hover:opacity-90 transition-opacity mt-1">
              Join Waitlist
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
