import { useState, useRef } from "react";
import { X, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, fadeInUp, scaleIn, statsMarqueeItems } from "./homeData";
import { SectionLabel } from "./SectionLabel";

function StatsMarquee() {
  // Create two sets for seamless loop
  const statsSet = [...statsMarqueeItems, ...statsMarqueeItems];
  
  return (
    <div 
      className="relative overflow-hidden flex-1"
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)'
      }}
    >
      <div className="flex animate-marquee">
        {/* First set */}
        <div className="flex shrink-0 items-center whitespace-nowrap">
          {statsSet.map((stat, index) => (
            <span key={index} className="flex items-center text-sm mx-3">
              <span className="font-bold text-[#0A0A0A]/70">{stat.value}</span>
              <span className="text-[#757575] ml-1.5">{stat.label}</span>
              <span className="text-[#0A0A0A]/30 ml-3">/</span>
            </span>
          ))}
        </div>
        {/* Duplicate set for seamless loop */}
        <div className="flex shrink-0 items-center whitespace-nowrap">
          {statsSet.map((stat, index) => (
            <span key={`dup-${index}`} className="flex items-center text-sm mx-3">
              <span className="font-semibold text-[#0A0A0A]/70">{stat.value}</span>
              <span className="text-[#0A0A0A]/40 ml-1.5">{stat.label}</span>
              <span className="text-[#0A0A0A]/30 ml-3">/</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AboutSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Show hover effect when mouse is over and not playing
  const showHoverEffect = isMouseOver && !isPlaying;

  const handlePlay = () => {
    setIsPlaying(true);
    // Small delay to let video element render before playing
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const handleMouseEnter = () => {
    setIsMouseOver(true);
  };

  const handleMouseLeave = () => {
    setIsMouseOver(false);
  };

  return (
    <section id="about" className="py-12 sm:py-24 bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="About us" number="01" />
        </motion.div>

        {/* Two-tone Headline - Forma Style with font-medium, smaller size */}
        <motion.h2 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-[clamp(1.25rem,5vw,3.375rem)] font-medium leading-[1.15] tracking-tight mb-12"
        >
          <span className="text-[#0A0A0A]">We're a design studio focused on creating</span>
          <br />
          <span className="text-gray-secondary">simple, purposeful, and elegant solutions.</span>
        </motion.h2>

        {/* Stats Marquee + Description - Inline Layout */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 py-4 sm:py-6 -mb-[10px]"
        >
          {/* Stats Marquee with gradient fades */}
          <StatsMarquee />
          
          {/* Description - Right aligned */}
          <p className="shrink-0 text-sm sm:text-base text-gray-muted sm:text-right w-full sm:w-[380px]">
            Our studio is dedicated to crafting clean, purposeful solutions that cut through the noise.
          </p>
        </motion.div>

        {/* Video Block - Full Width */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={scaleIn}
          className="relative w-full aspect-[4/3] sm:aspect-video rounded-xl overflow-hidden bg-[#0A0A0A] cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Static Image - always mounted, controlled by opacity */}
          <div
            className="absolute inset-0 z-10 transition-opacity duration-300"
            style={{ opacity: isPlaying ? 0 : 1 }}
          >
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-black/50 z-10"></div>
            <img
              src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80"
              alt="Showreel"
              loading="lazy"
              decoding="async"
              className="video-showreel-image w-full h-full object-cover grayscale contrast-110"
              style={{
                transform: `scale(${showHoverEffect ? 1.1 : 1})`,
                filter: `blur(${showHoverEffect ? '4px' : '0px'})`,
                transition: 'transform 700ms ease-out, filter 700ms ease-out'
              }}
            />
          </div>

          {/* Video Element - shown when playing */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover z-5 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
            playsInline
            onEnded={handleClose}
          />

          {/* Play/Close Button with smooth animation */}
          <motion.button
            layout
            onClick={isPlaying ? handleClose : handlePlay}
            className="absolute z-30 rounded-full bg-white flex items-center justify-center shadow-lg"
            initial={false}
            animate={{
              top: isPlaying ? 24 : '50%',
              left: '50%',
              x: '-50%',
              y: isPlaying ? 0 : '-50%',
              width: isPlaying ? 40 : 64,
              height: isPlaying ? 40 : 64,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.5
            }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="close"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="w-5 h-5 text-[#0A0A0A]" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Play className="video-play-icon w-6 h-6 text-[#0A0A0A] fill-[#0A0A0A] ml-0.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Play Showreel Label - fades out when playing */}
          <AnimatePresence>
            {!isPlaying && (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 translate-y-8 mt-4 text-white text-sm sm:text-2xl font-semibold z-20"
                
              >
                Play Showreel
              </motion.span>
            )}
          </AnimatePresence>

          {/* Forma branding at bottom */}
          <div className="absolute bottom-4 left-0 right-0 text-center z-20">
            <span className="text-white text-base font-medium">© 2025 Forma®</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
