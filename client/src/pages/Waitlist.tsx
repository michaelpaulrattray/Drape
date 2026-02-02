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
    tag: "Casting Studio",
    title: "Design Your Model",
    description: "Create unique AI characters with our zero-prompt creative tools.",
  },
  {
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2564&auto=format&fit=crop",
    tag: "4K Fidelity",
    title: "Extreme Detail",
    description: "High-fidelity output that rivals professional photography.",
  },
  {
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=2574&auto=format&fit=crop",
    tag: "Model Passport",
    title: "Own Your Creation",
    description: "Claim legal ownership over your AI model with a digital passport.",
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
    title: "Casting Studio",
    description: "Design your AI model from scratch. Our zero-prompt tools let you craft unique characters with complete creative control.",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/1445aeb2-ddb4-4e4d-a151-c96381893f07_1600w.jpg",
  },
  {
    number: "02",
    title: "Model Passport",
    description: "Claim legal ownership over your AI creation. Your model, your rights—protected and documented.",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/04ff5a45-5b01-4b68-a092-f3ec2da28b5e_1600w.jpg",
  },
  {
    number: "03",
    title: "Wardrobe Studio",
    description: "Outfit your model in any style. From streetwear to haute couture—no physical samples needed.",
    image: "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/f365bf31-c2fb-44c2-a24a-c78fedc640ba_1600w.jpg",
  },
  {
    number: "04",
    title: "Campaign Generator",
    description: "Generate photoshoots, product shots, and full campaigns. 4K fidelity with perfect character consistency.",
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
    <section className="border-t border-b border-black/10 bg-white py-24 overflow-hidden">
      <div className="px-6 md:px-12 mb-16 md:mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-500 font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              
            </span>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-zinc-900 font-geist">
              Your Creative <br/><span className="text-zinc-400">Studio Suite.</span>
            </h2>
          </div>
          <div className="lg:pl-12">
            <p className="text-lg md:text-xl font-light text-zinc-600 leading-relaxed">
              From character design to campaign delivery. Zero prompts, maximum fidelity—unique tools built for the creative process.
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
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-6 md:px-12 md:py-8 flex justify-between items-center mix-blend-difference text-white pointer-events-none">
        <a href="#" className="group flex items-center gap-2 text-2xl md:text-3xl tracking-tight font-normal pointer-events-auto font-geist">
          <span className="border-b border-white pb-0.5 group-hover:border-transparent transition-colors duration-300">forma</span>
          <span>studio</span>
        </a>

        {/* Desktop Menu */}
        <div className="flex items-center pointer-events-auto">
          <a 
            href="#waitlist" 
            className="px-5 py-2 rounded-full border border-white/20 hover:bg-white hover:text-black transition-all duration-300 text-sm font-medium uppercase tracking-wide backdrop-blur-sm"
          >
            Join Waitlist
          </a>
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
                <span className="text-sky-500 text-6xl align-top">Studio</span>
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

        {/* Services Draggable Cards Section with Auto-Scroll */}
        <ServicesMarqueeSection />

        {/* Video Demo Section */}
        <section className="py-24 px-6 md:px-12 bg-white border-b border-black/10 relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-white to-zinc-50 opacity-50" />
          
          <div className="max-w-6xl mx-auto relative z-10">
            {/* Section Header */}
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-500 font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                How It Works
              </span>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 text-zinc-900 font-geist">
                Design. Own. <span className="text-zinc-400">Create.</span>
              </h2>
              <p className="text-lg text-zinc-500 font-light max-w-xl mx-auto">
                A creative journey from character design to campaign-ready content—zero prompts, maximum fidelity.
              </p>
            </div>

            {/* Video Container */}
            <div className="relative group">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500/20 via-sky-400/10 to-sky-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              {/* Video wrapper */}
              <div className="relative bg-zinc-900 rounded-xl border border-black/10 overflow-hidden shadow-2xl">
                {/* Browser-style header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 bg-zinc-700 rounded-md text-xs text-zinc-400 font-mono">
                      formastudio.ai/studio
                    </div>
                  </div>
                </div>
                
                {/* Video content */}
                <div className="relative aspect-video bg-zinc-900">
                  <video 
                    className="w-full h-full object-cover"
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    poster="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2564&auto=format&fit=crop"
                  >
                    <source src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/demo-workflow.mp4" type="video/mp4" />
                  </video>
                  
                  {/* Overlay with workflow steps */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent pointer-events-none" />
                  
                  {/* Workflow steps indicator */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                    <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
                      <div className="flex items-center gap-2 text-white/90">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-sky-500/20 border border-sky-500/50 flex items-center justify-center">
                          <span className="text-sky-400 font-bold text-xs md:text-sm">1</span>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-sm font-medium">Design Model</p>
                          <p className="text-xs text-zinc-400">Casting Studio</p>
                        </div>
                      </div>
                      
                      <div className="w-4 md:w-6 h-px bg-gradient-to-r from-sky-500/50 to-sky-400/50" />
                      
                      <div className="flex items-center gap-2 text-white/90">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-sky-500/20 border border-sky-500/50 flex items-center justify-center">
                          <span className="text-sky-400 font-bold text-xs md:text-sm">2</span>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-sm font-medium">Claim Passport</p>
                          <p className="text-xs text-zinc-400">Legal Ownership</p>
                        </div>
                      </div>
                      
                      <div className="w-4 md:w-6 h-px bg-gradient-to-r from-sky-400/50 to-sky-500/50" />
                      
                      <div className="flex items-center gap-2 text-white/90">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-sky-500/20 border border-sky-500/50 flex items-center justify-center">
                          <span className="text-sky-400 font-bold text-xs md:text-sm">3</span>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-sm font-medium">Wardrobe Studio</p>
                          <p className="text-xs text-zinc-400">Outfit Your Model</p>
                        </div>
                      </div>
                      
                      <div className="w-4 md:w-6 h-px bg-gradient-to-r from-sky-500/50 to-sky-400/50" />
                      
                      <div className="flex items-center gap-2 text-white/90">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-sky-500/20 border border-sky-500/50 flex items-center justify-center">
                          <span className="text-sky-400 font-bold text-xs md:text-sm">4</span>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-sm font-medium">Generate</p>
                          <p className="text-xs text-zinc-400">Campaigns & Shoots</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-black/10">
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-zinc-900 tracking-tighter">4K<span className="text-sky-500">+</span></p>
                <p className="text-sm text-zinc-500 mt-2">Photorealism</p>
              </div>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-zinc-900 tracking-tighter">0</p>
                <p className="text-sm text-zinc-500 mt-2">Prompts Required</p>
              </div>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-zinc-900 tracking-tighter">∞</p>
                <p className="text-sm text-zinc-500 mt-2">Campaigns</p>
              </div>
            </div>
          </div>
        </section>

        {/* Creative Power, Unbound Section */}
        <section className="py-24 px-6 md:px-12 bg-white border-b border-black/10" id="benefits">
          <div className="max-w-[1400px] mx-auto">
            
            <div className="mb-20 max-w-2xl">
              <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-zinc-900 font-geist">
                Creative power, <span className="text-zinc-400">unbound.</span>
              </h2>
              <p className="text-xl text-zinc-500 font-light leading-relaxed">
                Design once, generate forever. Our high-fidelity tools give you complete creative control—no prompts, no compromises.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Large Card Left (AI That Knows You) */}
              <div className="lg:col-span-5 group relative min-h-[640px] bg-zinc-50 border border-black/10 rounded-lg hover:border-sky-500/50 transition-all duration-500 overflow-hidden flex flex-col justify-between p-10">
                {/* Background Gradient Hint */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/80 z-0 pointer-events-none"></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.6)] animate-pulse"></span>
                    <span className="uppercase text-xs font-bold tracking-[0.2em] text-zinc-500">Zero Prompt</span>
                  </div>
                  <h3 className="text-4xl md:text-5xl font-geist font-semibold text-zinc-900 tracking-tighter mb-4 leading-[0.95]">Pure Creation</h3>
                  <p className="text-lg text-zinc-500 font-light leading-relaxed max-w-sm">
                    No prompts. No guesswork. Our intuitive tools let you design and refine your AI model with complete creative freedom.
                  </p>
                </div>
                
                <div className="absolute bottom-0 left-0 w-full h-[55%] z-0 rounded-b-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-zinc-50/20 to-transparent z-10"></div>
                  <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/f36259a7-cc94-4846-8290-2df52026731d_original.gif" className="w-full h-full object-cover opacity-70 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700 ease-out grayscale group-hover:grayscale-0" alt="AI Gen" />
                </div>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-7 flex flex-col gap-6 h-full">
                
                {/* Wide Card (Perfect Consistency) */}
                <div className="group relative bg-zinc-50 border border-black/10 rounded-lg p-10 hover:border-sky-500/50 transition-all duration-500 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="relative z-10 flex-1">
                    <h3 className="md:text-5xl leading-[0.95] text-4xl text-zinc-900 tracking-tighter font-geist font-semibold mb-4">Character Lock</h3>
                    <p className="text-lg text-zinc-500 font-light leading-relaxed">
                      Same face, same features, same identity—across 10,000 images. Your AI model never drifts.
                    </p>
                  </div>
                  <div className="relative w-full md:w-48 h-48 flex-shrink-0 rounded-lg overflow-hidden border border-black/10 group-hover:border-sky-500/30 transition-colors">
                    <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/ebfeb48e-4108-49c6-86a2-a1491f93b564_original.gif" className="transition-all duration-700 ease-in-out w-full h-full object-cover grayscale group-hover:grayscale-0" alt="Consistency" />
                  </div>
                </div>

                {/* Split Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                  
                  {/* Cost Efficiency */}
                  <div className="group relative bg-zinc-50 border border-black/10 rounded-lg p-10 hover:border-sky-500/50 transition-all duration-500 flex flex-col justify-between min-h-[320px] overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-3xl font-medium text-zinc-900 mb-2 tracking-tight">4K Fidelity</h3>
                      <p className="text-base text-zinc-400 font-light">Every detail. Every texture.</p>
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-baseline gap-1 mb-5">
                        <span className="text-7xl font-semibold text-zinc-900 tracking-tighter">4K</span>
                        <span className="text-3xl text-sky-500 font-medium">+</span>
                      </div>
                      <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 w-[15%] group-hover:w-[100%] transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                      </div>
                    </div>
                  </div>

                  {/* Hyper Speed */}
                  <div className="group relative bg-zinc-50 border border-black/10 rounded-lg p-10 hover:border-sky-500/50 transition-all duration-500 flex flex-col justify-between min-h-[320px] overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-3xl font-medium text-zinc-900 mb-2 tracking-tight">Instant Scale</h3>
                      <p className="text-base text-zinc-400 font-light">1 to 10,000 images. Same day.</p>
                    </div>
                    
                    <div className="relative z-10 flex items-end">
                      <div className="flex items-center gap-3 bg-white border border-black/10 rounded-full pl-5 pr-6 py-3 shadow-lg group-hover:border-sky-500/30 transition-colors">
                        <div className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                        </div>
                        <span className="text-sm font-mono text-zinc-600 tracking-wide">Rendering...</span>
                      </div>
                    </div>
                  </div>

                </div>
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
              Design Your First Model
            </h2>
            <p className="text-lg text-zinc-500 mb-12 max-w-md mx-auto">
              Zero prompts. 4K fidelity. Perfect consistency. Be among the first to create and own AI models with our unique creative tools.
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
