import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Menu, X, Plus, Play, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";

// ============ ANIMATION VARIANTS ============

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

// ============ DATA ============

const clientLogos = [
  { name: "Shopify" },
  { name: "Meta" },
  { name: "Nike" },
  { name: "Instagram" },
  { name: "Google" },
  { name: "Vogue" },
];

const statsMarqueeItems = [
  { value: "97%", label: "Customer satisfaction rate" },
  { value: "6", label: "Industry awards" },
  { value: "15+", label: "Years of Experience" },
  { value: "140+", label: "Projects completed" },
  { value: "100+", label: "Customer satisfaction rate" },
];

const projects = [
  { name: "Lune", year: "2025", category: "App Visual Direction", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80" },
  { name: "Aren", year: "2025", category: "Fashion Brand Launch", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80" },
  { name: "Oura", year: "2024", category: "Brand Refinement", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80" },
  { name: "Forma", year: "2024", category: "Product UI", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80" },
  { name: "Oko", year: "2023", category: "Portfolio Website", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80" },
  { name: "Velin", year: "2022", category: "Skincare Rebrand", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80" },
];

const services = [
  {
    title: "Model Identity",
    number: 1,
    description: "We generate unique, consistent AI model identities for your brand with photorealistic quality and complete creative control.",
    items: ["Model Generation", "Identity Systems", "Character Guidelines", "Ethnicity & Aesthetic", "Pose Libraries", "Expression Ranges"],
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
  },
  {
    title: "Outfit Generation",
    number: 2,
    description: "We create any outfit on your AI models. From streetwear to haute couture, no physical samples needed.",
    items: ["Virtual Try-On", "Garment Design", "Fabric Simulation", "Color Variants", "Style Matching", "Seasonal Collections"],
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80",
  },
  {
    title: "Campaign Production",
    number: 3,
    description: "Full photoshoot generation with complete lighting and environment control for campaign-ready assets.",
    items: ["Scene Composition", "Lighting Design", "Background Generation", "Multi-angle Shots", "Post-processing", "Asset Delivery"],
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80",
  },
  {
    title: "Brand Consistency",
    number: 4,
    description: "Maintain perfect visual consistency across all channels with AI-powered brand asset generation.",
    items: ["Style Guidelines", "Asset Libraries", "Cross-platform Assets", "Brand Templates", "Quality Control", "Version Management"],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
  },
];

const processSteps = [
  { title: "Discover", number: 1, description: "We begin by listening, gaining a deep understanding of your goals, audience, and creative vision through research and conversation." },
  { title: "Define", number: 2, description: "We distill insights into a clear direction. Strategy, model specifications, and creative foundations are established to guide the work forward." },
  { title: "Generate", number: 3, description: "Ideas take shape through AI generation. We explore, refine, and iterate with intention, always rooted in purpose and brand alignment." },
  { title: "Deliver", number: 4, description: "We finalize and hand off with care. Every asset is prepared for implementation with clarity, consistency, and attention to detail." },
];

const pricingFeatures = [
  "Unlimited generation requests",
  "One active project at a time",
  "Weekly progress calls",
  "Fast turnaround times",
  "Brand consistency across all deliverables",
  "Priority support",
  "Pause or cancel anytime",
];

const testimonials = [
  { quote: "FormaStudio understood our brand better than we did. Their ability to generate the perfect model identities is what sets them apart.", name: "Sofia Ford", title: "Creative Director", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
  { quote: "Working with FormaStudio felt effortless. They have a rare ability to take complex briefs and distill them into something beautifully simple.", name: "Emma V.", title: "Founder", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" },
  { quote: "FormaStudio doesn't just generate images—they listen, interpret, and then create with precision.", name: "Julian M.", title: "Creative Director", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" },
];

const faqs = [
  { question: "What kind of clients do you work with?", answer: "We work with fashion brands, e-commerce companies, and creative teams who value consistency, speed, and photorealistic quality. Whether you're launching something new or scaling an existing presence, we adapt our approach to your needs." },
  { question: "What services do you offer?", answer: "Our core services include AI model casting, outfit generation, campaign production, and brand consistency systems. We often work across multiple touchpoints to ensure cohesion in everything we create." },
  { question: "How do you price your projects?", answer: "We price based on scope, timeline, and deliverables—never by the hour. After a discovery call, we'll provide a custom proposal aligned with your goals and budget." },
  { question: "What is your typical project timeline?", answer: "Timelines vary by project, but most model generation projects take 1-2 weeks, while full campaign projects may range from 2-4 weeks. We'll always agree on key milestones before starting." },
  { question: "Can we collaborate remotely?", answer: "Absolutely. All of our work is done remotely, and we've partnered successfully with clients across time zones. Clear communication and structured check-ins keep everything on track." },
  { question: "Do you accept one-off generation tasks or only full projects?", answer: "We typically take on full-scope projects to ensure cohesion and quality. However, if you have a smaller need that aligns with our approach, we're open to discussing it." },
  { question: "How many variations or revisions are included?", answer: "Our process is collaborative and structured. Rather than presenting dozens of options, we focus on one strong direction—refined through feedback. The number of revisions depends on the scope, but clarity and alignment are our priority from the start." },
];

const blogPosts = [
  { date: "May 30, 2025", title: "The Power of AI in Fashion Photography", excerpt: "A look at how AI-generated models can sharpen brand communication and increase campaign impact.", category: "Insights", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80" },
  { date: "May 23, 2025", title: "Designing for Scale: AI Beyond the Shoot", excerpt: "An exploration of how AI model generation enables unlimited variations without traditional constraints.", category: "Technology", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80" },
  { date: "May 16, 2025", title: "Building a Timeless Brand Identity", excerpt: "A guide to creating consistent model personas that transcend trends and seasonal campaigns.", category: "Strategy", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80" },
];

// ============ COMPONENTS ============

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Live time update every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Format time for display
  const formatTime = () => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Australia/Sydney'
    };
    return currentTime.toLocaleString('en-US', options).replace(',', '');
  };

  return (
    <header className="sticky top-0 z-50 max-w-[1520px] mx-auto px-6 lg:px-12 bg-[#EBEBEB] rounded-full">
      <div className="flex items-center justify-between h-14">
          {/* Logo + Time */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png" 
                alt="Forma®" 
                className="h-6"
                style={{width: '31px', height: '31px'}}
              />
            </Link>
            <span className="text-sm text-[#0A0A0A]/50 hidden sm:inline" style={{color: '#757575'}}>{formatTime()}</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-sm text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" style={{fontWeight: '500'}}>About</a>
            <a href="#work" className="text-sm text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" style={{fontWeight: '500'}}>Work</a>
            <a href="#services" className="text-sm text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" style={{fontWeight: '500'}}>Services</a>
            <a href="#pricing" className="text-sm text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" style={{fontWeight: '500'}}>Pricing</a>
            <a href="#blog" className="text-sm text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" style={{fontWeight: '500'}}>Blog</a>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/waitlist"
              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white text-sm font-medium rounded-full hover:bg-[#0A0A0A]/90 transition-colors overflow-hidden"
            >
              <span className="overflow-hidden h-5">
                <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Start a project</span>
                <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Start a project</span>
              </span>
            </Link>
            <button className="w-10 h-10 flex items-center justify-center rounded-full border border-[#0A0A0A]/10 hover:bg-[#0A0A0A]/5 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
      </div>

      {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 right-0 bg-white border-t border-[#0A0A0A]/10 shadow-lg">
            <nav className="flex flex-col p-6 gap-4">
              <a href="#about" className="text-lg text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>About</a>
              <a href="#work" className="text-lg text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Work</a>
              <a href="#services" className="text-lg text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Services</a>
              <a href="#pricing" className="text-lg text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
              <a href="#blog" className="text-lg text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Blog</a>
              <Link
                href="/waitlist"
                className="group inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0A0A0A] text-white text-sm font-medium rounded-full hover:bg-[#0A0A0A]/90 transition-colors mt-4 overflow-hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="overflow-hidden h-5">
                  <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Start a project</span>
                  <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Start a project</span>
                </span>
              </Link>
            </nav>
          </div>
        )}
    </header>
  );
}

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
            className="flex items-center justify-center min-w-[120px] px-8 grayscale opacity-50 hover:opacity-100 hover:grayscale-0 transition-all duration-300"
          >
            <span className="text-xl font-semibold text-[#0A0A0A]/40">{logo.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroSection() {
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: imageContainerRef,
    offset: ["start end", "end end"]
  });
  // Clamp scale to never go below 1.0
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.25, 1.0], { clamp: true });
  const smoothScale = useSpring(imageScale, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <section className="min-h-screen pt-20 bg-white" style={{paddingBottom: '120px'}}>
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12" style={{paddingRight: '0px', paddingLeft: '0px'}}>
        {/* Main Hero Content */}
        <div className="pt-[40vh] pb-8" style={{paddingTop: '470px'}}>
          {/* Large Wordmark */}
          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[clamp(4rem,15vw,12rem)] font-bold tracking-tighter leading-[0.85] text-[#0A0A0A]" 
            style={{fontWeight: '500', fontFamily: 'Inter, sans-serif', fontSize: '210px', marginBottom: '-78px'}}
          >
            Forma®
          </motion.h1>
          
          {/* Tagline */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="mt-8 max-w-md ml-auto text-right"
          >
            <p className="text-lg text-[#4D4D4D] leading-relaxed" style={{fontWeight: '500', color: '#757575', lineHeight: '22px'}}>
              Forma is an AI studio crafting refined model identities and photorealistic campaign assets.
            </p>
          </motion.div>
        </div>

        {/* Logo Marquee + Trust Badge - Inline */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex items-center gap-6 py-6 border-y border-[#0A0A0A]/10" 
          style={{borderWidth: '0px', height: '90px'}}
        >
          {/* Logo Marquee with gradient fades */}
          <LogoMarquee />
          
          {/* Trust Badge - Right aligned */}
          <div className="flex items-center gap-4 shrink-0 pl-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-3.5 h-3.5 text-[#4D4D4D] fill-current" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
              <span className="ml-1.5 text-sm font-medium text-[#0A0A0A]/80">4.9/5</span>
            </div>
            <span className="text-sm text-[#4D4D4D]" style={{fontWeight: '500'}}>Trusted by <span className="font-medium text-[#0A0A0A]/70" style={{fontWeight: '500'}}>100+</span> businesses</span>
          </div>
        </motion.div>

        {/* Hero Image with scroll-unzoom effect */}
        <motion.div 
          ref={imageContainerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-[#0A0A0A]/5"
        >
          <motion.img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&q=80"
            alt="AI Generated Model"
            className="w-full h-full object-cover grayscale contrast-125"
            style={{ scale: smoothScale }}
          />
        </motion.div>
      </div>
    </section>
  );
}

function SectionLabel({ label, number }: { label: string; number: string }) {
  return (
    <div className="flex items-center justify-between mb-12" style={{marginBottom: '22px'}}>
      <span className="text-sm font-semibold text-[#0A0A0A] tracking-wide" style={{fontSize: '16px'}}>/ {label}</span>
      <span className="text-sm font-semibold text-[#757575]" style={{fontSize: '16px'}}>({number})</span>
    </div>
  );
}

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
              <span className="font-semibold text-[#0A0A0A]/70" style={{fontWeight: '700'}}>{stat.value}</span>
              <span className="text-[#0A0A0A]/40 ml-1.5" style={{color: '#757575'}} style={{color: '#757575'}} style={{color: '#757575'}} style={{color: '#757575'}} style={{color: '#757575'}}>{stat.label}</span>
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

function AboutSection() {
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
    // isMouseOver is still true if mouse never left, so showHoverEffect becomes true immediately
  };

  const handleMouseEnter = () => {
    setIsMouseOver(true);
  };

  const handleMouseLeave = () => {
    setIsMouseOver(false);
  };

  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12" style={{paddingRight: '0px', paddingLeft: '0px'}}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="About us" number="01" />
        </motion.div>

        {/* Two-tone Headline - Kanso Style with font-medium, smaller size */}
        <motion.h2 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15] tracking-tight mb-12"
        >
          <span className="text-[#0A0A0A]" style={{fontSize: '54px', fontFamily: 'Inter, sans-serif'}}>We're a design studio focused on creating</span>
          <br />
          <span className="text-[#757575]" style={{fontSize: '54px', fontFamily: 'Inter, sans-serif'}}>simple, purposeful, and elegant solutions.</span>
        </motion.h2>

        {/* Stats Marquee + Description - Inline Layout */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
          className="flex items-center gap-6 py-6 mb-16" 
          style={{marginBottom: '-10px'}}
        >
          {/* Stats Marquee with gradient fades */}
          <StatsMarquee />
          
          {/* Description - Right aligned */}
          <p className="shrink-0 text-sm text-[#4D4D4D] leading-relaxed text-right" style={{fontSize: '16px', fontWeight: '500', lineHeight: '22px', width: '380px'}}>
            Our studio is dedicated to crafting clean, purposeful solutions that cut through the noise.
          </p>
        </motion.div>

        {/* Video Block - Full Width */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={scaleIn}
          className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0A0A0A] cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave} style={{height: '800px'}}
        >
          {/* Static Image - always mounted, controlled by opacity */}
          <div
            className="absolute inset-0 z-10 transition-opacity duration-300"
            style={{ opacity: isPlaying ? 0 : 1, height: '800px' }}
          >
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-black/50 z-10" style={{height: '800px'}}></div>
            <img
              src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80"
              alt="Showreel"
              className="video-showreel-image w-full h-full object-cover grayscale contrast-110"
              style={{
                transform: `scale(${showHoverEffect ? 1.1 : 1})`,
                filter: `blur(${showHoverEffect ? '4px' : '0px'})`,
                transition: 'transform 700ms ease-out, filter 700ms ease-out', height: '800px'
              }}
            />
          </div>

          {/* Video Element - shown when playing */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover z-5 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
            playsInline
            onEnded={handleClose} style={{height: '800px'}}
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
                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 translate-y-8 mt-4 text-white text-xl font-medium z-20"
                style={{fontSize: '24px', fontWeight: '600'}}
              >
                Play Showreel
              </motion.span>
            )}
          </AnimatePresence>

          {/* Forma branding at bottom */}
          <div className="absolute bottom-4 left-0 right-0 text-center z-20">
            <span className="text-white/60 text-sm" style={{color: '#ffffff', fontSize: '16px', fontWeight: '500'}}>© 2025 Forma®</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function WorkSection() {
  return (
    <section id="work" className="py-24 bg-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12" style={{paddingRight: '0px', paddingLeft: '0px'}}>
        {/* Header with subtext and button */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="flex items-start justify-between mb-16"
        >
          <div>
            <h2 className="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.1] tracking-tight text-[#0A0A0A] mb-4" style={{fontSize: '64px', fontFamily: 'Inter, sans-serif'}}>Selected Work.</h2>
            <p className="text-[#4D4D4D] text-sm max-w-sm leading-relaxed" style={{fontSize: '16px', lineHeight: '22px', fontWeight: '500'}}>
              A curated selection of projects that reflect our commitment to simplicity and purposeful design.
            </p>
          </div>
          <a href="#" className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#EBEBEB] text-[#0A0A0A] rounded-full hover:bg-[#0A0A0A] hover:text-white transition-all overflow-hidden" style={{marginTop: '100px', fontWeight: '500'}}>
            <span className="overflow-hidden h-5">
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">View all projects</span>
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">View all projects</span>
            </span>
            <span className="overflow-hidden h-4 w-4 relative">
              <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-y-4" />
              <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out -translate-y-4 group-hover:translate-y-0" />
            </span>
          </a>
        </motion.div>

        {/* Project Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 gap-1"
        >
          {projects.map((project, index) => (
            <a
              key={index}
              href="#"
              className="group block rounded-2xl overflow-hidden transition-all duration-500 bg-[#EBEBEB] hover:bg-[#0A0A0A]"
            >
              {/* Image Container with zoom effect - border stays constant */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl m-1.5">
                <img
                  src={project.image}
                  alt={project.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              {/* Info Bar with text replacement scroll animation */}
              <div className="flex items-center justify-between p-4 pt-3">
                <div className="overflow-hidden">
                  {/* Project Name - stacked text */}
                  <div className="relative h-6 overflow-hidden">
                    <h3 className="text-base font-semibold text-[#0A0A0A] transition-transform duration-500 group-hover:-translate-y-full" style={{fontSize: '18px'}}>{project.name}</h3>
                    <h3 className="text-base font-semibold text-white absolute top-full left-0 transition-transform duration-500 group-hover:-translate-y-full" style={{fontSize: '18px'}}>{project.name}</h3>
                  </div>
                  {/* Category - stacked text */}
                  <div className="relative h-5 overflow-hidden">
                    <p className="text-sm text-[#4D4D4D] transition-transform duration-500 group-hover:-translate-y-full">{project.category}</p>
                    <p className="text-sm text-white/60 absolute top-full left-0 transition-transform duration-500 group-hover:-translate-y-full">{project.category}</p>
                  </div>
                </div>
                {/* Year - stacked text */}
                <div className="relative h-5 overflow-hidden">
                  <span className="text-sm text-[#0A0A0A]/40 block transition-transform duration-500 group-hover:-translate-y-full">{project.year}</span>
                  <span className="text-sm text-white/50 absolute top-full left-0 transition-transform duration-500 group-hover:-translate-y-full">{project.year}</span>
                </div>
              </div>
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function WhyUsSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12" style={{paddingRight: '0px', paddingLeft: '0px'}}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="Why us" number="03" />
        </motion.div>

        {/* Two-tone Headline - smaller size, font-weight 500 */}
        <motion.h2 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15] mb-16" style={{width: '1018px'}}
        >
          <span className="text-[#0A0A0A]" style={{fontSize: '54px', fontFamily: 'inter, sans-serif'}}>We cut through noise to create designs that are </span>
          <span className="text-[#757575]" style={{fontSize: '54px', fontFamily: 'inter, sans-serif'}}>thoughtful, timeless, and impactful.</span>
        </motion.h2>

        {/* 4-Column Bento Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1"
        >
          {/* Card 1 - #EBEBEB outer with 2 inner cards */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2 flex flex-col gap-2">
            {/* Top: Dark card with building image */}
            <div className="relative rounded-xl overflow-hidden bg-[#0A0A0A] min-h-[240px] flex flex-col justify-between" style={{height: '290px'}}>
              <img
                src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80"
                alt="Architecture"
                className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale"
              />
              <div className="relative z-10 p-5">
                <h3 className="text-lg font-semibold text-white leading-tight" style={{fontSize: '24px'}}>Purposeful Design<br />for Modern Brands.</h3>
                <p className="text-white/50 text-xs mt-2">© 2025</p>
              </div>
              <div className="relative z-10 p-5 pt-0">
                <a href="/waitlist" className="inline-flex items-center gap-2 px-4 py-2 bg-[#EBEBEB] text-[#0A0A0A] text-sm font-medium rounded-full transition-colors">
                  Get started
                  <Plus className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            {/* Bottom: Bullet list card */}
            <div className="bg-white rounded-xl p-4">
              <ul className="space-y-2">
                {["Collaborative Approach", "Quick turnaround", "Clear Communication", "Consistent Quality", "Reliable Support"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-[#0A0A0A]" style={{fontSize: '16px', fontWeight: '500', lineHeight: '22px'}}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Card 2 - #EBEBEB single card with background content */}
          <div className="bg-[#EBEBEB] rounded-2xl p-5 flex flex-col justify-between min-h-[400px]">
            {/* Top: Clients/avatars */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex -space-x-2">
                  {["photo-1494790108377-be9c29b29330", "photo-1507003211169-0a1dd7228f2d", "photo-1438761681033-6461ffad8d80", "photo-1472099645785-5658abf4ff4e"].map((id, i) => (
                    <img
                      key={i}
                      src={`https://images.unsplash.com/${id}?w=100&q=80`}
                      alt="Client"
                      className="w-9 h-9 rounded-full border-2 border-[#EBEBEB] object-cover"
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-[#0A0A0A]">4.9/5</span>
                  <svg className="w-3.5 h-3.5 text-[#0A0A0A] fill-current" viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm"><span className="font-semibold text-[#0A0A0A]">100+</span> <span className="text-[#757575]">Happy clients worldwide</span></p>
            </div>
            {/* Bottom: Testimonial */}
            <div>
              <div className="flex items-center gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3 h-3 text-[#0A0A0A] fill-current" viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-sm text-[#0A0A0A] leading-relaxed mb-4" style={{fontSize: '16px', lineHeight: '22px'}}>
                "Kanso understood our brand better than we did. Their ability to find the essential and express it simply is what sets them apart."
              </blockquote>
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80"
                  alt="Sofia Ford"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">Sofia Ford</p>
                  <p className="text-xs text-[#757575]">Founder</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3 - #EBEBEB outer with 3 white module cards */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2 flex flex-col gap-2">
            {[
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, title: "Streamlined Process", desc: "Our focused, step-by-step approach saves time and keeps projects moving smoothly." },
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>, title: "Scalable Design", desc: "We create systems that grow with your brand and stay effective over time." },
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, title: "24/7 Dedicated Support", desc: "We're always here when you need us, ready to answer questions, provide updates." },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-4 flex-1">
                <div className="text-[#0A0A0A] mb-3">{feature.icon}</div>
                <h4 className="font-semibold text-[#0A0A0A] text-sm mb-1.5" style={{fontSize: '18px', lineHeight: '22px'}}>{feature.title}</h4>
                <p className="text-xs text-[#757575] leading-relaxed" style={{fontSize: '16px', fontWeight: '500', lineHeight: '22px'}}>{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Column 4 - Tall dark card with silhouette */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0A0A0A] min-h-[500px] md:min-h-full flex flex-col justify-between">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80"
              alt="Silhouette"
              className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale"
            />
            <div className="relative z-10 p-6 text-right">
              <span className="text-white/80 text-sm font-medium" style={{fontSize: '18px', marginRight: '80px', textAlign: 'center'}}>Forma®</span>
            </div>
            <div className="relative z-10 p-6">
              <h3 className="text-2xl font-semibold text-white leading-tight">Design with intent.</h3>
              <p className="text-white/60 text-sm mt-1">No excess, no fluff.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ServicesSection() {
  const [expandedService, setExpandedService] = useState<number | null>(null);
  const [hoveredService, setHoveredService] = useState<number | null>(null);

  const toggleService = (index: number) => {
    setExpandedService(expandedService === index ? null : index);
  };

  return (
    <section id="services" className="py-24 bg-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12" style={{paddingRight: '0px', paddingLeft: '0px'}}>
        {/* Contained dark card */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={scaleIn}
          className="bg-[#0A0A0A] rounded-3xl px-8 py-12 lg:px-16 lg:py-16" style={{backgroundColor: '#121212'}}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-12" style={{marginBottom: '42px'}}>
            <span className="text-sm font-medium text-white/60 tracking-wide" style={{color: '#ffffff', fontSize: '16px'}}>/ Services</span>
            <span className="text-sm font-medium text-white/60">(04)</span>
          </div>

          {/* Service List - Accordion */}
          <div className="space-y-1 mb-12">
            {services.map((service, index) => {
              const isExpanded = expandedService === index;
              const isHovered = hoveredService === index;
              const showImage = isExpanded || isHovered;
              const showPlus = isExpanded || isHovered;
              
              return (
                <div key={index}>
                  {/* Service Row - Clickable */}
                  <div
                    className="group cursor-pointer py-4"
                    onClick={() => toggleService(index)}
                    onMouseEnter={() => setHoveredService(index)}
                    onMouseLeave={() => setHoveredService(null)}
                  >
                    <div className="flex items-center justify-between">
                      {/* Left side - Image + Title with slide animation */}
                      <div className="relative flex items-center">
                        {/* Image thumbnail - always present, revealed on hover/expand */}
                        <div className="absolute left-0 w-28 h-16 overflow-hidden rounded-xl">
                          <img
                            src={service.image}
                            alt={service.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {/* Title - slides right on hover/expand to reveal image */}
                        <span className={`bg-[#0A0A0A] rounded-xl px-4 py-2 text-[clamp(1.75rem,4vw,3.5rem)] font-semibold tracking-tight transition-all duration-700 ease-out ${
                          showImage 
                            ? "text-white translate-x-36" 
                            : "text-white/80 translate-x-0 group-hover:text-white"
                        }`} style={{backgroundColor: '#121212'}}>
                          {service.title}
                        </span>
                      </div>

                      {/* Right side - Number / Plus / X transitions */}
                      <div className="relative w-20 h-20 flex items-center justify-center overflow-hidden">
                        {/* Number - slides out to the LEFT on hover */}
                        <span 
                          className={`absolute text-[clamp(3rem,6vw,5rem)] font-semibold text-white/25 transition-all duration-700 ease-out ${
                            showPlus 
                              ? "-translate-x-24 opacity-0" 
                              : "translate-x-0 opacity-100"
                          }`}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          {service.number}
                        </span>
                        
                        {/* Plus - slides in from RIGHT, rotates to X on expand */}
                        <span 
                          className={`absolute text-[clamp(3rem,6vw,5rem)] font-light text-white/25 transition-all duration-700 ease-out ${
                            isExpanded
                              ? "translate-x-0 -rotate-[135deg]"  /* X shape (counter-clockwise from -90°) */
                              : isHovered
                                ? "translate-x-0 -rotate-90"  /* + rotated counter-clockwise */
                                : "translate-x-24 rotate-0 opacity-0"  /* Hidden to the right */
                          } ${
                            showPlus ? "opacity-100" : "opacity-0"
                          }`}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '110px' }}
                        >
                          +
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-out ${
                      isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="pb-6 pl-0 lg:pl-[calc(7rem+1.5rem)]">
                      {/* Description */}
                      <p className="text-white/60 text-base leading-relaxed max-w-xl mb-6">
                        {service.description}
                      </p>
                      
                      {/* Tags */}
                      <div className="flex flex-wrap gap-2">
                        {service.items.map((item, itemIndex) => (
                          <span
                            key={itemIndex}
                            className="px-4 py-2 border border-white/20 rounded-full text-sm text-white/80"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Button */}
          <a
            href="#pricing"
            className="group inline-flex items-center gap-2 px-6 py-3 bg-[#EBEBEB] text-[#0A0A0A] text-sm font-medium rounded-full transition-colors overflow-hidden"
          >
            <span className="overflow-hidden h-5">
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">See pricing</span>
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">See pricing</span>
            </span>
            <span className="overflow-hidden h-4 w-4 relative">
              <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-y-4" />
              <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out -translate-y-4 group-hover:translate-y-0" />
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12" style={{paddingRight: '0px', paddingLeft: '0px'}}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="Process" number="05" />
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left - Headline */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.1] mb-8" style={{fontSize: '54px', fontWeight: '500', fontFamily: 'Inter, sans-serif', color: '#0a0a0a', lineHeight: '59px'}}>
              Our process is simple, purposeful, and adaptable.
            </h2>
            <p className="text-[#4D4D4D] mb-8" style={{color: '#757575', fontWeight: '500'}}>
              We believe great design is a result of clarity, collaboration, and craft.
            </p>
            <a
              href="/waitlist"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-[#EBEBEB] text-[#0A0A0A] text-sm font-medium rounded-full hover:bg-[#0A0A0A] hover:text-white transition-colors overflow-hidden"
            >
              <span className="overflow-hidden h-5">
                <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Let's talk</span>
                <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Let's talk</span>
              </span>
              <span className="overflow-hidden h-4 w-4 relative">
                <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-y-4" />
                <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out -translate-y-4 group-hover:translate-y-0" />
              </span>
            </a>
          </motion.div>

          {/* Right - Steps in big card container */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2">
            <div className="flex flex-col">
              {processSteps.map((step, index) => (
                <div 
                  key={index} 
                  className={`bg-white rounded-xl p-6 ${index < processSteps.length - 1 ? 'mb-1' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-bold text-[#0A0A0A]" style={{fontSize: '24px'}}>{step.title}</h3>
                    <span className="text-sm text-[#0A0A0A]/30">{step.number}</span>
                  </div>
                  <p className="text-[#4D4D4D]" style={{color: '#757575', lineHeight: '22px'}}>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12" style={{paddingRight: '0px', paddingLeft: '0px'}}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="FAQs" number="08" />
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left - Headline */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.1] mb-8" style={{fontSize: '54px', fontWeight: '500', fontFamily: 'Inter, sans-serif', color: '#0a0a0a', lineHeight: '59px'}}>
              Wondering How We Work?
            </h2>
            <p className="text-[#4D4D4D] mb-8" style={{color: '#757575', fontWeight: '500'}}>
              Answers to common questions about our process, services, and how we work.
            </p>
            <a
              href="/waitlist"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-[#EBEBEB] text-[#0A0A0A] text-sm font-medium rounded-full hover:bg-[#0A0A0A] hover:text-white transition-colors overflow-hidden"
            >
              <span className="overflow-hidden h-5">
                <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Contact us</span>
                <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Contact us</span>
              </span>
              <span className="overflow-hidden h-4 w-4 relative">
                <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-y-4" />
                <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out -translate-y-4 group-hover:translate-y-0" />
              </span>
            </a>
          </motion.div>

          {/* Right - Accordion in #EBEBEB container */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2">
            <div className="flex flex-col">
              {faqs.map((faq, index) => (
                <div 
                  key={index} 
                  className={`bg-white rounded-xl ${index < faqs.length - 1 ? 'mb-1' : ''}`}
                >
                  <button
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className="font-medium text-[#0A0A0A]" style={{fontSize: '18px'}}>{index + 1}. {faq.question}</span>
                    <div className="w-6 h-6 rounded-full border border-[#0A0A0A]/20 flex items-center justify-center flex-shrink-0">
                      <Plus
                        className={`w-3 h-3 text-[#0A0A0A] transition-transform duration-700 ease-out ${
                          openIndex === index ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                  <div 
                    className={`overflow-hidden transition-all duration-300 ${
                      openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-5 pb-5">
                      <p className="text-[#757575]">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BlogSection() {
  return (
    <section id="blog" className="py-24 bg-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12" style={{paddingRight: '0px', paddingLeft: '0px'}}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="Blog" number="09" />
        </motion.div>

        {/* Header with title and button */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="flex items-start justify-between mb-16"
        >
          <div>
            <h2 className="text-3xl font-bold text-[#0A0A0A] mb-4" style={{fontSize: '54px', fontWeight: '500', fontFamily: 'Inter, sans-serif'}}>Latest insights from our blog.</h2>
            <p className="text-[#4D4D4D]" style={{fontWeight: '500', width: '330px'}}>Thoughts, ideas, and perspectives on design, simplicity, and creative process.</p>
          </div>
          <a href="#" className="group hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-[#EBEBEB] text-[#0A0A0A] text-sm rounded-full hover:bg-[#0A0A0A] hover:text-white transition-all overflow-hidden" style={{marginTop: '100px', fontWeight: '500'}}>
            <span className="overflow-hidden h-5">
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">View all articles</span>
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">View all articles</span>
            </span>
            <span className="overflow-hidden h-4 w-4 relative">
              <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-y-4" />
              <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out -translate-y-4 group-hover:translate-y-0" />
            </span>
          </a>
        </motion.div>

        {/* Blog Grid - Kanso style: Featured (50%) + Two cards side by side (25% each) */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-4 gap-1 items-start"
        >
          {/* Featured Post (First - Large with text overlay, spans 2 columns) */}
          <a
            href="#"
            className="group block rounded-2xl overflow-hidden bg-[#EBEBEB] hover:bg-[#0A0A0A] transition-colors duration-500 md:col-span-2 md:row-span-2"
          >
            <div className="relative h-full min-h-[500px] overflow-hidden rounded-xl m-1.5">
              <img
                src={blogPosts[0].image}
                alt={blogPosts[0].title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {/* Dark gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {/* Category badge */}
              <span className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-[#0A0A0A]">
                {blogPosts[0].category}
              </span>
              {/* Text overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span className="text-sm text-white/70">{blogPosts[0].date}</span>
                <h3 className="text-xl font-semibold text-white mt-2 mb-2">
                  {blogPosts[0].title}
                </h3>
                <p className="text-sm text-white/80 line-clamp-2">{blogPosts[0].excerpt}</p>
              </div>
            </div>
          </a>

          {/* Second and Third cards - each takes 1 column, side by side */}
          {blogPosts.slice(1, 3).map((post, index) => (
            <a
              key={index}
              href="#"
              className="group block"
            >
              {/* Card with image */}
              <div className="rounded-2xl overflow-hidden bg-[#EBEBEB] group-hover:bg-[#0A0A0A] transition-colors duration-500">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl m-1.5">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Category badge */}
                  <span className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-[#0A0A0A]">
                    {post.category}
                  </span>
                </div>
              </div>
              {/* Text below card */}
              <div className="pt-4 pb-2">
                <span className="text-sm text-[#757575]">{post.date}</span>
                <h3 className="text-lg font-semibold text-[#0A0A0A] mt-1 mb-1 group-hover:text-[#0A0A0A]/70 transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-[#757575] line-clamp-2">{post.excerpt}</p>
              </div>
            </a>
          ))}
        </motion.div>

        {/* Mobile view all link */}
        <a href="#" className="group md:hidden inline-flex items-center gap-2 px-5 py-2.5 bg-[#EBEBEB] text-[#0A0A0A] text-sm rounded-full hover:bg-[#0A0A0A] hover:text-white transition-all mt-8 overflow-hidden" style={{fontWeight: '500'}}>
          <span className="overflow-hidden h-5">
            <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">View all articles</span>
            <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">View all articles</span>
          </span>
          <span className="overflow-hidden h-4 w-4 relative">
            <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out group-hover:translate-y-4" />
            <Plus className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-out -translate-y-4 group-hover:translate-y-0" />
          </span>
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-24 bg-[#0A0A0A] text-white">
      <div className="max-w-[1520px] mx-auto px-6 lg:px-12">
        {/* Large Wordmark */}
        <motion.h2 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-[clamp(3rem,10vw,8rem)] font-bold tracking-tighter mb-16" style={{color: '#ebebeb'}}
        >
          Forma® Studio
        </motion.h2>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid lg:grid-cols-2 gap-16 mb-16"
        >
          {/* Left - Contact */}
          <div>
            <p className="text-white/60 mb-8 max-w-md">
              Whether you're building a brand, designing a product, or simply want to explore an idea, we'd love to hear from you.
            </p>
            <div className="space-y-2">
              <a href="mailto:hello@formastudio.ai" className="block text-white hover:text-white/70 transition-colors underline underline-offset-4">
                hello@formastudio.ai
              </a>
              <a href="tel:+1234567890" className="block text-white hover:text-white/70 transition-colors underline underline-offset-4">
                (123) 456-7890
              </a>
            </div>
          </div>

          {/* Right - Newsletter */}
          <div>
            <p className="text-white/60 mb-4">Sign up for our monthly newsletter.</p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="Email"
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
              />
              <button
                type="submit"
                className="group px-6 py-3 bg-white text-[#0A0A0A] font-medium rounded-full hover:bg-white/90 transition-colors overflow-hidden" style={{backgroundColor: '#ebebeb'}}
              >
                <span className="overflow-hidden h-5 block">
                  <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Sign up</span>
                  <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">Sign up</span>
                </span>
              </button>
            </form>
          </div>
        </motion.div>

        {/* Links Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeIn}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-white/10"
        >
          <div className="space-y-3">
            <a href="/" className="block text-white/60 hover:text-white transition-colors">Home</a>
            <a href="#about" className="block text-white/60 hover:text-white transition-colors">About</a>
            <a href="#work" className="block text-white/60 hover:text-white transition-colors">Projects</a>
            <a href="#blog" className="block text-white/60 hover:text-white transition-colors">Blog</a>
            <a href="/waitlist" className="block text-white/60 hover:text-white transition-colors">Contact</a>
          </div>
          <div className="space-y-3">
            <a href="#" className="block text-white/60 hover:text-white transition-colors">Terms & Conditions</a>
            <a href="#" className="block text-white/60 hover:text-white transition-colors">Privacy Policy</a>
          </div>
          <div className="space-y-3">
            <a href="#" className="block text-white/60 hover:text-white transition-colors">Twitter/X</a>
            <a href="#" className="block text-white/60 hover:text-white transition-colors">Instagram</a>
            <a href="#" className="block text-white/60 hover:text-white transition-colors">LinkedIn</a>
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

// ============ MAIN PAGE ============

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <HeroSection />
      <AboutSection />
      <WorkSection />
      <WhyUsSection />
      <ServicesSection />
      <ProcessSection />
      <FAQSection />
      <BlogSection />
      <Footer />
    </div>
  );
}
