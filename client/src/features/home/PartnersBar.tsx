/**
 * PartnersBar — static partner names with staggered blur-in animations.
 *
 * Matches celestial-horizon reference exactly:
 * - Liquid-glass label pill at top
 * - Static row of brand names in Instrument Serif italic
 * - Staggered fade + blur entrance animations
 */
import { motion } from "framer-motion";

const PARTNERS = ["Shopify", "Instagram", "Meta", "TikTok", "Pinterest"];

export function PartnersBar() {
  return (
    <div className="flex flex-col items-center gap-4 pt-20 pb-8">
      <motion.span
        initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
        className="liquid-glass rounded-full px-3.5 py-1 text-xs font-medium text-white font-body"
      >
        Where the best campaigns begin
      </motion.span>
      <div className="flex items-center gap-8 md:gap-16 flex-wrap justify-center">
        {PARTNERS.map((name, i) => (
          <motion.span
            key={name}
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.5, delay: 1.0 + i * 0.1, ease: "easeOut" }}
            className="text-2xl md:text-3xl font-heading italic text-white tracking-tight"
          >
            {name}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
