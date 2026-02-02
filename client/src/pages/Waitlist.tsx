import { useState } from "react";
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
} from "lucide-react";
import { Link } from "wouter";

// Hero slides data
const heroSlides = [
  {
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2564&auto=format&fit=crop",
    tag: "AI Generated",
    title: "The Human Gaze",
    description: "Photorealistic AI model generation.",
  },
  {
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=2574&auto=format&fit=crop",
    tag: "Campaign",
    title: "Brand Identity",
    description: "Consistent model personas for your brand.",
  },
  {
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=2574&auto=format&fit=crop",
    tag: "Editorial",
    title: "Fashion Forward",
    description: "High-fashion AI photography.",
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
];

// Benefits data
const benefits = [
  {
    icon: "trophy",
    category: "Cost Savings",
    title: "90% Lower Production Costs",
    link: "Calculate savings",
  },
  {
    icon: "clock",
    category: "Speed",
    title: "24-Hour Turnaround",
    link: "See workflow",
  },
  {
    icon: "globe",
    category: "Scale",
    title: "Unlimited Variations",
    link: "View examples",
  },
  {
    icon: "shield",
    category: "Rights",
    title: "Full Commercial License",
    link: "Read terms",
  },
];

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [projectIndex, setProjectIndex] = useState(0);
  const [navOpen, setNavOpen] = useState(false);

  const { data: stats } = trpc.waitlist.getStats.useQuery();
  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setPosition(data.position ?? null);
      setAlreadyRegistered(data.alreadyRegistered);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    joinMutation.mutate({ email, name: name || undefined, source: "landing_page" });
  };

  const nextHeroSlide = () => setHeroSlide((prev) => (prev + 1) % heroSlides.length);
  const prevHeroSlide = () => setHeroSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  const nextProject = () => setProjectIndex((prev) => (prev + 1) % explorationProjects.length);
  const prevProject = () => setProjectIndex((prev) => (prev - 1 + explorationProjects.length) % explorationProjects.length);

  const currentProject = explorationProjects[projectIndex];

  return (
    <div className="min-h-screen overflow-x-hidden selection:bg-sky-500 selection:text-white relative text-zinc-900 bg-zinc-50">
      {/* Background Grid Lines */}
      <div className="fixed pointer-events-none z-0 inset-0 overflow-hidden">
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
      <nav className="flex md:px-12 z-50 border-b pt-6 pr-6 pb-6 pl-6 relative items-center justify-between border-black/5 bg-zinc-50/80 backdrop-blur-md">
        <Link href="/">
          <a className="inline-flex items-center gap-2 font-bold tracking-tighter text-2xl">
            <span className="w-6 h-6 rounded flex items-center justify-center text-sm text-white bg-zinc-900">F</span>
            FORMA
          </a>
        </Link>

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
              <a href="#studios" className="block px-6 py-3 text-sm font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-sky-600">Casting Studio</a>
              <a href="#studios" className="block px-6 py-3 text-sm font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-sky-600">Outfit Studio</a>
              <a href="#studios" className="block px-6 py-3 text-sm font-medium transition-colors tracking-wide border-b text-black/70 hover:bg-black/5 border-black/5 hover:text-sky-600">Photo Studio</a>
              <a href="#waitlist-form" className="block px-6 py-3 text-sm font-medium transition-colors tracking-wide text-black/70 hover:bg-black/5 hover:text-sky-600">Get Early Access</a>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="z-10 relative">
        {/* Hero Section */}
        <section className="md:pt-24 md:pb-32 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-0 border-b pt-16 pr-6 pb-20 pl-6 relative border-black/10">
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
                AI-First Creative Studio
              </p>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-none mb-4">
                FORMA
                <span className="text-sky-500 text-6xl align-top">+</span>
              </h1>
              <div className="h-px w-full bg-gradient-to-r to-transparent my-6 from-black/20" />
            </div>

            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="group cursor-pointer">
                <Camera className="text-4xl mb-4 w-9 h-9 group-hover:text-sky-600 transition-colors text-zinc-800" />
                <h3 className="text-sm font-semibold leading-tight mb-2">
                  AI Model
                  <br />
                  Generation
                </h3>
                <div className="w-4 h-0.5 group-hover:w-8 transition-all bg-sky-500" />
              </div>
              <div className="group cursor-pointer">
                <ImageIcon className="text-4xl mb-4 w-9 h-9 group-hover:text-sky-600 transition-colors text-zinc-800" />
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
              <a href="#waitlist-form" className="flex items-center gap-2 transition-colors hover:text-black">
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
                      <h3 className="text-2xl font-semibold tracking-tight mb-1 text-white">{slide.title}</h3>
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
                    className="w-10 h-10 rounded-full border backdrop-blur-xl flex items-center justify-center transition-all duration-300 shadow-lg border-white/10 bg-black/50 text-white hover:bg-white hover:text-black"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={nextHeroSlide}
                    className="w-10 h-10 rounded-full border backdrop-blur-xl flex items-center justify-center transition-all duration-300 shadow-lg border-white/10 bg-black/50 text-white hover:bg-white hover:text-black"
                  >
                    <ArrowRight className="w-4 h-4" />
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
            <span className="text-6xl md:text-8xl font-bold tracking-tighter text-zinc-900">
              {stats?.displayCount || 847}
            </span>
          </div>
        </section>

        {/* Exploration Section */}
        <section id="studios" className="grid grid-cols-1 md:grid-cols-2 border-b border-black/10">
          {/* Left: Gallery */}
          <div className="md:p-12 overflow-hidden group border-black/10 border-r pt-6 pr-6 pb-6 pl-6 relative">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="bg-zinc-200 w-full h-64 md:h-80 relative overflow-hidden">
                <img 
                  src={currentProject.img1} 
                  className="w-full h-full object-cover grayscale opacity-90 group-hover:scale-105 transition-transform duration-700"
                  alt=""
                />
              </div>
              <div className="w-full h-64 md:h-80 relative overflow-hidden translate-y-8 bg-zinc-200">
                <img 
                  src={currentProject.img2} 
                  className="w-full h-full object-cover grayscale opacity-90 group-hover:scale-105 transition-transform duration-700 delay-75"
                  alt=""
                />
              </div>
            </div>
          </div>

          {/* Right: Text Content */}
          <div className="md:p-12 flex flex-col pt-6 pr-6 pb-6 pl-6 justify-center">
            <h2 className="text-7xl md:text-9xl font-semibold tracking-tighter mb-4 text-zinc-900">
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
                  <span>{String(projectIndex + 1).padStart(2, '0')}</span>
                  <span className="text-base align-top ml-1 text-black/30">/ {String(explorationProjects.length).padStart(2, '0')}</span>
                </span>
                <div className="flex gap-2 ml-4">
                  <button 
                    onClick={prevProject}
                    className="flex transition hover:bg-black hover:text-white w-8 h-8 border-black/20 border rounded-full items-center justify-center text-black"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={nextProject}
                    className="flex transition hover:bg-black hover:text-white w-8 h-8 border-black/20 border rounded-full items-center justify-center text-black"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <a href="#waitlist-form" className="px-6 py-3 border text-sm font-medium transition-colors flex items-center gap-2 border-black/20 hover:bg-black hover:text-white">
                Get Access
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="relative border-b border-black/10">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left Content */}
            <div className="md:p-12 md:pt-24 flex flex-col border-black/10 border-r pt-16 pr-6 pb-6 pl-6 relative justify-center">
              <h2 className="md:text-7xl uppercase text-5xl font-bold tracking-tighter mb-8 text-zinc-900">
                Process
              </h2>

              <div className="mb-12">
                <h4 className="text-xl font-semibold mb-2">AI-First Workflow</h4>
                <h5 className="text-lg text-black/70 mb-6">From Brief to Campaign</h5>
                <p className="leading-relaxed text-sm text-zinc-500 max-w-sm">
                  Share your vision in a 15-minute sync. We digest your brand guidelines, goals, and aesthetic preferences to build a custom AI model that understands your visual language.
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
                alt=""
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
              alt="Camera" 
              className="absolute inset-0 w-full h-full object-cover grayscale opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t to-transparent from-zinc-50 via-zinc-50/20" />
            
            {/* Floating Data Card */}
            <div className="absolute bottom-8 left-8 right-8 md:left-12 md:right-auto md:w-80 backdrop-blur-xl border p-6 z-10 transition-colors duration-300 bg-white/80 border-black/10 hover:bg-white">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-black/10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600">AI Engine</span>
                <Sparkles className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider font-semibold text-black/50">Model: FormaGen v2</p>
                <p className="text-lg font-medium tracking-tight">Photorealistic Output</p>
              </div>
            </div>
          </div>

          {/* Right: Philosophy & Interactive List */}
          <div className="flex flex-col">
            {/* Header */}
            <div className="p-8 md:p-16 flex-1 flex flex-col justify-center relative">
              <p className="text-[10px] uppercase flex items-center gap-3 font-bold text-sky-600 tracking-[0.2em] mb-6">
                <span className="w-2 h-2 rounded-full bg-sky-600" />
                Vision
              </p>
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none mb-6 text-zinc-900">
                Cast, Style & 
                <span className="text-black/30"> Generate</span>
              </h2>
              <p className="leading-relaxed md:text-base text-sm text-zinc-500 max-w-md">
                FormaStudio streamlines your creative workflow. From AI model casting to final campaign assets, we handle the entire production pipeline.
              </p>
            </div>

            {/* Accordion / List Items */}
            <div className="border-t divide-y border-black/10 divide-black/10 bg-white">
              <a href="#studios" className="group block md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5 pt-6 pr-6 pb-6 pl-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="text-xs font-mono text-sky-600">01</span>
                    <div className="flex flex-col">
                      <h3 className="text-lg font-medium tracking-tight group-hover:text-black transition-colors text-black/80">Casting Studio</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden text-black/40">Generate unique AI model identities</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-black/10 group-hover:border-sky-600/50 group-hover:bg-sky-600/10">
                    <ArrowUpRight className="w-4 h-4 text-black/50 group-hover:text-sky-600" />
                  </div>
                </div>
              </a>

              <a href="#studios" className="group block md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5 pt-6 pr-6 pb-6 pl-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="text-xs font-mono text-sky-600">02</span>
                    <div className="flex flex-col">
                      <h3 className="text-lg font-medium tracking-tight group-hover:text-black transition-colors text-black/80">Outfit Studio</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden text-black/40">Style models with any outfit</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all border-black/10 group-hover:border-sky-600/50 group-hover:bg-sky-600/10">
                    <ArrowUpRight className="w-4 h-4 text-black/50 group-hover:text-sky-600" />
                  </div>
                </div>
              </a>

              <a href="#studios" className="group block md:px-12 md:py-8 transition-colors duration-300 hover:bg-black/5 pt-6 pr-6 pb-6 pl-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className="text-xs font-mono text-sky-600">03</span>
                    <div className="flex flex-col">
                      <h3 className="text-lg font-medium tracking-tight group-hover:text-black transition-colors text-black/80">Photo Studio</h3>
                      <span className="text-xs mt-1 opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto transition-all duration-300 overflow-hidden text-black/40">Generate campaign-ready photoshoots</span>
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

        {/* Benefits Section */}
        <section className="border-b border-black/10">
          <div className="px-6 md:px-12 py-16 flex flex-col md:flex-row items-start md:items-end justify-between border-b border-black/10 gap-4">
            <h2 className="text-6xl md:text-7xl font-bold tracking-tighter uppercase text-zinc-900">
              Benefits
            </h2>
            <a href="#waitlist-form" className="px-6 py-3 border text-sm font-medium transition-colors flex items-center gap-2 border-black/20 hover:bg-black hover:text-white">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black/10">
            {benefits.map((benefit, index) => (
              <div key={index} className="group transition-colors cursor-pointer hover:bg-black/5 pt-8 pr-8 pb-8 pl-8">
                <div className="flex h-40 border-b mb-6 items-center justify-center border-black/10">
                  <div className="text-6xl group-hover:scale-110 transition-transform duration-300 text-zinc-800">
                    {benefit.icon === "trophy" && "🏆"}
                    {benefit.icon === "clock" && "⚡"}
                    {benefit.icon === "globe" && "🌐"}
                    {benefit.icon === "shield" && "🛡️"}
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase mb-2 text-sky-600">
                  {benefit.category}
                </p>
                <h3 className="leading-tight transition-colors text-xl font-semibold mb-6 text-zinc-900">
                  {benefit.title}
                </h3>
                <div className="flex items-center text-xs font-medium group-hover:text-black transition-colors text-black/50">
                  {benefit.link}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Waitlist Section */}
        <section id="waitlist-form" className="border-b border-black/10 bg-zinc-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-black/10">
            {/* Left: Form */}
            <div className="p-8 md:p-16 flex flex-col justify-center">
              <p className="text-[10px] uppercase flex items-center gap-3 font-bold text-sky-600 tracking-[0.2em] mb-6">
                <span className="w-2 h-2 rounded-full bg-sky-600" />
                Early Access
              </p>
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter leading-none mb-6 text-zinc-900">
                Join the 
                <span className="text-black/30"> Waitlist</span>
              </h2>
              <p className="leading-relaxed md:text-base text-sm text-zinc-500 max-w-md mb-8">
                Be among the first to access FormaStudio. Early members get exclusive pricing and priority onboarding.
              </p>

              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400"
                  />
                  <Input
                    type="email"
                    placeholder="Your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400"
                  />
                  <Button
                    type="submit"
                    disabled={joinMutation.isPending}
                    className="w-full h-12 bg-zinc-900 text-white hover:bg-zinc-800 font-medium"
                  >
                    {joinMutation.isPending ? "Joining..." : "Get Early Access"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              ) : (
                <div className="p-6 border border-sky-600/20 bg-sky-600/5 rounded-lg max-w-md">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900">
                      {alreadyRegistered ? "Already on the list!" : "You're on the list!"}
                    </h3>
                  </div>
                  <p className="text-sm text-zinc-600">
                    {position && `You're #${position} on the waitlist. `}
                    We'll be in touch soon with exclusive early access.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Image */}
            <div className="relative min-h-[400px] lg:min-h-[600px] overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2670&auto=format&fit=crop" 
                alt="Fashion" 
                className="absolute inset-0 w-full h-full object-cover grayscale opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t to-transparent from-zinc-50 via-zinc-50/20" />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 md:px-12 py-12 bg-zinc-50">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <Link href="/">
                <a className="inline-flex items-center gap-2 font-bold tracking-tighter text-2xl mb-4">
                  <span className="w-6 h-6 rounded flex items-center justify-center text-sm text-white bg-zinc-900">F</span>
                  FORMA
                </a>
              </Link>
              <p className="text-sm text-zinc-500 max-w-xs">
                AI-first creative studio for fashion and commercial photography.
              </p>
            </div>

            <div className="flex gap-8 text-sm text-zinc-600">
              <a href="#" className="hover:text-black transition-colors">Twitter</a>
              <a href="#" className="hover:text-black transition-colors">Instagram</a>
              <a href="#" className="hover:text-black transition-colors">LinkedIn</a>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-black/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-zinc-400">
            <p>© 2024 FormaStudio. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-black transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-black transition-colors">Terms of Service</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
