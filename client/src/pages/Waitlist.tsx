import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowLeft, ChevronRight, Menu, X, Check, Camera, Palette, Sparkles, ArrowUpRight } from "lucide-react";

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
  const [galleryIndex, setGalleryIndex] = useState(0);

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

  // Gallery projects data
  const galleryProjects = [
    {
      title: "Series",
      subtitle: "AI Model Casting",
      description: "Create unique, consistent AI model identities for your brand. Define characteristics, ethnicity, and aesthetic to generate photorealistic models.",
      img1: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop",
      img2: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop",
    },
    {
      title: "Fashion",
      subtitle: "Virtual Outfit Studio",
      description: "Dress your AI models in any outfit. Upload product images or describe the look you want for e-commerce and lookbooks.",
      img1: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
      img2: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop",
    },
    {
      title: "Campaign",
      subtitle: "Photo Generation",
      description: "Create full photoshoots in any environment—studio, outdoor, lifestyle. Export high-resolution assets ready for print and web.",
      img1: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&auto=format&fit=crop",
      img2: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&auto=format&fit=crop",
    },
  ];

  const currentProject = galleryProjects[galleryIndex];

  return (
    <div className="min-h-screen overflow-x-hidden relative text-zinc-900 bg-zinc-50 selection:bg-orange/20 selection:text-zinc-900">
      {/* Background Grid Lines with Animated Neon */}
      <div className="fixed inset-0 grid-lines pointer-events-none z-0 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
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
        {/* Hero Section - Centered Impact Layout */}
        <section className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden pt-24 pb-20 px-6 md:px-12">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1920&auto=format&fit=crop" 
              alt="Hero Background" 
              className="w-full h-full object-cover opacity-20 grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-zinc-50/90 to-zinc-50" />
          </div>

          {/* Main Hero Content */}
          <div className="relative z-10 text-center max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange/30 bg-orange/5 mb-8">
              <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
              <span className="text-xs font-medium uppercase tracking-widest text-orange">AI Creative Studio</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] mb-6 font-geist text-zinc-900">
              Stop Paying $10,000
              <br />
              <span className="text-zinc-400">Per Photoshoot</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-zinc-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Generate AI models, style outfits, and create campaign-ready photoshoots in minutes—all without a single real photoshoot.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <a 
                href="#contact" 
                className="group px-8 py-4 bg-orange text-white font-semibold rounded-full hover:bg-orange/90 transition-all duration-300 flex items-center gap-3 text-base shadow-lg shadow-orange/25 hover:shadow-xl hover:shadow-orange/30 hover:-translate-y-0.5"
              >
                Get Early Access
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a 
                href="#studios" 
                className="px-8 py-4 border-2 border-zinc-200 text-zinc-700 font-semibold rounded-full hover:border-zinc-900 hover:bg-zinc-900 hover:text-white transition-all duration-300 flex items-center gap-3 text-base"
              >
                View Studios
              </a>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              <div className="text-center">
                <span className="block text-4xl md:text-5xl font-bold tracking-tighter text-zinc-900 font-geist">90%</span>
                <span className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Cost Savings</span>
              </div>
              <div className="w-px h-12 bg-zinc-200 hidden md:block" />
              <div className="text-center">
                <span className="block text-4xl md:text-5xl font-bold tracking-tighter text-zinc-900 font-geist">&lt;5min</span>
                <span className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Generation Time</span>
              </div>
              <div className="w-px h-12 bg-zinc-200 hidden md:block" />
              <div className="text-center">
                <span className="block text-4xl md:text-5xl font-bold tracking-tighter text-zinc-900 font-geist">∞</span>
                <span className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Variations</span>
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

        {/* Exploration Section - Gallery */}
        <section id="studios" className="grid grid-cols-1 md:grid-cols-2 border-b border-black/10">
          {/* Left: Gallery */}
          <div className="md:p-12 overflow-hidden group border-black/10 md:border-r pt-6 pr-6 pb-6 pl-6 relative">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="bg-zinc-200 w-full h-64 md:h-80 relative overflow-hidden">
                <img 
                  src={currentProject.img1} 
                  alt="Gallery 1" 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                />
              </div>
              <div className="bg-zinc-200 w-full h-64 md:h-80 relative overflow-hidden mt-8">
                <img 
                  src={currentProject.img2} 
                  alt="Gallery 2" 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                />
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="md:p-12 flex flex-col pt-6 pr-6 pb-6 pl-6 relative justify-center">
            <div className="flex items-center justify-between mb-8">
              <p className="text-[10px] uppercase font-bold text-orange tracking-[0.2em]">
                {currentProject.title}
              </p>
              <div className="flex items-center gap-2 text-xs font-space text-zinc-400">
                <span>{String(galleryIndex + 1).padStart(2, '0')}</span>
                <span>/</span>
                <span>{String(galleryProjects.length).padStart(2, '0')}</span>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4 font-geist">
              {currentProject.subtitle}
            </h2>
            <p className="leading-relaxed text-sm text-zinc-500 max-w-md mb-8">
              {currentProject.description}
            </p>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setGalleryIndex((prev) => (prev - 1 + galleryProjects.length) % galleryProjects.length)}
                className="w-12 h-12 rounded-full border flex items-center justify-center transition-all border-black/10 hover:border-orange hover:bg-orange/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setGalleryIndex((prev) => (prev + 1) % galleryProjects.length)}
                className="w-12 h-12 rounded-full border flex items-center justify-center transition-all border-black/10 hover:border-orange hover:bg-orange/10"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <a href="#contact" className="ml-auto px-6 py-3 border text-sm font-medium transition-colors flex items-center gap-2 border-black/20 hover:bg-black hover:text-white">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Process / Methodology Section */}
        <section id="process" className="grid grid-cols-1 lg:grid-cols-2 border-b relative group border-black/10 bg-zinc-50">
          {/* Left: Visual Content */}
          <div className="relative min-h-[500px] lg:min-h-[700px] lg:border-r overflow-hidden border-black/10">
            <img 
              src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&auto=format&fit=crop" 
              alt="Camera Lens" 
              className="absolute inset-0 w-full h-full object-cover grayscale opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t to-transparent from-zinc-50 via-zinc-50/20" />

            {/* Floating Data Card */}
            <div className="absolute bottom-8 left-8 right-8 md:left-12 md:right-auto md:w-80 backdrop-blur-xl border p-6 z-10 transition-colors duration-300 bg-white/80 border-black/10 hover:bg-white">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-black/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange">AI Powered</span>
                <Sparkles className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider font-semibold text-black/50">Engine: Nano Banana Pro</p>
                <p className="text-lg font-medium tracking-tight">Photorealistic Generation</p>
              </div>
            </div>
          </div>

          {/* Right: Philosophy & Interactive List */}
          <div className="flex flex-col">
            {/* Header */}
            <div className="p-8 md:p-16 flex-1 flex flex-col justify-center relative">
              <p className="text-[10px] uppercase flex items-center gap-3 font-bold text-orange tracking-[0.2em] mb-6">
                <span className="w-2 h-2 rounded-full bg-orange" />
                Process
              </p>
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none mb-6 text-zinc-900 font-geist">
                Cast, Style &amp;
                <span className="text-black/30"> Generate</span>
              </h2>
              <p className="leading-relaxed md:text-base text-sm text-zinc-500 max-w-md">
                FormaStudio streamlines your creative workflow. From AI model casting to final campaign assets, we handle the entire production pipeline.
              </p>
            </div>

            {/* Accordion / List Items */}
            <div className="border-t divide-y border-black/10 divide-black/10 bg-white">
              {/* Item 1 */}
              <a href="#contact" className="group block md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5 pt-6 pr-6 pb-6 pl-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-space text-xs transition-colors text-orange/50 group-hover:text-orange">01</span>
                    <div className="flex flex-col">
                      <h3 className="group-hover:text-black transition-colors text-lg font-medium text-black/80 tracking-tight">Casting Studio</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform translate-y-2 group-hover:translate-y-0 text-black/40">Define model characteristics and generate unique identities</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-black/10 group-hover:border-orange/50 group-hover:bg-orange/10">
                    <ArrowUpRight className="w-4 h-4 text-black/50 group-hover:text-orange" />
                  </div>
                </div>
              </a>

              {/* Item 2 */}
              <a href="#contact" className="group block p-6 md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-space text-xs transition-colors text-orange/50 group-hover:text-orange">02</span>
                    <div className="flex flex-col">
                      <h3 className="group-hover:text-black transition-colors text-lg font-medium text-black/80 tracking-tight">Outfit Studio</h3>
                      <span className="group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform group-hover:translate-y-0 text-xs text-black/40 opacity-0 h-0 mt-1 translate-y-2">Virtual wardrobe styling and product placement</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-black/10 group-hover:border-orange/50 group-hover:bg-orange/10">
                    <ArrowUpRight className="w-4 h-4 text-black/50 group-hover:text-orange" />
                  </div>
                </div>
              </a>

              {/* Item 3 */}
              <a href="#contact" className="group block p-6 md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-space text-xs transition-colors text-orange/50 group-hover:text-orange">03</span>
                    <div className="flex flex-col">
                      <h3 className="text-lg font-medium tracking-tight group-hover:text-black transition-colors text-black/80">Photo Studio</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform translate-y-2 group-hover:translate-y-0 text-black/40">Generate campaign-ready photoshoots in any environment</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-black/10 group-hover:border-orange/50 group-hover:bg-orange/10">
                    <ArrowUpRight className="w-4 h-4 text-black/50 group-hover:text-orange" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        </section>

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
              <p className="text-[10px] font-bold uppercase mb-2 text-orange">
                Cost Reduction
              </p>
              <h3 className="leading-tight transition-colors text-xl font-semibold mb-4 text-zinc-900">
                Save vs Traditional Shoots
              </h3>
              <p className="text-sm text-zinc-500">
                Eliminate agency fees, model costs, location rentals, and post-production expenses.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="group transition-colors cursor-pointer hover:bg-black/5 p-8">
              <div className="h-32 flex items-center justify-center border-b mb-6 border-black/10">
                <span className="text-6xl font-bold tracking-tighter group-hover:scale-110 transition-transform duration-300 text-zinc-800 font-geist">10x</span>
              </div>
              <p className="text-[10px] font-bold uppercase mb-2 text-orange">
                Speed
              </p>
              <h3 className="leading-tight transition-colors text-xl font-semibold mb-4 text-zinc-900">
                Faster Production
              </h3>
              <p className="text-sm text-zinc-500">
                Generate campaign assets in minutes, not weeks. Iterate instantly on creative direction.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="p-8 group transition-colors cursor-pointer hover:bg-black/5">
              <div className="h-32 flex items-center justify-center border-b mb-6 border-black/10">
                <span className="text-6xl font-bold tracking-tighter group-hover:scale-110 transition-transform duration-300 text-zinc-800 font-geist">∞</span>
              </div>
              <p className="text-[10px] font-bold uppercase mb-2 text-orange">
                Variations
              </p>
              <h3 className="leading-tight transition-colors text-xl font-semibold mb-4 text-zinc-900">
                Unlimited Options
              </h3>
              <p className="text-sm text-zinc-500">
                Generate endless variations of poses, outfits, and environments without additional cost.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="p-8 group transition-colors cursor-pointer hover:bg-black/5">
              <div className="h-32 flex items-center justify-center border-b mb-6 border-black/10">
                <span className="text-6xl font-bold tracking-tighter group-hover:scale-110 transition-transform duration-300 text-zinc-800 font-geist">24/7</span>
              </div>
              <p className="text-[10px] font-bold uppercase mb-2 text-orange">
                Availability
              </p>
              <h3 className="leading-tight transition-colors text-xl font-semibold mb-4 text-zinc-900">
                Always On Demand
              </h3>
              <p className="text-sm text-zinc-500">
                No scheduling conflicts. Generate content whenever you need it, day or night.
              </p>
            </div>
          </div>
        </section>

        {/* Contact / Waitlist Section */}
        <section id="contact" className="border-b border-black/10 bg-zinc-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-black/10">
            {/* Left: Featured Visual */}
            <div className="group relative min-h-[500px] lg:min-h-[600px] flex flex-col justify-end p-8 md:p-12 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&auto=format&fit=crop" 
                alt="Fashion Campaign" 
                className="group-hover:opacity-80 group-hover:scale-105 transition-all duration-1000 ease-out opacity-60 w-full h-full object-cover absolute inset-0 grayscale"
              />
              <div className="bg-gradient-to-t to-transparent absolute inset-0 from-zinc-50 via-zinc-50/60" />

              <div className="relative z-10 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <div className="flex items-center gap-4 mb-6">
                  <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border bg-white/80 backdrop-blur-sm border-black/10 text-orange">
                    Early Access
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-zinc-900 font-geist">
                  Join the Waitlist
                </h3>
                <p className="text-sm leading-relaxed max-w-sm text-zinc-600">
                  Be among the first to experience the future of AI-powered creative production. Early access members receive exclusive benefits.
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
              <div className="mb-8">
                <h3 className="text-2xl font-bold tracking-tight mb-4 font-geist">Early Access Benefits</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange/10 flex items-center justify-center">
                      <Check className="w-3 h-3 text-orange" />
                    </div>
                    <span className="text-sm">50% discount on launch pricing</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange/10 flex items-center justify-center">
                      <Check className="w-3 h-3 text-orange" />
                    </div>
                    <span className="text-sm">500 bonus generation points</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange/10 flex items-center justify-center">
                      <Check className="w-3 h-3 text-orange" />
                    </div>
                    <span className="text-sm">Priority access to new features</span>
                  </div>
                </div>
              </div>

              {submitted ? (
                <div className="text-center py-12 border border-black/10 bg-white">
                  <div className="w-16 h-16 rounded-full bg-orange/10 flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-orange" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 font-geist">You're on the list!</h3>
                  <p className="text-zinc-500 text-sm">We'll notify you when FormaStudio launches.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-2 text-black">Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="border px-4 py-3 text-sm placeholder-zinc-400 focus:outline-none focus:bg-white w-full transition-all bg-white border-black/10 text-black focus:border-orange"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-2 text-black">Company</label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="border px-4 py-3 text-sm placeholder-zinc-400 focus:outline-none focus:bg-white w-full transition-all bg-white border-black/10 text-black focus:border-orange"
                        placeholder="Your company"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2 text-black">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="border px-4 py-3 text-sm placeholder-zinc-400 focus:outline-none focus:bg-white w-full transition-all bg-white border-black/10 text-black focus:border-orange"
                      placeholder="you@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2 text-black">Interest</label>
                    <select
                      value={formData.interest}
                      onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                      className="border px-4 py-3 text-sm focus:outline-none w-full transition-all bg-white border-black/10 text-black focus:border-orange"
                    >
                      <option>All Studios</option>
                      <option>Casting Studio</option>
                      <option>Outfit Studio</option>
                      <option>Photo Studio</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={joinWaitlist.isPending}
                    className="w-full py-4 font-semibold text-sm transition-colors text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {joinWaitlist.isPending ? "Joining..." : "Join Waitlist"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="overflow-hidden pt-16 pb-12 relative bg-zinc-100/50">
          <div className="md:px-12 flex flex-col md:flex-row z-10 mb-12 pr-6 pl-6 relative gap-x-12 gap-y-8 items-start md:items-end justify-between">
            <div className="flex items-center gap-8">
              <div className="w-12 h-12 rounded-full border flex items-center justify-center border-zinc-900 bg-zinc-900">
                <span className="font-bold text-white text-xl">F</span>
              </div>
              <div className="flex gap-4 text-xs font-semibold tracking-widest uppercase opacity-80">
                <span>F</span>
                <span>O</span>
                <span>R</span>
                <span>M</span>
                <span>A</span>
              </div>
            </div>

            <div className="text-left md:text-right">
              <p className="text-sm font-semibold mb-4 text-zinc-900">Connect:</p>
              <div className="flex gap-4 md:justify-end">
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-black/5 hover:bg-black hover:text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-black/5 hover:bg-black hover:text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-black/5 hover:bg-black hover:text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Navigation Bar */}
          <div className="md:px-12 border-t pt-12 pr-6 pb-8 pl-6 border-black/10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12 max-w-7xl mx-auto">
              {/* Brand & Newsletter */}
              <div className="space-y-6">
                <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tighter text-2xl">
                  <span className="w-6 h-6 rounded flex items-center justify-center text-sm text-white bg-zinc-900">F</span>
                  <span className="font-geist">FORMA</span>
                </Link>
                <p className="text-sm leading-relaxed max-w-xs text-zinc-500">
                  AI-powered creative studio for fashion brands, agencies, and content creators.
                </p>
              </div>

              {/* Links Column 1 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-black">Studios</h4>
                <ul className="space-y-3 text-sm text-zinc-500">
                  <li><a href="#" className="transition-colors block hover:text-orange">Casting Studio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-orange">Outfit Studio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-orange">Photo Studio</a></li>
                </ul>
              </div>

              {/* Links Column 2 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-black">Company</h4>
                <ul className="space-y-3 text-sm text-zinc-500">
                  <li><a href="#" className="transition-colors block hover:text-orange">About</a></li>
                  <li><a href="#" className="transition-colors block hover:text-orange">Blog</a></li>
                  <li><a href="#" className="transition-colors block hover:text-orange">Careers</a></li>
                </ul>
              </div>

              {/* Links Column 3 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-black">Contact</h4>
                <ul className="space-y-3 text-sm text-zinc-500">
                  <li><a href="#" className="transition-colors flex items-center gap-2 hover:text-orange">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                    </svg>
                    hello@formastudio.app
                  </a></li>
                  <li><Link href="/login" className="transition-colors flex items-center gap-2 hover:text-orange">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" x2="3" y1="12" y2="12" />
                    </svg>
                    Sign In
                  </Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto border-black/10">
              {/* Dynamic Location Tag */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-zinc-100 text-zinc-500 text-xs font-mono">
                <span className="text-zinc-900" id="dynamic-time">--:--</span>
                <span className="text-zinc-300">|</span>
                <span id="dynamic-location">Loading...</span>
              </div>

              <p className="text-xs text-zinc-400">
                © 2025 FormaStudio™. All rights reserved.
              </p>
              <div className="flex items-center gap-6 text-xs text-zinc-400">
                <a href="#" className="transition-colors hover:text-black">Privacy Policy</a>
                <a href="#" className="transition-colors hover:text-black">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
