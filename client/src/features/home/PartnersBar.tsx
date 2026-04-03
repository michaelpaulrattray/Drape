/**
 * PartnersBar — animated scrolling partner names in Instrument Serif italic.
 *
 * Infinite marquee of brand names separated by dots.
 * Sits at the bottom of the hero section.
 */
import { motion } from "framer-motion";

const PARTNERS = ["Gucci", "Prada", "Balenciaga", "Zara", "Versace"];

function PartnerRow() {
  return (
    <>
      {PARTNERS.map((name, i) => (
        <span key={`${name}-${i}`} className="flex items-center gap-8 shrink-0">
          <span className="font-heading italic text-2xl text-white/60 tracking-wide">
            {name}
          </span>
          <span className="text-white/30 text-xs">●</span>
        </span>
      ))}
    </>
  );
}

export function PartnersBar() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.9 }}
      className="w-full overflow-hidden py-6"
    >
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        <PartnerRow />
        <PartnerRow />
        <PartnerRow />
        <PartnerRow />
      </div>
    </motion.div>
  );
}
