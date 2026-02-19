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
    <section className="min-h-[80vh] sm:min-h-screen pt-12 sm:pt-20 pb-16 sm:pb-[120px] bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        {/* Main Hero Content */}
        <div className="pb-6 sm:pb-[50px]">
          {/* Large Wordmark */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="-mb-[30px] sm:-mb-[78px] mt-4 sm:mt-[35px]"
          >
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/CPDvqyNnvNcINXkM.jpg" 
              alt="drape" 
              className="w-[clamp(10rem,60vw,48rem)] h-auto mx-auto mix-blend-multiply"
            />
          </motion.div>
          
          {/* Tagline */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: easeOut }}
            className="mt-8 max-w-md ml-auto text-right"
          >
            <p className="text-sm sm:text-base text-gray-secondary">
              Studio-grade AI creation. No prompts. Just create.
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
          
          {/* Trust Line */}
          <div className="shrink-0 sm:pl-4">
            <span className="text-xs sm:text-sm text-[#4D4D4D] font-medium tracking-wide uppercase">Trusted by top creatives working for</span>
          </div>
        </motion.div>

        {/* Hero Image with interactive 3D depth/reveal */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: easeOut }}
          className="relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden sm:h-[950px]"
        >
          {/* Subtle animated flow lines behind the hero image */}
          <FlowLines />
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
