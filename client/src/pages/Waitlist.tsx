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
      {/* Grid lines overlay for visual consistency */}
      <div className="absolute inset-0 grid-lines pointer-events-none" />
      <div className="px-6 md:px-12 mb-16 md:mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-500 font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              Services
            </span>
            <h2 className="text-4xl md:text-6xl lg:text-7xl leading-[0.95] tracking-tight font-geist text-zinc-900">
              Solving Problems With <br/><span className="text-zinc-400">Intelligent AI</span>
            </h2>
          </div>
          <div className="lg:pl-12">
            <p className="text-lg md:text-xl font-light text-zinc-600 leading-relaxed">
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
              className="group relative w-[85vw] md:w-[420px] h-[520px] overflow-hidden border border-black/10 bg-zinc-50 hover:border-sky-500/50 transition-all duration-500 shrink-0"
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
                  <span className="font-geist text-6xl md:text-7xl font-bold text-zinc-900/10 group-hover:text-sky-500/20 transition-colors duration-500">{card.number}</span>
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
                    <ArrowRight className="w-4 h-4 text-sky-500" />
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
    <div className="min-h-screen relative text-zinc-900 bg-zinc-50 selection:bg-sky-500 selection:text-white overflow-x-hidden">
      {/* Background Grid Lines with Animated Neon */}
      <div className="fixed grid-lines pointer-events-none z-0 inset-0 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="neonGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "rgba(14, 165, 233, 0)", stopOpacity: 0 }} />
              <stop offset="50%" style={{ stopColor: "rgba(14, 165, 233, 0.5)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgba(14, 165, 233, 0)", stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id="neonGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: "rgba(14, 165, 233, 0)", stopOpacity: 0 }} />
              <stop offset="50%" style={{ stopColor: "rgba(14, 165, 233, 0.5)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgba(14, 165, 233, 0)", stopOpacity: 0 }} />
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

      {/* Navigation */}
      <nav className="flex md:px-12 z-50 border-b px-6 py-6 relative items-center justify-between border-black/5 bg-zinc-50/80 backdrop-blur-md">
        <a href="#" className="inline-flex items-center gap-2 font-bold tracking-tighter text-2xl font-geist">
          <span className="w-6 h-6 rounded flex items-center justify-center text-sm text-white bg-zinc-900">F</span>
          FORMA
        </a>

        <div className="relative">
          <button 
            onClick={() => setNavOpen(!navOpen)} 
            className="group flex items-center gap-3 px-5 py-2 border transition duration-300 bg-transparent border-black/10 hover:bg-black/5"
          >
            <Menu className="w-5 h-5 stroke-[1.5] text-black" />
            <span className="text-sm font-medium tracking-wide">Studios</span>
          </button>
          
          {navOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 border shadow-2xl py-2 z-50 backdrop-blur-xl bg-white border-black/5">
              <a href="#" className="block px-6 py-3 text-sm font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-sky-600">Casting Studio</a>
              <a href="#" className="block px-6 py-3 text-sm font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-sky-600">Outfit Studio</a>
              <a href="#" className="block px-6 py-3 text-sm font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-sky-600">Photo Studio</a>
              <a href="#waitlist" className="block px-6 py-3 text-sm font-medium transition-colors tracking-wide text-black/70 hover:bg-black/5 hover:text-sky-600">Get Early Access</a>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="z-10 relative">
        {/* Hero Section */}
        <section className="md:pt-24 md:pb-32 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-0 border-b px-6 pt-16 pb-20 relative border-black/10">
          {/* Abstract Video Background */}
          <video 
            src="https://cdn.coverr.co/videos/coverr-shadows-of-leaves-on-a-wall-3536/1080p.mp4" 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="z-10 opacity-[0.08] w-full h-full object-cover absolute inset-0"
          />
          
          {/* Left Col */}
          <div className="col-span-1 flex flex-col z-20 h-full relative justify-between">
            <div className="mb-16">
              <p className="text-[10px] uppercase md:text-xs font-semibold tracking-widest mb-2 text-sky-600">
                AI-Powered Creative Studio
              </p>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-none mb-4 font-geist">
                FORMA
                <span className="text-sky-500 text-6xl align-top">+</span>
              </h1>
              <div className="h-px w-full bg-gradient-to-r to-transparent my-6 from-black/20" />
            </div>

            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="group cursor-pointer">
                <Camera className="text-4xl mb-4 group-hover:text-sky-600 transition-colors text-zinc-800 w-9 h-9" />
                <h3 className="text-sm font-semibold leading-tight mb-2">
                  AI Model
                  <br />
                  Generation
                </h3>
                <div className="w-4 h-0.5 group-hover:w-8 transition-all bg-sky-500" />
              </div>
              <div className="group cursor-pointer">
                <ImageIcon className="text-4xl mb-4 group-hover:text-sky-600 transition-colors text-zinc-800 w-9 h-9" />
                <h3 className="leading-tight text-sm font-semibold mb-2">
                  Campaign
                  <br />
                  Assets
                </h3>
                <div className="w-4 h-0.5 group-hover:w-8 transition-all bg-sky-500" />
              </div>
            </div>

            <div className="flex gap-12 mt-auto text-xs font-medium tracking-wide text-zinc-600">
              <a href="#studios" className="flex items-center gap-2 transition-colors hover:text-black">
                View Studios
                <ChevronRight className="w-3 h-3" />
              </a>
              <a href="#waitlist" className="flex items-center gap-2 transition-colors hover:text-black">
                Get Access
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Center Visual (Carousel) */}
          <div className="col-span-1 md:col-span-2 flex md:py-0 pt-10 pb-10 relative items-center justify-center">
            <div className="aspect-[3/4] group overflow-hidden md:aspect-auto md:h-[600px] w-full relative">
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
            <p className="text-[10px] uppercase font-semibold text-zinc-400 tracking-widest mb-1">
              Creators Waiting:
            </p>
            <span className="text-6xl md:text-8xl font-bold tracking-tighter text-zinc-900 font-geist">
              847
            </span>
          </div>
        </section>

        {/* Exploration Section */}
        <section id="studios" className="grid grid-cols-1 md:grid-cols-2 border-b border-black/10">
          {/* Left: Gallery */}
          <div className="md:p-12 overflow-hidden group border-black/10 border-r p-6 relative">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="bg-zinc-200 w-full h-64 md:h-80 relative overflow-hidden">
                <img 
                  src={currentProject.img1} 
                  className="w-full h-full object-cover grayscale opacity-90 group-hover:scale-105 transition-transform duration-700"
                  alt={currentProject.title}
                />
              </div>
              <div className="w-full h-64 md:h-80 relative overflow-hidden translate-y-8 bg-zinc-200">
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
            <h2 className="text-7xl md:text-9xl font-semibold tracking-tighter mb-4 text-zinc-900 font-geist">
              {currentProject.title}
            </h2>
            <h3 className="text-xl md:text-2xl font-semibold mb-4 text-zinc-600">
              {currentProject.subtitle}
            </h3>
            <p className="leading-relaxed md:text-base text-sm text-zinc-500 max-w-md mb-10">
              {currentProject.description}
            </p>

            <div className="flex items-center justify-between mt-auto pt-8 border-t border-black/10">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-semibold font-mono">
                  <span>{String(projectSlide + 1).padStart(2, '0')}</span>
                  <span className="text-base align-top ml-1 text-black/30">/ {String(explorationProjects.length).padStart(2, '0')}</span>
                </span>
                <div className="flex gap-2 ml-4">
                  <button 
                    onClick={prevProjectSlide}
                    className="flex transition hover:bg-black hover:text-white w-8 h-8 border-black/20 border rounded-full items-center justify-center text-black"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={nextProjectSlide}
                    className="flex transition hover:bg-black hover:text-white w-8 h-8 border-black/20 border rounded-full items-center justify-center text-black"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <a href="#waitlist" className="px-6 py-3 border text-sm font-medium transition-colors flex items-center gap-2 border-black/20 hover:bg-black hover:text-white">
                All Studios
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="relative border-b border-black/10">
          {/* Tabs */}
          <div className="absolute top-0 left-0 md:left-1/4 flex z-20">
            <button className="text-sm font-semibold border-r px-8 py-3 backdrop-blur-sm bg-white/50 border-black/10 text-zinc-900">
              AI Workflow
            </button>
            <button className="transition-colors text-sm font-semibold px-8 py-3 hover:text-black text-black/50">
              Traditional
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left Content */}
            <div className="md:p-12 md:pt-32 flex flex-col border-black/10 border-r pt-24 p-6 relative justify-center">
              <h2 className="md:text-7xl uppercase text-5xl font-bold tracking-tighter mb-8 text-zinc-900 font-geist">
                Process
              </h2>

              <div className="mb-12">
                <h4 className="text-xl font-semibold mb-2">AI-Powered Pipeline</h4>
                <h5 className="text-lg text-black/70 mb-6">From Brief to Campaign</h5>
                <p className="leading-relaxed text-sm text-zinc-500 max-w-sm">
                  Our AI handles the entire creative pipeline. From model generation to final campaign assets, 
                  we deliver photorealistic results in hours, not weeks.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-black/10">
                <div>
                  <p className="text-[10px] font-bold uppercase mb-1 text-sky-600">
                    Turnaround
                  </p>
                  <p className="text-2xl font-bold font-mono">24h</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase mb-1 text-sky-600">
                    Cost
                  </p>
                  <p className="text-2xl font-bold font-mono">-90%</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase mb-1 text-sky-600">
                    Variations
                  </p>
                  <p className="text-2xl font-bold font-mono">∞</p>
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
              <div className="absolute inset-0 bg-gradient-to-t to-transparent from-zinc-50/20" />
            </div>
          </div>
        </section>

        {/* Methodology Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 border-b relative group border-black/10 bg-zinc-50">
          {/* Left: Visual Content */}
          <div className="relative min-h-[500px] lg:min-h-[700px] border-r overflow-hidden border-black/10">
            <img 
              src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=2564&auto=format&fit=crop" 
              alt="Camera Lens" 
              className="absolute inset-0 w-full h-full object-cover grayscale opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t to-transparent from-zinc-50 via-zinc-50/20" />
            
            {/* Floating Data Card */}
            <div className="absolute bottom-8 left-8 right-8 md:left-12 md:right-auto md:w-80 backdrop-blur-xl border p-6 z-10 transition-colors duration-300 bg-white/80 border-black/10 hover:bg-white">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-black/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600">Current Tech</span>
                <Camera className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider font-semibold text-black/50">Engine: Flux Pro</p>
                <p className="text-lg font-medium tracking-tight">Photorealistic Generation</p>
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

              <p className="text-[10px] uppercase flex items-center gap-3 font-bold text-sky-600 tracking-[0.2em] mb-6">
                <span className="w-2 h-2 rounded-full bg-sky-600" />
                Vision
              </p>
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none mb-6 text-zinc-900 font-geist">
                Create, Scale & 
                <span className="text-black/30"> Deliver</span>
              </h2>
              <p className="leading-relaxed md:text-base text-sm text-zinc-500 max-w-md">
                AI photography is not just about generating images, but creating consistent brand identities. 
                We combine cutting-edge AI with creative direction to deliver campaign-ready assets.
              </p>
            </div>

            {/* Accordion / List Items */}
            <div className="border-t divide-y border-black/10 divide-black/10 bg-white">
              {/* Item 1 */}
              <a href="#" className="group block md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-xs transition-colors text-sky-600/50 group-hover:text-sky-600">01</span>
                    <div className="flex flex-col">
                      <h3 className="group-hover:text-black transition-colors text-lg font-medium text-black/80 tracking-tight">Model Creation</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform translate-y-2 group-hover:translate-y-0 text-black/40">Define characteristics and generate consistent AI models</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-black/10 group-hover:border-sky-600/50 group-hover:bg-sky-600/10">
                    <ArrowUpRight className="w-4 h-4 text-black/50 group-hover:text-sky-600" />
                  </div>
                </div>
              </a>

              {/* Item 2 */}
              <a href="#" className="group block p-6 md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-xs transition-colors text-sky-600/50 group-hover:text-sky-600">02</span>
                    <div className="flex flex-col">
                      <h3 className="group-hover:text-black transition-colors text-lg font-medium text-black/80 tracking-tight">Outfit Styling</h3>
                      <span className="group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform group-hover:translate-y-0 text-xs text-black/40 opacity-0 h-0 mt-1 translate-y-2">Generate any outfit on your AI models</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-black/10 group-hover:border-sky-600/50 group-hover:bg-sky-600/10">
                    <ArrowUpRight className="w-4 h-4 text-black/50 group-hover:text-sky-600" />
                  </div>
                </div>
              </a>

              {/* Item 3 */}
              <a href="#" className="group block p-6 md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-xs transition-colors text-sky-600/50 group-hover:text-sky-600">03</span>
                    <div className="flex flex-col">
                      <h3 className="text-lg font-medium tracking-tight group-hover:text-black transition-colors text-black/80">Campaign Production</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden transform translate-y-2 group-hover:translate-y-0 text-black/40">Full photoshoot generation with lighting control</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-black/10 group-hover:border-sky-600/50 group-hover:bg-sky-600/10">
                    <ArrowUpRight className="w-4 h-4 text-black/50 group-hover:text-sky-600" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Services Draggable Cards Section with Auto-Scroll */}
        <ServicesMarqueeSection />

        {/* Journal Section */}
        <section className="border-b border-black/10 bg-zinc-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-black/10">
            {/* Left: Featured Article */}
            <div className="group relative min-h-[600px] flex flex-col justify-end p-8 md:p-12 overflow-hidden cursor-pointer">
              <img 
                src="https://images.unsplash.com/photo-1452587925148-ce544e77e70d?q=80&w=2574&auto=format&fit=crop" 
                alt="Featured" 
                className="group-hover:opacity-80 group-hover:scale-105 transition-all duration-1000 ease-out opacity-60 w-full h-full object-cover absolute inset-0 grayscale"
              />
              <div className="bg-gradient-to-t to-transparent absolute inset-0 from-zinc-50 via-zinc-50/60" />
              
              <div className="relative z-10 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <div className="flex items-center gap-4 mb-6">
                  <span className="px-3 py-1 border text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm border-sky-500/30 bg-sky-500/10 text-sky-600">Featured</span>
                  <span className="text-xs font-mono tracking-tight text-black/50">FEB 02, 2026</span>
                </div>
                
                <h3 className="md:text-7xl uppercase text-5xl font-bold tracking-tighter mb-8 text-zinc-900 font-geist">
                  The Future of 
                  <span className="font-normal text-black/40"> AI Fashion</span>
                </h3>
                
                <p className="leading-relaxed line-clamp-2 md:text-lg text-zinc-600 max-w-md mb-8">
                  Exploring how AI is revolutionizing fashion photography and model casting, 
                  where digital innovation meets creative vision.
                </p>
                
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-colors text-black group-hover:text-sky-600">
                  Read Full Entry
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center group-hover:text-white transition-all duration-300 border-black/20 group-hover:bg-sky-600 group-hover:border-sky-600">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Editorial List */}
            <div className="flex flex-col h-full">
              <div className="p-8 md:p-12 border-b flex items-center justify-between bg-white/[0.02] border-black/10">
                <div>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase mb-2 text-zinc-900 font-geist">Journal</h2>
                  <p className="text-xs uppercase tracking-widest text-black/40">Behind the Scenes</p>
                </div>
                <a href="#" className="px-5 py-2.5 border text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 border-black/10 hover:bg-black hover:text-zinc-100">
                  Archive
                  <BookOpen className="w-3.5 h-3.5" />
                </a>
              </div>
              
              <div className="flex-1 divide-y divide-black/10">
                {journalEntries.map((entry, index) => (
                  <a key={index} href="#" className="group block p-8 md:px-12 transition-colors relative overflow-hidden hover:bg-black/5">
                    <div className="absolute right-0 top-0 bottom-0 w-1 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300 bg-sky-500" />
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600">{entry.category}</span>
                          <span className="w-1 h-1 rounded-full bg-black/20" />
                          <span className="text-[10px] uppercase tracking-widest text-black/40">{entry.type}</span>
                        </div>
                        <h4 className="text-xl md:text-2xl font-semibold mb-2 group-hover:text-black transition-colors text-black/90">{entry.title}</h4>
                        <p className="text-sm group-hover:text-black/70 transition-colors text-black/40">{entry.description}</p>
                      </div>
                      <div className="flex hidden md:flex transition-colors w-20 h-20 border items-center justify-center bg-black/5 border-black/10 group-hover:bg-sky-100 text-sky-600">
                        <Sparkles className="w-6 h-6" />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Waitlist Section */}
        <section id="waitlist" className="py-24 px-6 md:px-12 border-b border-black/10 bg-white">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[10px] uppercase flex items-center justify-center gap-3 font-bold text-sky-600 tracking-[0.2em] mb-6">
              <span className="w-2 h-2 rounded-full bg-sky-600" />
              Early Access
            </p>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-zinc-900 font-geist">
              Join the Waitlist
            </h2>
            <p className="text-lg text-zinc-500 mb-12 max-w-md mx-auto">
              Be among the first to experience AI-powered fashion photography. 
              Limited spots available for our beta launch.
            </p>

            {!submitted && !alreadyRegistered ? (
              <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
                <Input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border rounded px-4 py-3 text-sm placeholder-zinc-400 focus:outline-none focus:bg-white w-full transition-all bg-zinc-50 border-black/10 text-black focus:border-sky-500"
                  required
                />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border rounded px-4 py-3 text-sm placeholder-zinc-400 focus:outline-none focus:bg-white w-full transition-all bg-zinc-50 border-black/10 text-black focus:border-sky-500"
                  required
                />
                <Button 
                  type="submit" 
                  disabled={joinWaitlist.isPending}
                  className="w-full font-semibold text-sm px-6 py-3 rounded transition-colors text-white bg-zinc-900 hover:bg-zinc-800"
                >
                  {joinWaitlist.isPending ? "Joining..." : "Get Early Access"}
                </Button>
              </form>
            ) : (
              <div className="text-center p-8 border border-sky-500/20 bg-sky-500/5 rounded">
                <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-2 text-zinc-900">
                  {alreadyRegistered ? "You're already on the list!" : "You're on the list!"}
                </h3>
                <p className="text-zinc-500">
                  {position && `You're #${position} in line. We'll be in touch soon.`}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <section className="overflow-hidden pt-32 pb-12 relative">
          <div className="md:px-12 flex flex-col md:flex-row z-10 mb-16 px-6 relative gap-12 items-end justify-between">
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

            <div className="text-right">
              <p className="text-sm font-semibold mb-4 text-zinc-900">
                Connect:
              </p>
              <div className="flex gap-4 justify-end">
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-black/5 hover:bg-black hover:text-white">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-black/5 hover:bg-black hover:text-white">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-black/5 hover:bg-black hover:text-white">
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Navigation Bar */}
          <div className="md:px-12 border-t pt-16 px-6 pb-8 backdrop-blur-md bg-zinc-100/50 border-black/10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12 max-w-7xl mx-auto">
              {/* Brand & Newsletter */}
              <div className="space-y-6">
                <a href="#" className="inline-flex items-center gap-2 font-bold tracking-tighter text-2xl font-geist">
                  <span className="w-6 h-6 rounded flex items-center justify-center text-sm text-white bg-zinc-900">F</span>
                  FORMA
                </a>
                <p className="text-sm leading-relaxed max-w-xs text-zinc-500">
                  AI-powered fashion photography. Create stunning campaign assets without traditional photoshoots.
                </p>
                <div className="pt-2">
                  <p className="text-xs font-semibold mb-2 text-black">Subscribe for updates</p>
                  <form className="flex gap-2">
                    <input 
                      type="email" 
                      placeholder="Email address" 
                      className="border rounded px-3 py-2 text-xs placeholder-zinc-400 focus:outline-none focus:bg-white w-full transition-all bg-white border-black/10 text-black focus:border-sky-500"
                    />
                    <button type="submit" className="font-semibold text-xs px-4 py-2 rounded transition-colors text-white bg-zinc-900 hover:bg-zinc-800">
                      Join
                    </button>
                  </form>
                </div>
              </div>

              {/* Links Column 1 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-black">Studios</h4>
                <ul className="space-y-3 text-sm text-zinc-500">
                  <li><a href="#" className="transition-colors block hover:text-sky-600">Casting Studio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-sky-600">Outfit Studio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-sky-600">Photo Studio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-sky-600">Campaign Builder</a></li>
                </ul>
              </div>

              {/* Links Column 2 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-black">Company</h4>
                <ul className="space-y-3 text-sm text-zinc-500">
                  <li><a href="#" className="transition-colors block hover:text-sky-600">About FormaStudio</a></li>
                  <li><a href="#" className="transition-colors block hover:text-sky-600">Technology</a></li>
                  <li><a href="#" className="transition-colors block hover:text-sky-600">Case Studies</a></li>
                  <li><a href="#" className="transition-colors block hover:text-sky-600">Pricing</a></li>
                </ul>
              </div>

              {/* Links Column 3 */}
              <div>
                <h4 className="text-sm font-semibold mb-6 tracking-wide text-black">Contact</h4>
                <ul className="space-y-3 text-sm text-zinc-500">
                  <li>
                    <a href="#" className="transition-colors flex items-center gap-2 hover:text-sky-600">
                      <MapPin className="w-3.5 h-3.5" />
                      San Francisco, CA
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors flex items-center gap-2 hover:text-sky-600">
                      <Calendar className="w-3.5 h-3.5" />
                      Book a Demo
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors flex items-center gap-2 hover:text-sky-600">
                      <Mail className="w-3.5 h-3.5" />
                      hello@formastudio.ai
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto border-black/10">
              <p className="text-xs text-zinc-400">
                © 2026 FormaStudio. All rights reserved.
              </p>
              <div className="flex items-center gap-6 text-xs text-zinc-400">
                <a href="#" className="transition-colors hover:text-black">Privacy Policy</a>
                <a href="#" className="transition-colors hover:text-black">Terms of Service</a>
                <a href="#" className="transition-colors hover:text-black">Sitemap</a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
