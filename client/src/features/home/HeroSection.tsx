import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { easeOut, easeInOut, clientLogos } from "./homeData";
import FlowLines from "@/components/hero3d/FlowLines";

const HeroScene = lazy(() => import("@/components/hero3d/HeroScene"));

function LogoMarquee() {
  return (
    <div 
      className="relative overflow-hidden flex-1"
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)'
      }}
    >
      <div className="flex animate-marquee">
        {[...clientLogos, ...clientLogos, ...clientLogos, ...clientLogos].map((logo, index) => (
          <div
            key={index}
            className="flex items-center justify-center min-w-[100px] sm:min-w-[140px] px-4 sm:px-8 opacity-40 hover:opacity-100 transition-all duration-300"
          >
            <img 
              src={logo.logo} 
              alt={logo.name} 
              className="h-6 sm:h-8 w-auto object-contain"
              style={{ filter: 'brightness(0)' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-[80vh] sm:min-h-screen pt-12 sm:pt-20 pb-16 sm:pb-[120px] bg-white">
      {/* Subtle animated flow lines across the entire hero section */}
      <FlowLines />
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        {/* Main Hero Content */}
        <div className="pb-6 sm:pb-[50px]">
          {/* Large Wordmark */}
          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[clamp(2.5rem,15vw,12rem)] font-bold tracking-tighter leading-[0.85] text-[#0A0A0A] -mb-[30px] sm:-mb-[78px] mt-4 sm:mt-[35px]"
          >
            Forma®
          </motion.h1>
          
          {/* Tagline */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: easeOut }}
            className="mt-8 max-w-md ml-auto text-right"
          >
            <p className="text-sm sm:text-base text-gray-secondary">
              Forma is an AI studio crafting refined model identities and photorealistic campaign assets.
            </p>
          </motion.div>
        </div>

        {/* Logo Marquee + Trust Badge */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 py-4 sm:py-6"
        >
          {/* Logo Marquee with gradient fades */}
          <LogoMarquee />
          
          {/* Trust Badge - Below on mobile, right-aligned on desktop */}
          <div className="flex flex-col items-start sm:items-end shrink-0 sm:pl-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#4D4D4D] fill-current" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
              <span className="ml-1.5 text-xs sm:text-sm font-medium text-[#0A0A0A]/80">4.9/5</span>
            </div>
            <span className="text-xs sm:text-sm text-[#4D4D4D] font-medium">Trusted by <span className="font-medium text-[#0A0A0A]/70">100+</span> businesses</span>
          </div>
        </motion.div>

        {/* Hero Image with interactive 3D depth/reveal */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: easeOut }}
          className="relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden sm:h-[950px]"
        >

          <Suspense fallback={
            <img
              src="/api/hero/base"
              alt="AI Generated Model"
              className="w-full h-full object-cover"
              loading="eager"
            />
          }>
            <HeroScene />
          </Suspense>
        </motion.div>
      </div>
    </section>
  );
}
