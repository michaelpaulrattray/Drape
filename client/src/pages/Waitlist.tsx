import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Menu,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Check,
  ArrowUpRight,
  MapPin,
  Phone,
  Calendar,
  Mail,
  Instagram,
  Twitter,
  BookOpen,
} from "lucide-react";
import { Link } from "wouter";

// Hero slides data
const heroSlides = [
  {
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/feb67f29-4bdc-4631-af01-58eb137bfb45_1600w.webp",
    tag: "Portraiture",
    title: "The Human Gaze",
    description: "Raw emotion captured in monochrome.",
  },
  {
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2564&auto=format&fit=crop",
    tag: "AI Generated",
    title: "Digital Muse",
    description: "Photorealistic AI model generation.",
  },
  {
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=2574&auto=format&fit=crop",
    tag: "Campaign",
    title: "Brand Identity",
    description: "Consistent model personas for your brand.",
  },
];

// Exploration projects data
const explorationProjects = [
  {
    title: "Casting",
    subtitle: "AI Model Generation",
    description: "Create unique, consistent AI model identities for your brand. Define characteristics, ethnicity, and aesthetic to generate photorealistic models.",
    img1: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=2564&auto=format&fit=crop",
    img2: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=2574&auto=format&fit=crop",
  },
  {
    title: "Styling",
    subtitle: "Outfit Generation",
    description: "Generate any outfit on your AI models. From streetwear to haute couture, create campaign-ready looks without physical samples.",
    img1: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=2520&auto=format&fit=crop",
    img2: "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=2576&auto=format&fit=crop",
  },
  {
    title: "Studio",
    subtitle: "Photo Generation",
    description: "Generate professional photoshoots with your AI models. Control lighting, backgrounds, poses, and styling for campaign-ready assets.",
    img1: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2670&auto=format&fit=crop",
    img2: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2532&auto=format&fit=crop",
  },
  {
    title: "Campaign",
    subtitle: "Full Production",
    description: "End-to-end campaign production. From concept to final assets, we handle the entire creative pipeline with AI-powered efficiency.",
    img1: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=2574&auto=format&fit=crop",
    img2: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=2573&auto=format&fit=crop",
  },
];

// Draggable service cards data
const serviceCards = [
  {
    number: "01",
    title: "AI Model Casting",
    description: "Generate unique, consistent AI model identities for your brand with photorealistic quality.",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/1445aeb2-ddb4-4e4d-a151-c96381893f07_1600w.jpg",
  },
  {
    number: "02",
    title: "Outfit Generation",
    description: "Create any outfit on your AI models. From streetwear to haute couture, no physical samples needed.",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/04ff5a45-5b01-4b68-a092-f3ec2da28b5e_1600w.jpg",
  },
  {
    number: "03",
    title: "Campaign Production",
    description: "Full photoshoot generation with complete lighting and environment control for campaign-ready assets.",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/f365bf31-c2fb-44c2-a24a-c78fedc640ba_1600w.jpg",
  },
  {
    number: "04",
    title: "Brand Consistency",
    description: "Maintain perfect visual consistency across all channels with AI-powered brand asset generation.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2532&auto=format&fit=crop",
  },
];

// Journal entries data
const journalEntries = [
  {
    category: "Technology",
    type: "Deep Dive",
    title: "The Future of AI Models",
    description: "How AI is revolutionizing fashion photography and model casting.",
  },
  {
    category: "Case Study",
    type: "Brand",
    title: "Campaign Success Stories",
    description: "Real results from brands using AI-generated content.",
  },
  {
    category: "Tutorial",
    type: "Technique",
    title: "Mastering AI Prompts",
    description: "Best practices for generating photorealistic fashion imagery.",
  },
];

