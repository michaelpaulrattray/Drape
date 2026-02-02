import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowLeft, ChevronRight, Menu, X, Check, Camera, Palette, Sparkles, ArrowUpRight, Zap, Clock, Infinity } from "lucide-react";

// Sticky Scroll Process Section Data
const stickyProcessSteps = [
  {
    id: 1,
    number: "01",
    title: "Share Your Vision + Guidelines",
    description: "A simple brief or a 15-minute sync is all we need. We digest your brand guidelines, goals, and aesthetic preferences to build a custom model that understands your visual language.",
    cta: "Start a project",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/f36259a7-cc94-4846-8290-2df52026731d_original.gif",
  },
  {
    id: 2,
    number: "02",
    title: "(Intelligent) Model Generation",
    description: "We configure our AI models to your style. Instead of generic outputs, you get high-fidelity options tailored to your specific campaign needs in hours, not weeks.",
    cta: "See examples",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/ebfeb48e-4108-49c6-86a2-a1491f93b564_original.gif",
  },
  {
    id: 3,
    number: "03",
    title: "Launch & Automated Scaling",
    description: "Receive production-ready assets for every platform. We can even set up automated pipelines so your content scales effortlessly as your audience grows.",
    cta: "Scale now",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/1445aeb2-ddb4-4e4d-a151-c96381893f07_1600w.jpg",
  },
];