// Services Marquee Section Component with Auto-Scroll
function ServicesMarqueeSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const prevTranslateRef = useRef(0);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const speed = 0.5;

    const animate = () => {
      if (!isDraggingRef.current) {
        positionRef.current += speed;
      }
      
      const trackWidth = track.scrollWidth;
      const setWidth = trackWidth / 3;

      if (positionRef.current >= setWidth) {
        positionRef.current = 0;
        if (isDraggingRef.current) {
          prevTranslateRef.current += setWidth;
          startXRef.current += setWidth;
        }
      }
      if (positionRef.current < 0) {
        positionRef.current = setWidth - 1;
        if (isDraggingRef.current) {
          prevTranslateRef.current -= setWidth;
          startXRef.current -= setWidth;
        }
      }

      track.style.transform = `translateX(${-positionRef.current}px)`;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.pageX;
    prevTranslateRef.current = positionRef.current;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const diff = startXRef.current - e.pageX;
    positionRef.current = prevTranslateRef.current + diff;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.touches[0].clientX;
    prevTranslateRef.current = positionRef.current;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diff = startXRef.current - e.touches[0].clientX;
    positionRef.current = prevTranslateRef.current + diff;
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Triple the cards for infinite scroll
  const tripleCards = [...serviceCards, ...serviceCards, ...serviceCards];

  return (
    <section className="border-t border-b border-black/10 bg-zinc-50 py-24 overflow-hidden relative">
      {/* Intelligent Grid Lines - framing content elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Vertical lines at 25%, 50%, 75% - stopping at content boundaries */}
        <div className="absolute left-[25%] top-0 h-[180px] w-px bg-black/[0.06]" />
        <div className="absolute left-[50%] top-0 h-[120px] w-px bg-black/[0.06]" />
        <div className="absolute left-[75%] top-0 h-[180px] w-px bg-black/[0.06]" />
        
        {/* Horizontal line under header content */}
        <div className="absolute left-0 right-0 top-[200px] h-px bg-black/[0.04] hidden md:block" />
        
        {/* Bottom grid lines - framing the cards area */}
        <div className="absolute left-[25%] bottom-0 h-[100px] w-px bg-black/[0.06]" />
        <div className="absolute left-[75%] bottom-0 h-[100px] w-px bg-black/[0.06]" />
        
        {/* Corner accent dots */}
        <div className="absolute left-[25%] top-[180px] w-1.5 h-1.5 rounded-full bg-orange-500/20 -translate-x-1/2" />
        <div className="absolute left-[75%] top-[180px] w-1.5 h-1.5 rounded-full bg-orange-500/20 -translate-x-1/2" />
        
        {/* Subtle diagonal accent line */}
        <div className="absolute right-0 top-0 w-[200px] h-px bg-gradient-to-l from-orange-500/10 to-transparent rotate-45 origin-right hidden lg:block" />
      </div>
      
      <div className="px-6 md:px-12 mb-16 md:mb-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
          <div>
            <p className="text-[10px] uppercase flex items-center gap-3 font-bold text-orange-600 tracking-[0.2em] mb-6">
              <span className="w-2 h-2 rounded-full bg-orange-600" />
              Services
            </p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tighter leading-none text-zinc-900 font-geist">
              Solving Problems With<br/>
              <span className="text-black/30">Intelligent AI</span>
            </h2>
          </div>
          <div className="lg:pl-12 lg:border-l lg:border-black/10">
            <p className="leading-relaxed md:text-base text-sm text-zinc-500 max-w-md">
              Whether you're fighting deadlines, budgets, or brand consistency, we build systems that generate premium assets instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Auto-Scrolling Marquee Container */}
      <div 
        ref={containerRef}
        className="flex w-full overflow-hidden select-none cursor-grab active:cursor-grabbing touch-pan-y"
        style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          ref={trackRef}
          className="flex gap-6 md:gap-8 min-w-max px-4 md:px-8 items-stretch will-change-transform"
        >
          {tripleCards.map((card, index) => (
            <div 
              key={index} 
              className="group relative w-[85vw] md:w-[420px] h-[520px] overflow-hidden border border-black/10 bg-zinc-50 hover:border-orange-500/50 transition-all duration-500 shrink-0"
            >
              <div className="absolute inset-0 w-full h-full">
                <img 
                  src={card.image} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out" 
                  draggable="false" 
                  alt={card.title}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white" />
              </div>
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="font-geist text-6xl md:text-7xl font-bold text-zinc-900/10 group-hover:text-orange-500/20 transition-colors duration-500">{card.number}</span>
                  <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 border border-black/10">
                    <ArrowUpRight className="w-5 h-5 text-zinc-900" />
                  </div>
                </div>
                <div className="bg-white/90 backdrop-blur-sm p-6 -mx-8 -mb-8 border-t border-black/10">
                  <h3 className="text-xl md:text-2xl font-geist font-semibold tracking-tight text-zinc-900 mb-2">
                    {card.title}
                  </h3>
                  <p className="text-zinc-600 text-sm leading-relaxed">
                    {card.description}
                  </p>
                  <div className="mt-4 pt-4 border-t border-black/10 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.15em] text-zinc-400">Learn more</span>
                    <ArrowRight className="w-4 h-4 text-orange-500" />
                  </div>
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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [projectSlide, setProjectSlide] = useState(0);
  const [navOpen, setNavOpen] = useState(false);

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: (data) => {
      if (data.alreadyRegistered) {
        setAlreadyRegistered(true);
        setPosition(data.position ?? null);
      } else {
        setSubmitted(true);
        setPosition(data.position ?? null);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && name) {
      joinWaitlist.mutate({ email, name });
    }
  };

  const nextHeroSlide = () => {
    setHeroSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const prevHeroSlide = () => {
    setHeroSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  const nextProjectSlide = () => {
    setProjectSlide((prev) => (prev + 1) % explorationProjects.length);
  };

  const prevProjectSlide = () => {
    setProjectSlide((prev) => (prev - 1 + explorationProjects.length) % explorationProjects.length);
  };

  const currentProject = explorationProjects[projectSlide];

  return (
    <div className="min-h-screen relative text-obsidian bg-canvas selection:bg-slate-accent selection:text-white overflow-x-hidden">
      {/* Subtle Background Pattern */}
      <div className="fixed pointer-events-none z-0 inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(110,127,141,0.03)_0%,transparent_50%)]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-6 md:px-12 md:py-8 flex justify-between items-center bg-canvas/80 backdrop-blur-md border-b border-border">
        <a href="#" className="group flex items-center gap-2 text-2xl md:text-3xl tracking-tight font-normal font-geist text-obsidian">
          <img 
            src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png" 
            alt="Forma Studio" 
            className="w-7 h-7 md:w-8 md:h-8"
          />
          <span className="border-b border-obsidian pb-0.5 group-hover:border-transparent transition-colors duration-300">forma</span>
          <span className="text-charcoal">studio</span>
        </a>

        {/* Desktop Menu */}
        <div className="flex items-center pointer-events-auto">
          <a 
            href="#waitlist" 
            className="btn-slate px-5 py-2.5 rounded-lg text-sm font-medium uppercase tracking-wide"
          >
            Join Waitlist
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="z-10 relative">
        {/* Hero Section */}
        <section className="md:pt-32 md:pb-32 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-0 border-b px-6 pt-24 pb-20 relative border-border bg-studio-950">
          
          {/* Left Col */}
          <div className="col-span-1 flex flex-col z-20 h-full relative justify-between">
            <div className="mb-16">
              <p className="text-[10px] uppercase md:text-xs font-semibold tracking-widest mb-2 text-slate-accent">
                AI-Powered Creative Studio
              </p>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-none mb-4 font-geist text-obsidian">
                FORMA
                <span className="text-slate-accent text-6xl align-top">Studio</span>
              </h1>
              <div className="h-px w-full bg-gradient-to-r to-transparent my-6 from-border" />
            </div>

            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="group cursor-pointer card-soft p-4 rounded-xl">
                <Camera className="text-4xl mb-4 group-hover:text-slate-accent transition-colors text-charcoal w-9 h-9" />
                <h3 className="text-sm font-semibold leading-tight mb-2 text-obsidian">
                  AI Model
                  <br />
                  Generation
                </h3>
                <div className="w-4 h-0.5 group-hover:w-8 transition-all bg-slate-accent" />
              </div>
              <div className="group cursor-pointer card-soft p-4 rounded-xl">
                <ImageIcon className="text-4xl mb-4 group-hover:text-slate-accent transition-colors text-charcoal w-9 h-9" />
                <h3 className="leading-tight text-sm font-semibold mb-2 text-obsidian">
                  Campaign
                  <br />
                  Assets
                </h3>
                <div className="w-4 h-0.5 group-hover:w-8 transition-all bg-slate-accent" />
              </div>
            </div>

            <div className="mt-auto">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email) {
                    joinWaitlist.mutate({ email, name: email.split('@')[0] });
                  }
                }}
                className="flex flex-col gap-3 w-full max-w-xs"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-4 py-3 bg-white border border-border rounded-lg text-obsidian placeholder:text-subtle text-sm focus:outline-none focus:border-slate-accent focus:ring-1 focus:ring-slate-accent transition-all shadow-neumorphic"
                />
                <button 
                  type="submit"
                  disabled={joinWaitlist.isPending || !email}
                  className="btn-slate inline-flex items-center justify-center gap-3 px-8 py-4 font-semibold text-sm uppercase tracking-wider rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joinWaitlist.isPending ? "Joining..." : "Get Early Access"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
              {submitted && (
                <p className="mt-3 text-sm text-slate-accent font-medium">You're on the list! Position #{position}</p>
              )}
              {alreadyRegistered && (
                <p className="mt-3 text-sm text-charcoal font-medium">Already registered! Position #{position}</p>
              )}
            </div>
          </div>

          {/* Center Visual (Carousel) */}
          <div className="col-span-1 md:col-span-2 flex md:py-0 pt-10 pb-10 relative items-center justify-center">
            <div className="aspect-[3/4] group overflow-hidden md:aspect-auto md:h-[600px] w-full relative rounded-2xl shadow-neumorphic">
              {/* Slider Track */}
              <div 
                className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform w-full h-full"
                style={{ transform: `translateX(-${heroSlide * 100}%)` }}
              >
                {heroSlides.map((slide, index) => (
                  <div key={index} className="flex-shrink-0 z-10 w-full h-full relative">
                    <img 
                      src={slide.image} 
                      alt={slide.title} 
                      className="w-full h-full object-cover grayscale contrast-125"
                    />
                    <div className="bg-gradient-to-t via-transparent to-transparent z-10 absolute inset-0 from-zinc-900/50" />
                    <div className="absolute bottom-0 left-0 p-8 transform transition-transform duration-500 group-hover:-translate-y-2">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-0.5 rounded border text-[10px] font-mono uppercase backdrop-blur-md border-white/20 bg-white/10 text-white">
                          {slide.tag}
                        </span>
                      </div>
                      <h3 className="text-2xl font-semibold tracking-tight mb-1 text-white font-geist">{slide.title}</h3>
                      <p className="text-sm line-clamp-1 text-white/70">{slide.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Overlay */}
              <div className="flex gap-3 z-20 absolute right-8 bottom-8 items-center">
                <div className="px-3 py-1.5 rounded-full backdrop-blur-xl border text-xs font-mono mr-2 shadow-lg bg-black/80 border-white/10 text-white">
                  <span>{String(heroSlide + 1).padStart(2, '0')}</span>
                  <span className="mx-1 text-white/30">/</span>
                  {String(heroSlides.length).padStart(2, '0')}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={prevHeroSlide}
                    className="w-10 h-10 rounded-full border backdrop-blur-xl flex items-center justify-center transition-all duration-300 group/btn shadow-lg border-white/10 bg-black/50 text-white hover:bg-white hover:text-black"
                  >
                    <ArrowLeft className="w-[18px] h-[18px] group-hover/btn:-translate-x-0.5 transition-transform" strokeWidth={1.5} />
                  </button>
                  <button 
                    onClick={nextHeroSlide}
                    className="w-10 h-10 rounded-full border backdrop-blur-xl flex items-center justify-center transition-all duration-300 group/btn shadow-lg border-white/10 bg-black/50 text-white hover:bg-white hover:text-black"
                  >
                    <ArrowRight className="w-[18px] h-[18px] group-hover/btn:translate-x-0.5 transition-transform" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col */}
          <div className="col-span-1 flex flex-col md:items-end z-20 md:pt-0 h-full pt-8 relative items-start pl-6 md:pl-0">
            <p className="text-[10px] uppercase font-semibold text-subtle tracking-widest mb-1">
              Creators Waiting:
            </p>
            <span className="text-6xl md:text-8xl font-bold tracking-tighter text-obsidian font-geist">
              847
            </span>
          </div>
        </section>

        {/* Trusted By Section - Scrolling Logos */}
        <section className="py-8 md:py-12 border-b border-border overflow-hidden bg-canvas">
          <div className="text-center mb-6">
            <p className="text-xs md:text-sm font-mono uppercase tracking-widest text-subtle">
              Trusted by top creatives working for:
            </p>
          </div>
          
          {/* Marquee Container */}
          <div className="relative">
            {/* Gradient Masks */}
            <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-canvas to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-canvas to-transparent z-10" />
            
            {/* Scrolling Content */}
            <div className="flex w-[200%] animate-marquee">
              {/* First set of logos */}
              <div className="flex justify-around items-center w-1/2 gap-12 md:gap-16 px-8">
                {/* Shopify */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/VMgDTvhuoCmrtVNs.svg" 
                  alt="Shopify" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Meta */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/jaeoJSKaawVFHFlG.svg" 
                  alt="Meta" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Facebook */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/zRfOlALORwscPsKB.svg" 
                  alt="Facebook" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Nike */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/vjOQMdTaqDkzvcok.svg" 
                  alt="Nike" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Instagram */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/jdlIGMCEIxKteAHV.svg" 
                  alt="Instagram" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Google Chrome */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/bvpJvTBdFFwkNRCs.svg" 
                  alt="Google Chrome" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
              </div>
              {/* Duplicate set for seamless loop */}
              <div className="flex justify-around items-center w-1/2 gap-12 md:gap-16 px-8">
                {/* Shopify */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/VMgDTvhuoCmrtVNs.svg" 
                  alt="Shopify" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Meta */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/jaeoJSKaawVFHFlG.svg" 
                  alt="Meta" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Facebook */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/zRfOlALORwscPsKB.svg" 
                  alt="Facebook" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Nike */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/vjOQMdTaqDkzvcok.svg" 
                  alt="Nike" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Instagram */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/jdlIGMCEIxKteAHV.svg" 
                  alt="Instagram" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
                {/* Google Chrome */}
                <img 
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/bvpJvTBdFFwkNRCs.svg" 
                  alt="Google Chrome" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-40 hover:opacity-90 transition-opacity grayscale"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Exploration Section */}
        <section id="studios" className="grid grid-cols-1 md:grid-cols-2 border-b border-border bg-studio-950">
          {/* Left: Gallery */}
          <div className="md:p-12 overflow-hidden group border-border border-r p-6 relative">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="bg-studio-900 w-full h-64 md:h-80 relative overflow-hidden rounded-xl shadow-neumorphic">
                <img 
                  src={currentProject.img1} 
                  className="w-full h-full object-cover grayscale opacity-90 group-hover:scale-105 transition-transform duration-700"
                  alt={currentProject.title}
                />
              </div>
              <div className="w-full h-64 md:h-80 relative overflow-hidden translate-y-8 bg-studio-900 rounded-xl shadow-neumorphic">
                <img 
                  src={currentProject.img2} 
                  className="w-full h-full object-cover grayscale opacity-90 group-hover:scale-105 transition-transform duration-700 delay-75"
                  alt={currentProject.subtitle}
                />
              </div>
            </div>
          </div>

          {/* Right: Text Content */}
          <div className="md:p-12 flex flex-col p-6 justify-center">
            <h2 className="text-7xl md:text-9xl font-semibold tracking-tighter mb-4 text-obsidian font-geist">
              {currentProject.title}
            </h2>
            <h3 className="text-xl md:text-2xl font-semibold mb-4 text-charcoal">
              {currentProject.subtitle}
            </h3>
            <p className="leading-relaxed md:text-base text-sm text-subtle max-w-md mb-10">
              {currentProject.description}
            </p>

            <div className="flex items-center justify-between mt-auto pt-8 border-t border-border">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-semibold font-mono">
                  <span>{String(projectSlide + 1).padStart(2, '0')}</span>
                  <span className="text-base align-top ml-1 text-subtle">/ {String(explorationProjects.length).padStart(2, '0')}</span>
                </span>
                <div className="flex gap-2 ml-4">
                  <button 
                    onClick={prevProjectSlide}
                    className="flex transition hover:bg-slate-accent hover:text-white w-8 h-8 border-border border rounded-full items-center justify-center text-obsidian"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={nextProjectSlide}
                    className="flex transition hover:bg-slate-accent hover:text-white w-8 h-8 border-border border rounded-full items-center justify-center text-obsidian"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <a href="#waitlist" className="btn-slate-outline px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2">
                All Studios
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="relative border-b border-border bg-canvas">
          {/* Tabs */}
          <div className="absolute top-0 left-0 md:left-1/4 flex z-20">
            <button className="text-sm font-semibold border-r px-8 py-3 backdrop-blur-sm bg-studio-950/80 border-border text-obsidian">
              AI Workflow
            </button>
            <button className="transition-colors text-sm font-semibold px-8 py-3 hover:text-obsidian text-subtle">
              Traditional
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left Content */}
            <div className="md:p-12 md:pt-32 flex flex-col border-border border-r pt-24 p-6 relative justify-center">
              <h2 className="md:text-7xl uppercase text-5xl font-bold tracking-tighter mb-8 text-obsidian font-geist">
                Process
              </h2>

              <div className="mb-12">
                <h4 className="text-xl font-semibold mb-2 text-obsidian">AI-Powered Pipeline</h4>
                <h5 className="text-lg text-charcoal mb-6">From Brief to Campaign</h5>
                <p className="leading-relaxed text-sm text-subtle max-w-sm">
                  Our AI handles the entire creative pipeline. From model generation to final campaign assets, 
                  we deliver photorealistic results in hours, not weeks.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border">
                <div>
                  <p className="text-[10px] font-bold uppercase mb-1 text-slate-accent">
                    Turnaround
                  </p>
                  <p className="text-2xl font-bold font-mono text-obsidian">24h</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase mb-1 text-slate-accent">
                    Cost
                  </p>
                  <p className="text-2xl font-bold font-mono text-obsidian">-90%</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase mb-1 text-slate-accent">
                    Variations
                  </p>
                  <p className="text-2xl font-bold font-mono text-obsidian">∞</p>
                </div>
              </div>
            </div>

            {/* Right Image */}
            <div className="relative h-[500px] md:h-auto overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=2532&auto=format&fit=crop" 
                className="absolute inset-0 w-full h-full object-cover grayscale contrast-125"
                alt="Process"
              />
              <div className="absolute inset-0 bg-gradient-to-t to-transparent from-canvas/20" />
            </div>
          </div>
        </section>

        {/* Methodology Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 border-b relative group border-border bg-studio-950">
          {/* Left: Visual Content */}
          <div className="relative min-h-[500px] lg:min-h-[700px] border-r overflow-hidden border-border">
            <img 
              src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=2564&auto=format&fit=crop" 
              alt="Camera Lens" 
              className="absolute inset-0 w-full h-full object-cover grayscale opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t to-transparent from-studio-950 via-studio-950/20" />
            
            {/* Floating Data Card */}
            <div className="absolute bottom-8 left-8 right-8 md:left-12 md:right-auto md:w-80 backdrop-blur-xl border p-6 z-10 transition-colors duration-300 bg-studio-950/90 border-border hover:bg-studio-950 card-soft rounded-xl">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-accent">Current Tech</span>
                <Camera className="w-4 h-4 text-subtle" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider font-semibold text-subtle">Engine: Flux Pro</p>
                <p className="text-lg font-medium tracking-tight text-obsidian">Photorealistic Generation</p>
              </div>
            </div>
          </div>

          {/* Right: Philosophy & Interactive List */}
          <div className="flex flex-col">
            {/* Header */}
            <div className="p-8 md:p-16 flex-1 flex flex-col justify-center relative">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <Sparkles className="w-[120px] h-[120px]" />
              </div>

              <p className="text-[10px] uppercase flex items-center gap-3 font-bold text-slate-accent tracking-[0.2em] mb-6">
                <span className="w-2 h-2 rounded-full bg-slate-accent" />
                Vision
              </p>
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none mb-6 text-obsidian font-geist">
                Create, Scale & 
                <span className="text-charcoal"> Deliver</span>
              </h2>
              <p className="leading-relaxed md:text-base text-sm text-subtle max-w-md">
                AI photography is not just about generating images, but creating consistent brand identities. 
                We combine cutting-edge AI with creative direction to deliver campaign-ready assets.
              </p>
            </div>

            {/* Accordion / List Items */}
            <div className="border-t divide-y border-border divide-border bg-canvas">
              {/* Item 1 */}
              <a href="#" className="group block md:px-12 md:py-8 transition-colors duration-300 hover:bg-studio-950/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-xs transition-colors text-slate-accent/50 group-hover:text-slate-accent">01</span>
                    <div className="flex flex-col">
                      <h3 className="group-hover:text-obsidian transition-colors text-lg font-medium text-charcoal tracking-tight">Model Creation</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform translate-y-2 group-hover:translate-y-0 text-subtle">Define characteristics and generate consistent AI models</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-border group-hover:border-slate-accent/50 group-hover:bg-slate-accent/10">
                    <ArrowUpRight className="w-4 h-4 text-subtle group-hover:text-slate-accent" />
                  </div>
                </div>
              </a>

              {/* Item 2 */}
              <a href="#" className="group block p-6 md:px-12 md:py-8 transition-colors duration-300 hover:bg-studio-950/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-xs transition-colors text-slate-accent/50 group-hover:text-slate-accent">02</span>
                    <div className="flex flex-col">
                      <h3 className="group-hover:text-obsidian transition-colors text-lg font-medium text-charcoal tracking-tight">Outfit Styling</h3>
                      <span className="group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform group-hover:translate-y-0 text-xs text-subtle opacity-0 h-0 mt-1 translate-y-2">Generate any outfit on your AI models</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-border group-hover:border-slate-accent/50 group-hover:bg-slate-accent/10">
                    <ArrowUpRight className="w-4 h-4 text-subtle group-hover:text-slate-accent" />
                  </div>
                </div>
              </a>

              {/* Item 3 */}
              <a href="#" className="group block p-6 md:px-12 md:py-8 transition-colors duration-300 hover:bg-studio-950/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-xs transition-colors text-slate-accent/50 group-hover:text-slate-accent">03</span>
                    <div className="flex flex-col">
                      <h3 className="text-lg font-medium tracking-tight group-hover:text-obsidian transition-colors text-charcoal">Campaign Production</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform translate-y-2 group-hover:translate-y-0 text-subtle">Full photoshoot generation with lighting control</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-border group-hover:border-slate-accent/50 group-hover:bg-slate-accent/10">
                    <ArrowUpRight className="w-4 h-4 text-subtle group-hover:text-slate-accent" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Services Draggable Cards Section with Auto-Scroll */}
        <ServicesMarqueeSection />

        {/* Journal Section */}
        <section className="border-b border-border bg-studio-950">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Left: Featured Article */}
            <div className="group relative min-h-[600px] flex flex-col justify-end p-8 md:p-12 overflow-hidden cursor-pointer">
              <img 
                src="https://images.unsplash.com/photo-1452587925148-ce544e77e70d?q=80&w=2574&auto=format&fit=crop" 
                alt="Featured" 
                className="group-hover:opacity-80 group-hover:scale-105 transition-all duration-1000 ease-out opacity-60 w-full h-full object-cover absolute inset-0 grayscale"
              />
              <div className="bg-gradient-to-t to-transparent absolute inset-0 from-studio-950 via-studio-950/60" />
              
              <div className="relative z-10 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <div className="flex items-center gap-4 mb-6">
                  <span className="px-3 py-1 border text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm border-slate-accent/30 bg-slate-accent/10 text-slate-accent">Featured</span>
                  <span className="text-xs font-mono tracking-tight text-subtle">FEB 02, 2026</span>
                </div>
                
                <h3 className="md:text-7xl uppercase text-5xl font-bold tracking-tighter mb-8 text-obsidian font-geist">
                  The Future of 
                  <span className="font-normal text-charcoal"> AI Fashion</span>
                </h3>
                
                <p className="leading-relaxed line-clamp-2 md:text-lg text-subtle max-w-md mb-8">
                  Exploring how AI is revolutionizing fashion photography and model casting, 
                  where digital innovation meets creative vision.
                </p>
                
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-colors text-obsidian group-hover:text-slate-accent">
                  Read Full Entry
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center group-hover:text-white transition-all duration-300 border-border group-hover:bg-slate-accent group-hover:border-slate-accent">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Editorial List */}
            <div className="flex flex-col h-full">
              <div className="p-8 md:p-12 border-b flex items-center justify-between bg-canvas/50 border-border">
                <div>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase mb-2 text-obsidian font-geist">Journal</h2>
                  <p className="text-xs uppercase tracking-widest text-subtle">Behind the Scenes</p>
                </div>
                <a href="#" className="btn-slate-outline px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2">
                  Archive
                  <BookOpen className="w-3.5 h-3.5" />
                </a>
              </div>
              
              <div className="flex-1 divide-y divide-border">
                {journalEntries.map((entry, index) => (
                  <a key={index} href="#" className="group block p-8 md:px-12 transition-colors relative overflow-hidden hover:bg-studio-950/50">
                    <div className="absolute right-0 top-0 bottom-0 w-1 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300 bg-slate-accent" />
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-accent">{entry.category}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-[10px] uppercase tracking-widest text-subtle">{entry.type}</span>
                        </div>
                        <h4 className="text-xl md:text-2xl font-semibold mb-2 group-hover:text-obsidian transition-colors text-charcoal">{entry.title}</h4>
                        <p className="text-sm group-hover:text-charcoal transition-colors text-subtle">{entry.description}</p>
                      </div>
                      <div className="flex hidden md:flex transition-colors w-20 h-20 border items-center justify-center bg-studio-900/50 border-border group-hover:bg-slate-accent/10 text-slate-accent">
                        <Sparkles className="w-6 h-6" />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Waitlist Section - Redesigned */}
        <section id="waitlist" className="border-b border-border">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left: Visual Side */}
            <div className="relative min-h-[500px] lg:min-h-[700px] overflow-hidden bg-obsidian">
              <img 
                src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2670&auto=format&fit=crop" 
                alt="Fashion model" 
                className="w-full h-full object-cover opacity-60 grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-obsidian/80 via-obsidian/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent" />
              
              {/* Floating Stats */}
              <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12 z-10">
                <div className="flex items-end gap-8">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Beta Users</p>
                    <span className="text-5xl md:text-6xl font-bold tracking-tighter text-white font-geist">847</span>
                  </div>
                  <div className="pb-2">
                    <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Launch</p>
                    <span className="text-xl font-semibold text-white">Q1 2026</span>
                  </div>
                </div>
              </div>
              
              {/* Corner Accent */}
              <div className="absolute top-8 left-8 md:top-12 md:left-12">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-slate-accent animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest text-white/70">Limited Access</span>
                </div>
              </div>
            </div>
            
            {/* Right: Form Side */}
            <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16 bg-studio-950 border-l border-border">
              <div className="max-w-md">
                {/* Section Label */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-accent">Early Access</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-4 text-obsidian font-geist">
                  Reserve Your
                  <span className="block text-charcoal">Studio Access</span>
                </h2>
                
                <p className="text-base text-subtle mb-10 leading-relaxed">
                  Join the waitlist for exclusive early access to AI-powered fashion photography. 
                  Be among the first to transform your creative workflow.
                </p>

                {!submitted && !alreadyRegistered ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-subtle mb-2 block">Full Name</label>
                        <Input
                          type="text"
                          placeholder="Enter your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="border-0 border-b-2 rounded-none px-0 py-3 text-base placeholder-subtle/50 focus:outline-none bg-transparent w-full transition-all text-obsidian border-border focus:border-slate-accent"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-subtle mb-2 block">Email Address</label>
                        <Input
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="border-0 border-b-2 rounded-none px-0 py-3 text-base placeholder-subtle/50 focus:outline-none bg-transparent w-full transition-all text-obsidian border-border focus:border-slate-accent"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="pt-6">
                      <Button 
                        type="submit" 
                        disabled={joinWaitlist.isPending}
                        className="btn-slate w-full font-semibold text-sm px-8 py-4 transition-all duration-300 flex items-center justify-center gap-3"
                      >
                        {joinWaitlist.isPending ? "Joining..." : (
                          <>
                            Get Early Access
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <p className="text-[11px] text-subtle text-center pt-4">
                      No spam, ever. Unsubscribe anytime.
                    </p>
                  </form>
                ) : (
                  <div className="p-8 border-2 border-slate-accent/30 bg-slate-accent/5 rounded-xl">
                    <div className="w-16 h-16 border-2 border-slate-accent flex items-center justify-center mb-6 rounded-full">
                      <Check className="w-8 h-8 text-slate-accent" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight mb-2 text-obsidian font-geist">
                      {alreadyRegistered ? "Already Registered" : "You're In"}
                    </h3>
                    <p className="text-subtle">
                      {position ? `Position #${position} in queue. We'll notify you soon.` : "We'll be in touch soon."}
                    </p>
                  </div>
                )}
                
                {/* Trust Indicators */}
                <div className="flex items-center gap-6 mt-10 pt-8 border-t border-border">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-studio-900 border-2 border-studio-950" />
                    <div className="w-8 h-8 rounded-full bg-slate-accent/50 border-2 border-studio-950" />
                    <div className="w-8 h-8 rounded-full bg-slate-accent border-2 border-studio-950" />
                  </div>
                  <p className="text-xs text-subtle">
                    <span className="font-semibold text-charcoal">847+ creators</span> already waiting
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="overflow-hidden pt-32 pb-12 relative bg-canvas">
          <div className="md:px-12 flex flex-col md:flex-row z-10 mb-16 px-6 relative gap-12 items-end justify-between">
            <div className="flex items-center gap-8">
              <div className="w-12 h-12 rounded-full border flex items-center justify-center border-obsidian bg-obsidian">
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

            <div className="text-right">
              <p className="text-sm font-semibold mb-4 text-obsidian">
                Connect:
              </p>
              <div className="flex gap-4 justify-end">
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-studio-900/50 hover:bg-slate-accent hover:text-white">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-studio-900/50 hover:bg-slate-accent hover:text-white">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-studio-900/50 hover:bg-slate-accent hover:text-white">
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Navigation Bar */}
          <div className="md:px-12 border-t pt-16 px-6 pb-8 backdrop-blur-md bg-studio-950/80 border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12 max-w-7xl mx-auto">
              {/* Brand & Newsletter */}
              <div className="space-y-6">
                <a href="#" className="inline-flex items-center gap-2 font-bold tracking-tighter text-2xl font-geist">
                  <img 
                    src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png" 
                    alt="Forma Studio" 
                    className="w-6 h-6"
                  />
                  FORMA
                </a>
                <p className="text-sm leading-relaxed max-w-xs text-subtle">
                  AI-powered fashion photography. Create stunning campaign assets without traditional photoshoots.
                </p>
                <div className="pt-2">
                  <p className="text-xs font-semibold mb-2 text-obsidian">Subscribe for updates</p>
                  <form className="flex gap-2">
                    <input 
                      type="email" 
                      placeholder="Email address" 
                      className="border rounded-lg px-3 py-2 text-xs placeholder-subtle focus:outline-none w-full transition-all bg-canvas border-border text-obsidian focus:border-slate-accent"
                    />
                    <button type="submit" className="btn-slate font-semibold text-xs px-4 py-2 rounded-lg transition-colors">
                      Join
                    </button>
                  </form>
                </div>
              </div>

              {/* Links Column 1 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-obsidian">Studios</h4>
                <ul className="space-y-3 text-sm text-subtle">
                  <li><a href="#" className="transition-colors block hover:text-slate-accent">Casting Studio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-slate-accent">Outfit Studio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-slate-accent">Photo Studio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-slate-accent">Campaign Builder</a></li>
                </ul>
              </div>

              {/* Links Column 2 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-obsidian">Company</h4>
                <ul className="space-y-3 text-sm text-subtle">
                  <li><a href="#" className="transition-colors block hover:text-slate-accent">About FormaStudio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-slate-accent">Technology</a></li>
                  <li><a href="#" className="transition-colors block hover:text-slate-accent">Case Studies</a></li>
                  <li><a href="#" className="transition-colors block hover:text-slate-accent">Pricing</a></li>
                </ul>
              </div>

              {/* Links Column 3 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-obsidian">Contact</h4>
                <ul className="space-y-3 text-sm text-subtle">
                  <li>
                    <a href="#" className="transition-colors flex items-center gap-2 hover:text-slate-accent">
                      <MapPin className="w-3.5 h-3.5" />
                      San Francisco, CA
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors flex items-center gap-2 hover:text-slate-accent">
                      <Calendar className="w-3.5 h-3.5" />
                      Book a Demo
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors flex items-center gap-2 hover:text-slate-accent">
                      <Mail className="w-3.5 h-3.5" />
                      hello@formastudio.ai
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto border-border">
              <p className="text-xs text-subtle">
                © 2026 FormaStudio. All rights reserved.
              </p>
              <div className="flex items-center gap-6 text-xs text-subtle">
                <a href="#" className="transition-colors hover:text-obsidian">Privacy Policy</a>
                <a href="#" className="transition-colors hover:text-obsidian">Terms of Service</a>
                <a href="#" className="transition-colors hover:text-obsidian">Sitemap</a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