// Sticky Scroll Process Section Component - Dark Theme (Original Design)
function StickyScrollProcessSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const processSteps = document.querySelectorAll('.sticky-process-step');
    
    const observerOptions = {
      root: null,
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const step = entry.target.getAttribute('data-step');
          if (step) {
            setActiveStep(parseInt(step) - 1);
          }
        }
      });
    }, observerOptions);

    processSteps.forEach((step) => observer.observe(step));

    return () => {
      processSteps.forEach((step) => observer.unobserve(step));
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative bg-zinc-950 border-b border-zinc-900/50" id="sticky-process">
      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          
          {/* Left Column: Sticky Image Wrapper */}
          <div className="hidden lg:block relative h-full min-h-screen border-r border-zinc-900/50">
            <div className="sticky top-0 h-screen w-full flex items-center justify-center p-12 lg:p-16">
              <div className="relative w-full h-[85vh] max-h-[800px] flex items-start">
                
                {/* Dynamic Image Container */}
                <div className="relative w-3/4 h-full overflow-hidden">
                  {stickyProcessSteps.map((step, index) => (
                    <img
                      key={step.id}
                      src={step.image}
                      alt={`Process Step ${step.number}`}
                      className={`process-img w-full h-full object-cover grayscale opacity-90 transition-all duration-500 ease-in-out ${
                        index === activeStep 
                          ? 'active relative' 
                          : 'inactive'
                      }`}
                    />
                  ))}
                </div>

                {/* Large Sticky Number */}
                <div className="absolute -right-4 top-8 z-20">
                  <span className="font-instrument-serif text-7xl lg:text-8xl text-zinc-100/90 tracking-tight transition-all duration-500">
                    {stickyProcessSteps[activeStep]?.number || '01'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Scrolling Text */}
          <div className="md:px-12 md:py-32 flex flex-col lg:gap-64 pt-24 pr-6 pb-24 pl-6 relative gap-x-32 gap-y-32">
            
            {/* Mobile Header */}
            <div className="lg:hidden mb-8">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1 mb-6 tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-orange" />
                Process
              </div>
              <h2 className="text-4xl md:text-5xl font-instrument-serif text-white tracking-tight">How it works</h2>
            </div>

            {/* Steps */}
            {stickyProcessSteps.map((step) => (
              <div
                key={step.id}
                className="sticky-process-step group flex flex-col justify-center min-h-[40vh]"
                data-step={step.id}
              >
                <span className="lg:hidden text-6xl font-instrument-serif text-zinc-700 mb-6 block">
                  {step.number}
                </span>
                <h3 className="text-4xl md:text-5xl lg:text-6xl font-instrument-serif text-zinc-100 tracking-tight mb-8 group-hover:text-white transition-colors">
                  {step.title}
                </h3>
                <p className="text-lg md:text-xl text-zinc-400 font-light leading-relaxed max-w-lg mb-10">
                  {step.description}
                </p>
                <a
                  href="#contact"
                  className="text-sm uppercase tracking-widest font-medium text-white border-b border-zinc-600 pb-1 w-fit hover:border-white hover:text-orange transition-all"
                >
                  {step.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Draggable Cards Data
const draggableCards = [
  {
    id: 1,
    number: "01",
    title: "Ad Creatives",
    description: "Platform-perfect ads that match your brand identity and boost performance metrics without the manual grind.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
  },
  {
    id: 2,
    number: "02",
    title: "Product Visuals",
    description: "Generate unlimited angles, lighting scenarios, and environments for your products without a single reshoot.",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop",
  },
  {
    id: 3,
    number: "03",
    title: "Social Content",
    description: "Never run dry on content. Deploy daily on-brand social posts that engage your audience and grow your reach.",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&auto=format&fit=crop",
  },
  {
    id: 4,
    number: "04",
    title: "Campaign Shots",
    description: "Full photoshoots in any environment—studio, outdoor, lifestyle. Export high-resolution assets ready for print.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop",
  },
];

// Draggable Cards Section Component
function DraggableCardsSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.touches[0].pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    const x = e.touches[0].pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <section className="overflow-hidden z-10 bg-zinc-50 border-b border-black/10 pt-20 pb-20 md:pt-28 md:pb-28 relative">
      {/* Header */}
      <div className="px-6 md:px-12 mb-12 md:mb-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-[0.2em] mb-3 text-orange">
              Our Capabilities
            </p>
            <h2 className="text-3xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight font-geist text-zinc-900">
              What We Create
            </h2>
          </div>
          <p className="text-sm md:text-base text-zinc-500 max-w-md leading-relaxed">
            From AI model casting to campaign-ready photoshoots, we handle the entire creative production pipeline.
          </p>
        </div>
      </div>

      {/* Draggable Container */}
      <div
        ref={containerRef}
        className={`flex w-full overflow-x-auto no-scrollbar select-none touch-pan-y ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          maskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)",
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleMouseUp}
        onTouchMove={handleTouchMove}
      >
        <div
          ref={trackRef}
          className="flex gap-4 md:gap-6 min-w-max px-6 md:px-12 items-stretch"
        >
          {/* Duplicate cards for infinite scroll effect */}
          {[...draggableCards, ...draggableCards].map((card, index) => (
            <div
              key={`${card.id}-${index}`}
              className="group relative w-[75vw] md:w-[380px] h-[420px] md:h-[480px] overflow-hidden border border-black/10 bg-white hover:border-orange/50 transition-all duration-500 shrink-0 hover:shadow-xl"
            >
              {/* Background Image */}
              <div className="absolute inset-0 w-full h-full">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out"
                  draggable="false"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/60 to-transparent" />
              </div>

              {/* Content */}
              <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase font-semibold tracking-[0.15em] px-2 py-1 bg-orange text-white">
                    {card.number}
                  </span>
                  <div className="w-9 h-9 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-white text-zinc-900 group-hover:translate-x-0 translate-x-2">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-geist tracking-tight text-white mb-2 group-hover:text-orange transition-colors duration-300">
                    {card.title}
                  </h3>
                  <p className="text-zinc-300 text-sm leading-relaxed max-w-[95%] opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                    {card.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Waitlist() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    interest: "All Studios",
    company: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);


  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;
    joinWaitlist.mutate(formData);
  };

  // Hero gallery auto-advance
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic Time/Location for footer
  useEffect(() => {
    const timeElement = document.getElementById('dynamic-time');
    const locationElement = document.getElementById('dynamic-location');
    
    const updateClock = () => {
      if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      }
    };
    
    const updateLocation = () => {
      if (locationElement) {
        try {
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const locationName = timeZone ? timeZone.split('/').pop()?.replace(/_/g, ' ') || 'Global' : 'Global';
          locationElement.textContent = locationName;
        } catch {
          locationElement.textContent = 'Earth';
        }
      }
    };
    
    updateClock();
    updateLocation();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Hero slides data
  const heroSlides = [
    {
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop",
      tag: "Portraiture",
      title: "Digital Casting",
      subtitle: "Generate unique AI model identities",
    },
    {
      image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop",
      tag: "Fashion",
      title: "Virtual Styling",
      subtitle: "Outfit any model instantly",
    },
    {
      image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&auto=format&fit=crop",
      tag: "Campaigns",
      title: "Photo Studio",
      subtitle: "Full photoshoots on demand",
    },
  ];



  return (
    <div className="min-h-screen relative bg-zinc-100">
      {/* Subtle Noise Texture */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay z-0" />

      {/* Animated Neon Grid Lines */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="neonGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "rgba(249, 115, 22, 0)", stopOpacity: 0 }} />
              <stop offset="50%" style={{ stopColor: "rgba(249, 115, 22, 0.5)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgba(249, 115, 22, 0)", stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id="neonGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: "rgba(249, 115, 22, 0)", stopOpacity: 0 }} />
              <stop offset="50%" style={{ stopColor: "rgba(249, 115, 22, 0.5)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgba(249, 115, 22, 0)", stopOpacity: 0 }} />
            </linearGradient>
            <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line x1="-200" y1="25%" x2="0" y2="25%" stroke="url(#neonGradient1)" strokeWidth="1" filter="url(#neonGlow)">
            <animate attributeName="x1" values="-200;100%" dur="15s" repeatCount="indefinite" />
            <animate attributeName="x2" values="0;120%" dur="15s" repeatCount="indefinite" />
          </line>
          <line x1="75%" y1="-200" x2="75%" y2="0" stroke="url(#neonGradient2)" strokeWidth="1" filter="url(#neonGlow)">
            <animate attributeName="y1" values="-200;100%" dur="12s" repeatCount="indefinite" />
            <animate attributeName="y2" values="0;120%" dur="12s" repeatCount="indefinite" />
          </line>
        </svg>
      </div>

      {/* Navigation - Inline Style */}
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-5 md:px-12 md:py-6 flex justify-between items-center mix-blend-difference text-white pointer-events-none">
        <Link href="/" className="group flex items-center gap-2 text-xl md:text-2xl tracking-tight font-normal pointer-events-auto">
          <span className="w-6 h-6 rounded flex items-center justify-center text-sm bg-white text-black">F</span>
          <span className="font-geist font-bold">FORMA</span>
        </Link>

        {/* Desktop Menu - Inline Links */}
        <div className="hidden md:flex items-center gap-8 lg:gap-10 pointer-events-auto">
          <a href="#studios" className="text-xs font-medium uppercase tracking-widest hover:text-zinc-300 transition-colors">Studios</a>
          <a href="#process" className="text-xs font-medium uppercase tracking-widest hover:text-zinc-300 transition-colors">Process</a>
          <a href="#benefits" className="text-xs font-medium uppercase tracking-widest hover:text-zinc-300 transition-colors">Benefits</a>
          <a href="#contact" className="px-5 py-2 rounded-full border border-white/30 hover:bg-white hover:text-black transition-all duration-300 text-xs font-medium uppercase tracking-widest backdrop-blur-sm">Get Early Access</a>
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 pointer-events-auto"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-zinc-50/95 backdrop-blur-xl pt-24 px-6">
          <div className="flex flex-col gap-0 max-w-md mx-auto">
            <a href="#studios" onClick={() => setMobileMenuOpen(false)} className="block px-6 py-4 text-lg font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-orange">Studios</a>
            <a href="#process" onClick={() => setMobileMenuOpen(false)} className="block px-6 py-4 text-lg font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-orange">Process</a>
            <a href="#benefits" onClick={() => setMobileMenuOpen(false)} className="block px-6 py-4 text-lg font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-orange">Benefits</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block px-6 py-4 text-lg font-medium transition-colors tracking-wide text-black/70 hover:bg-black/5 hover:text-orange">Contact</a>
            <Link href="/login" className="mt-6 px-6 py-3 text-center font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-colors">Sign In</Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="z-10 relative">
        {/* Hero Section - Split Layout */}
        <section className="min-h-screen relative overflow-hidden pt-24 pb-16 px-6 md:px-12 bg-zinc-100">
          {/* Background Elements */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-gradient-to-b from-white/60 to-transparent opacity-50 blur-3xl pointer-events-none rounded-full translate-x-1/3 -translate-y-1/3" />
          </div>

          <div className="max-w-[90rem] mx-auto relative z-10">
            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-16 gap-y-12 items-start pt-8 md:pt-12">
              {/* Left Content - 7 columns */}
              <div className="lg:col-span-7 flex flex-col gap-8">
                {/* Tagline */}
                <div className="flex items-center gap-4 animate-fade-in-up">
                  <div className="h-px w-12 bg-zinc-400" />
                  <span className="uppercase text-xs md:text-sm font-medium text-zinc-500 tracking-widest">
                    AI-First Creative Studio
                  </span>
                </div>

                {/* Main Headline */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl xl:text-9xl leading-[0.85] uppercase font-medium text-zinc-900 tracking-tight font-geist animate-fade-in-up animation-delay-100">
                  Stop Paying
                  <br />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-zinc-500 to-zinc-900">
                    $10,000 Per
                  </span>
                  <br />
                  Photoshoot
                </h1>
              </div>

              {/* Right Visual - 5 columns */}
              <div className="lg:col-span-5 group h-full relative animate-fade-in-up animation-delay-200">
                {/* Tilted Background Shape */}
                <div className="absolute inset-0 bg-zinc-900 rounded-2xl rotate-3 opacity-10 group-hover:rotate-6 transition-transform duration-500" />
                
                {/* Main Image */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[400px] lg:h-[500px] xl:h-[550px] w-full">
                  <img 
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop" 
                    alt="AI Fashion Model" 
                    className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/40 to-transparent" />
                  
                  {/* Overlay Card */}
                  <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[0.65rem] uppercase tracking-widest font-space">
                        Model Generation
                      </span>
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    </div>
                    <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white w-2/3 animate-[pulse_2s_infinite]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row - Subtitle + Stats */}
            <div className="flex flex-col lg:flex-row mt-8 lg:mt-12 gap-12 items-start animate-fade-in-up animation-delay-300">
              {/* Left: Subtitle + CTA */}
              <div className="max-w-2xl">
                <h2 className="text-xl md:text-2xl leading-tight font-medium text-zinc-800 tracking-tight font-space mb-6">
                  Generate AI models, style outfits, and create campaign-ready photoshoots in minutes—all without a single real photoshoot.
                </h2>

                <div className="flex flex-wrap gap-4">
                  <a 
                    href="#contact" 
                    className="group relative px-8 py-4 bg-zinc-900 text-white rounded-lg overflow-hidden transition-all hover:shadow-xl hover:shadow-zinc-500/20"
                  >
                    <span className="relative z-10 flex items-center gap-2 uppercase text-sm font-semibold tracking-widest">
                      Get Early Access
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </a>
                  <a 
                    href="#studios" 
                    className="px-8 py-4 border-2 border-zinc-200 text-zinc-700 font-semibold rounded-lg hover:border-zinc-900 hover:bg-zinc-900 hover:text-white transition-all duration-300 flex items-center gap-2 text-sm uppercase tracking-widest"
                  >
                    View Studios
                  </a>
                </div>
              </div>

              {/* Right: Stats Panel */}
              <div className="w-full lg:w-5/12 ml-auto overflow-hidden bg-zinc-950 border-zinc-200 border rounded-2xl p-6 relative shadow-sm">
                {/* Decorative Icon */}
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-24 h-24 text-orange" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Stat 1 */}
                  <div className="bg-zinc-50 border-zinc-100 border rounded-xl p-4">
                    <div className="uppercase text-xs text-zinc-400 font-space mb-1">
                      Cost Savings
                    </div>
                    <div className="text-3xl font-medium text-zinc-900 font-geist">
                      90%
                    </div>
                    <div className="text-[0.6rem] text-green-600 mt-2 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" />
                      vs Traditional
                    </div>
                  </div>
                  
                  {/* Stat 2 */}
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="text-xs font-space uppercase text-zinc-400 mb-1">
                      Generation Time
                    </div>
                    <div className="text-3xl font-geist font-medium text-zinc-900">
                      &lt;5min
                    </div>
                    <div className="text-[0.6rem] text-green-600 mt-2 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      Per Asset
                    </div>
                  </div>
                  
                  {/* System Status */}
                  <div className="col-span-2 text-white bg-zinc-900 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="uppercase text-xs text-orange tracking-widest font-space">
                        Studio Status
                      </span>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    <div className="space-y-2 font-space text-[0.65rem] text-zinc-400">
                      <div className="flex justify-between">
                        <span>&gt; Casting Studio</span>
                        <span className="text-white">Active</span>
                      </div>
                      <div className="flex justify-between">
                        <span>&gt; Outfit Studio</span>
                        <span className="text-white">Active</span>
                      </div>
                      <div className="flex justify-between">
                        <span>&gt; Photo Studio</span>
                        <span className="text-emerald-400">Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-400">
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-zinc-400 to-transparent animate-pulse" />
          </div>
        </section>

        {/* Draggable Cards Section */}
        <DraggableCardsSection />

        {/* Sticky Scroll Process Section */}
        <StickyScrollProcessSection />





        {/* From Idea to Launch Section */}
        <section className="py-16 md:py-24 border-b border-black/10 bg-white">
          {/* Section Header */}
          <div className="px-6 md:px-12 mb-12 md:mb-16">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 items-start lg:items-end justify-between">
              <div>
                <p className="text-[10px] uppercase flex items-center gap-3 font-bold text-orange tracking-[0.2em] mb-4">
                  <span className="w-2 h-2 rounded-full bg-orange" />
                  How It Works
                </p>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tighter text-zinc-900 font-geist leading-[0.95]">
                  From Idea to Launch
                  <span className="text-black/30"> in 3 Steps</span>
                </h2>
              </div>
              <p className="text-sm md:text-base text-zinc-500 max-w-sm lg:text-right">
                No complicated process. Just tell us what you need and we handle the rest.
              </p>
            </div>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-black/10 border-t border-black/10">
            {/* Step 1 */}
            <div className="group p-6 md:p-8 lg:p-10 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange/10 text-orange font-bold text-sm">
                  01
                </span>
                <div className="h-px flex-1 bg-black/10" />
              </div>
              <div className="aspect-[4/3] mb-6 rounded-xl overflow-hidden border border-black/10 bg-zinc-100">
                <img 
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop" 
                  alt="Share Your Vision" 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900 mb-3 group-hover:text-orange transition-colors">
                Share Your Vision
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Quick call or message to understand your goals, brand style, and timeline.
              </p>
            </div>

            {/* Step 2 */}
            <div className="group p-6 md:p-8 lg:p-10 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange/10 text-orange font-bold text-sm">
                  02
                </span>
                <div className="h-px flex-1 bg-black/10" />
              </div>
              <div className="aspect-[4/3] mb-6 rounded-xl overflow-hidden border border-black/10 bg-zinc-100">
                <img 
                  src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop" 
                  alt="We Build with AI" 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900 mb-3 group-hover:text-orange transition-colors">
                We Build with AI
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Using the latest AI tools, we design visuals and build automations tailored to you.
              </p>
            </div>

            {/* Step 3 */}
            <div className="group p-6 md:p-8 lg:p-10 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange/10 text-orange font-bold text-sm">
                  03
                </span>
                <div className="h-px flex-1 bg-black/10" />
              </div>
              <div className="aspect-[4/3] mb-6 rounded-xl overflow-hidden border border-black/10 bg-zinc-100">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop" 
                  alt="Launch & Grow" 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900 mb-3 group-hover:text-orange transition-colors">
                Launch &amp; Grow
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Get your assets, launch your campaign, and watch the results come in.
              </p>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="border-b border-black/10">
          <div className="px-6 md:px-12 py-16 flex flex-col md:flex-row items-end justify-between border-b border-black/10">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase text-zinc-900 font-geist">
              Benefits
            </h2>
            <a href="#contact" className="mt-4 md:mt-0 px-6 py-3 border text-sm font-medium transition-colors flex items-center gap-2 mb-2 border-black/20 hover:bg-black hover:text-white">
              Join Waitlist
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black/10">
            {/* Benefit 1 */}
            <div className="group transition-colors cursor-pointer hover:bg-black/5 p-8">
              <div className="flex h-32 border-b mb-6 items-center justify-center border-black/10">
                <span className="text-6xl font-bold tracking-tighter group-hover:scale-110 transition-transform duration-300 text-zinc-800 font-geist">90%</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight group-hover:text-orange transition-colors">Cost Savings</h3>
              <p className="text-sm leading-relaxed text-zinc-500">
                Eliminate expensive photoshoots, model fees, and studio rentals.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="group transition-colors cursor-pointer hover:bg-black/5 p-8">
              <div className="flex h-32 border-b mb-6 items-center justify-center border-black/10">
                <span className="text-6xl font-bold tracking-tighter group-hover:scale-110 transition-transform duration-300 text-zinc-800 font-geist">&lt;5m</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight group-hover:text-orange transition-colors">Generation Time</h3>
              <p className="text-sm leading-relaxed text-zinc-500">
                From concept to campaign-ready assets in under 5 minutes.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="group transition-colors cursor-pointer hover:bg-black/5 p-8">
              <div className="flex h-32 border-b mb-6 items-center justify-center border-black/10">
                <span className="text-6xl font-bold tracking-tighter group-hover:scale-110 transition-transform duration-300 text-zinc-800 font-geist">∞</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight group-hover:text-orange transition-colors">Unlimited Variations</h3>
              <p className="text-sm leading-relaxed text-zinc-500">
                Generate endless variations without additional cost or time.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="group transition-colors cursor-pointer hover:bg-black/5 p-8">
              <div className="flex h-32 border-b mb-6 items-center justify-center border-black/10">
                <span className="text-6xl font-bold tracking-tighter group-hover:scale-110 transition-transform duration-300 text-zinc-800 font-geist">24/7</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight group-hover:text-orange transition-colors">Always Available</h3>
              <p className="text-sm leading-relaxed text-zinc-500">
                Create content anytime, anywhere. No scheduling required.
              </p>
            </div>
          </div>
        </section>

        {/* Contact / CTA Section */}
        <section id="contact" className="grid grid-cols-1 lg:grid-cols-2 border-b border-black/10">
          {/* Left: Form */}
          <div className="p-8 md:p-16 flex flex-col justify-center border-black/10 lg:border-r">
            <p className="text-[10px] uppercase flex items-center gap-3 font-bold text-orange tracking-[0.2em] mb-6">
              <span className="w-2 h-2 rounded-full bg-orange" />
              Get Early Access
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4 font-geist">
              Join the Waitlist
            </h2>
            <p className="text-sm text-zinc-500 mb-8 max-w-md leading-relaxed">
              Be among the first to experience the future of AI-powered fashion photography. Early access members get exclusive benefits.
            </p>

            {submitted ? (
              <div className="p-6 border border-green-200 bg-green-50 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-green-800">You're on the list!</span>
                </div>
                <p className="text-sm text-green-700">
                  We'll notify you when FormaStudio launches. Check your email for confirmation.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="px-4 py-3 border border-black/10 bg-white focus:border-orange focus:outline-none transition-colors text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email Address *"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="px-4 py-3 border border-black/10 bg-white focus:border-orange focus:outline-none transition-colors text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Company (Optional)"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-3 border border-black/10 bg-white focus:border-orange focus:outline-none transition-colors text-sm"
                />
                <select
                  value={formData.interest}
                  onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                  className="w-full px-4 py-3 border border-black/10 bg-white focus:border-orange focus:outline-none transition-colors text-sm"
                >
                  <option value="All Studios">Interested in All Studios</option>
                  <option value="Casting Studio">Casting Studio</option>
                  <option value="Outfit Studio">Outfit Studio</option>
                  <option value="Photo Studio">Photo Studio</option>
                </select>
                <button
                  type="submit"
                  disabled={joinWaitlist.isPending}
                  className="w-full py-4 bg-zinc-900 text-white font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {joinWaitlist.isPending ? "Joining..." : "Join Waitlist"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>

          {/* Right: Visual */}
          <div className="relative min-h-[400px] lg:min-h-full overflow-hidden group">
            <img 
              src="https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop" 
              alt="Fashion Model" 
              className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 to-transparent" />
            
            {/* Floating Stats */}
            <div className="absolute bottom-8 left-8 right-8 grid grid-cols-3 gap-4">
              <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-center">
                <span className="block text-2xl font-bold text-white">847+</span>
                <span className="text-[0.65rem] uppercase tracking-wider text-white/70">On Waitlist</span>
              </div>
              <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-center">
                <span className="block text-2xl font-bold text-white">Q1</span>
                <span className="text-[0.65rem] uppercase tracking-wider text-white/70">2026 Launch</span>
              </div>
              <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-center">
                <span className="block text-2xl font-bold text-white">50%</span>
                <span className="text-[0.65rem] uppercase tracking-wider text-white/70">Early Discount</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 md:px-12 py-12 md:py-16 bg-zinc-50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 pb-12 border-b border-black/10">
            <div>
              <Link href="/" className="flex items-center gap-2 text-2xl tracking-tight font-normal mb-4">
                <span className="w-7 h-7 rounded flex items-center justify-center text-sm bg-zinc-900 text-white">F</span>
                <span className="font-geist font-bold text-zinc-900">FORMA</span>
              </Link>
              <p className="text-sm text-zinc-500 max-w-xs">
                AI-powered creative studio for fashion and lifestyle brands.
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 md:gap-16">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Studios</h4>
                <ul className="space-y-2">
                  <li><a href="#studios" className="text-sm text-zinc-600 hover:text-orange transition-colors">Casting Studio</a></li>
                  <li><a href="#studios" className="text-sm text-zinc-600 hover:text-orange transition-colors">Outfit Studio</a></li>
                  <li><a href="#studios" className="text-sm text-zinc-600 hover:text-orange transition-colors">Photo Studio</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-sm text-zinc-600 hover:text-orange transition-colors">About</a></li>
                  <li><a href="#contact" className="text-sm text-zinc-600 hover:text-orange transition-colors">Contact</a></li>
                  <li><Link href="/login" className="text-sm text-zinc-600 hover:text-orange transition-colors">Sign In</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-zinc-400">
              © 2026 FormaStudio. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span id="dynamic-location">Global</span>
              <span>·</span>
              <span id="dynamic-time">00:00</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
