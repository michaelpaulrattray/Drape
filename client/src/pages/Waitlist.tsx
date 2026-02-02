import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Check, Mail, MapPin, Sparkles } from "lucide-react";

export default function Waitlist() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    interest: "Casting Studio",
    company: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [activeProcess, setActiveProcess] = useState(1);

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;
    joinWaitlist.mutate(formData);
  };

  // Process section scroll observer
  useEffect(() => {
    const processSteps = document.querySelectorAll('.process-step');
    
    const observerOptions = {
      root: null,
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const step = entry.target.getAttribute('data-step');
          if (step) {
            setActiveProcess(parseInt(step));
          }
        }
      });
    }, observerOptions);

    processSteps.forEach(step => observer.observe(step));

    return () => observer.disconnect();
  }, []);

  // Dynamic time
  const [currentTime, setCurrentTime] = useState("");
  const [location, setLocation] = useState("Global");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    };
    
    const updateLocation = () => {
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const locationName = timeZone ? timeZone.split('/').pop()?.replace(/_/g, ' ') || 'Global' : 'Global';
        setLocation(locationName);
      } catch {
        setLocation('Earth');
      }
    };

    updateClock();
    updateLocation();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Draggable marquee
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!marqueeRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - marqueeRef.current.offsetLeft);
    setScrollLeft(marqueeRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !marqueeRef.current) return;
    e.preventDefault();
    const x = e.pageX - marqueeRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    marqueeRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => setIsDragging(false);

  const processSteps = [
    {
      step: 1,
      title: "Cast Your Model",
      description: "Define your ideal model's characteristics—age, ethnicity, features, and brand aesthetic. Our AI generates a unique, consistent identity you can use across all campaigns.",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
      cta: "Start casting"
    },
    {
      step: 2,
      title: "Style & Outfit",
      description: "Dress your AI model in any outfit from your catalog or generate new looks. Perfect for e-commerce, lookbooks, and fashion campaigns without physical samples.",
      image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
      cta: "See examples"
    },
    {
      step: 3,
      title: "Generate Campaign",
      description: "Create full photoshoots in any environment—studio, outdoor, lifestyle. Export high-resolution assets ready for print, web, and social media.",
      image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80",
      cta: "Scale now"
    }
  ];

  const services = [
    {
      title: "Casting Studio",
      description: "Create photorealistic AI models with precise control over demographics, features, and brand aesthetics.",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80"
    },
    {
      title: "Outfit Studio",
      description: "Dress your AI models in any outfit. Mix and match styles for endless creative possibilities.",
      image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80"
    },
    {
      title: "Photo Studio",
      description: "Generate campaign-ready photoshoots with your models, products, and custom environments.",
      image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80"
    },
    {
      title: "Social Content",
      description: "Never run dry on content. Deploy daily on-brand social posts that engage your audience.",
      image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=80"
    }
  ];

  return (
    <div className="bg-zinc-950 text-zinc-100 antialiased selection:bg-orange-500/30 selection:text-orange-200 relative overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-6 md:px-12 md:py-8 flex justify-between items-center mix-blend-difference text-white pointer-events-none">
        <Link href="/" className="group flex items-center gap-1 text-2xl md:text-3xl tracking-tight font-normal pointer-events-auto font-instrument">
          <span className="border-b border-white pb-0.5 group-hover:border-transparent transition-colors duration-300">Forma</span>
          <span>Studio</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 lg:gap-12 pointer-events-auto">
          <a href="#services" className="text-sm font-medium uppercase tracking-wide hover:text-zinc-300 transition-colors">Services</a>
          <a href="#process" className="text-sm font-medium uppercase tracking-wide hover:text-zinc-300 transition-colors">Process</a>
          <a href="#contact" className="text-sm font-medium uppercase tracking-wide hover:text-zinc-300 transition-colors">Contact</a>
          <a href="#contact" className="px-5 py-2 rounded-full border border-white/20 hover:bg-white hover:text-black transition-all duration-300 text-sm font-medium uppercase tracking-wide backdrop-blur-sm">Join Waitlist</a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative w-full h-screen overflow-hidden bg-black">
        {/* Video/Image Background */}
        <div className="absolute inset-0 w-full h-full">
          <img 
            src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80" 
            alt="Fashion photography"
            className="w-full h-full object-cover opacity-60 scale-105"
          />
        </div>

        <div className="bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent absolute inset-0" />

        <div className="absolute bottom-0 left-0 w-full px-6 py-12 md:px-12 md:py-20 flex flex-col md:flex-row justify-between items-end">
          <div className="max-w-3xl fade-in-up">
            <h1 className="text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight font-instrument mb-8">
              Scale Visual Content{" "}
              <span className="text-zinc-500">Without Scaling Teams</span>
            </h1>
            <div className="flex flex-col md:flex-row gap-6 md:items-center text-lg font-light text-zinc-300">
              <p className="max-w-md leading-relaxed text-zinc-400 text-base md:text-lg">
                We blend high-end art direction with intelligent AI to generate on-demand visuals that keep your business moving.
              </p>
              <a href="#contact" className="group flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition-colors shrink-0">
                Join Waitlist
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end gap-4 text-right">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span>Now accepting clients</span>
            </div>
          </div>
        </div>
      </header>

      {/* Services Section - Draggable Marquee */}
      <section className="py-24 px-6 md:px-12 bg-zinc-950 border-b border-zinc-900/50" id="services">
        <div className="max-w-[1800px] mx-auto mb-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1 mb-6 tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Services
              </div>
              <h2 className="text-4xl md:text-6xl lg:text-7xl font-instrument text-white tracking-tight">
                Everything you need<br />
                <span className="text-zinc-600">to create without limits.</span>
              </h2>
            </div>
            <p className="text-zinc-500 text-sm uppercase tracking-wider hidden md:block">Drag to explore →</p>
          </div>
        </div>

        {/* Draggable Cards */}
        <div 
          ref={marqueeRef}
          className={`overflow-x-auto no-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="flex gap-6 px-6 md:px-12 pb-4" style={{ width: 'max-content' }}>
            {[...services, ...services].map((service, index) => (
              <div 
                key={index}
                className="group relative w-[320px] md:w-[400px] h-[500px] rounded-[2rem] overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-500 flex-shrink-0"
              >
                <img 
                  src={service.image} 
                  alt={service.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <span className="text-7xl font-instrument text-white/10 absolute -top-4 right-8">0{(index % 4) + 1}</span>
                  <h3 className="text-2xl font-instrument text-white mb-3">{service.title}</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    {service.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section - Sticky Scroll */}
      <section className="relative bg-zinc-950 border-b border-zinc-900/50" id="process">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            
            {/* Left Column: Sticky Image */}
            <div className="hidden lg:block relative h-full min-h-screen border-r border-zinc-900/50">
              <div className="sticky top-0 h-screen w-full flex items-center justify-center p-12 lg:p-16">
                <div className="relative w-full h-[85vh] max-h-[800px] flex items-start">
                  
                  {/* Dynamic Image Container */}
                  <div className="relative w-3/4 h-full overflow-hidden rounded-2xl">
                    {processSteps.map((step) => (
                      <img 
                        key={step.step}
                        src={step.image} 
                        alt={step.title}
                        className={`process-img w-full h-full object-cover grayscale opacity-90 ${
                          activeProcess === step.step ? 'active' : 'inactive'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Large Sticky Number */}
                  <div className="absolute -right-4 top-8 z-20">
                    <span className="font-instrument text-7xl lg:text-8xl text-zinc-100/90 tracking-tight transition-all duration-500">
                      0{activeProcess}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Scrolling Text */}
            <div className="md:px-12 md:py-32 flex flex-col lg:gap-64 pt-24 pr-6 pb-24 pl-6 relative gap-y-32">
              
              {/* Mobile Header */}
              <div className="lg:hidden mb-8">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1 mb-6 tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Process
                </div>
                <h2 className="text-4xl md:text-5xl font-instrument text-white tracking-tight">How it works</h2>
              </div>

              {processSteps.map((step) => (
                <div 
                  key={step.step}
                  data-step={step.step}
                  className="process-step group flex flex-col justify-center min-h-[40vh]"
                >
                  <span className="lg:hidden text-6xl font-instrument text-zinc-700 mb-6 block">0{step.step}</span>
                  <h3 className="text-4xl md:text-5xl lg:text-6xl font-instrument text-zinc-100 tracking-tight mb-8 group-hover:text-white transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-lg md:text-xl text-zinc-400 font-light leading-relaxed max-w-lg mb-10">
                    {step.description}
                  </p>
                  <a href="#contact" className="text-sm uppercase tracking-widest font-medium text-white border-b border-zinc-600 pb-1 w-fit hover:border-white hover:text-orange-400 transition-all">
                    {step.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Bento Grid */}
      <section className="py-24 px-6 md:px-12 bg-zinc-950 border-b border-zinc-900/50" id="benefits">
        <div className="max-w-[1400px] mx-auto">
          
          <div className="mb-20 max-w-2xl">
            <h2 className="text-5xl md:text-7xl font-medium text-white tracking-tight font-instrument mb-6">
              Creative power, <span className="text-zinc-600">unbound.</span>
            </h2>
            <p className="text-xl text-zinc-400 font-light leading-relaxed">
              Save time, cut costs, and do more with less. We help you work smarter so you can focus on strategy.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Large Card Left */}
            <div className="lg:col-span-5 group relative min-h-[640px] bg-zinc-900/20 border border-zinc-800 rounded-[2.5rem] hover:border-zinc-600 transition-all duration-500 overflow-hidden flex flex-col justify-between p-10">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950/80 z-0 pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)] animate-pulse" />
                  <span className="uppercase text-xs font-bold tracking-[0.2em] text-zinc-500">Consistent</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-instrument text-white tracking-tight mb-4 leading-[0.95]">AI That Knows You</h3>
                <p className="text-lg text-zinc-400 font-light leading-relaxed max-w-sm">
                  Feed us your brand assets once, and our AI masters your look forever.
                </p>
              </div>
              
              <div className="absolute bottom-0 left-0 w-full h-[55%] z-0 rounded-b-[2.5rem] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/20 to-transparent z-10" />
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80" className="w-full h-full object-cover opacity-70 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700 ease-out" alt="AI Gen" />
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-7 flex flex-col gap-6 h-full">
              
              {/* Wide Card */}
              <div className="group relative bg-zinc-900/20 border border-zinc-800 rounded-[2.5rem] p-10 hover:border-zinc-600 transition-all duration-500 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="relative z-10 flex-1">
                  <h3 className="md:text-5xl leading-[0.95] text-4xl text-white tracking-tight font-instrument mb-4">Perfect Consistency</h3>
                  <p className="text-lg text-zinc-400 font-light leading-relaxed">
                    Every piece of content adheres strictly to your guidelines, ensuring a unified brand voice across channels.
                  </p>
                </div>
                <div className="relative w-full md:w-48 h-48 flex-shrink-0 rounded-2xl overflow-hidden border border-zinc-800/50 group-hover:border-zinc-600 transition-colors">
                  <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80" className="transition-all duration-700 ease-in-out w-full h-full object-cover" />
                </div>
              </div>

              {/* Split Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                
                {/* Cost Efficiency */}
                <div className="group relative bg-zinc-900/20 border border-zinc-800 rounded-[2.5rem] p-10 hover:border-zinc-600 transition-all duration-500 flex flex-col justify-between min-h-[320px] overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-3xl font-medium text-white mb-2 tracking-tight">Cost Efficiency</h3>
                    <p className="text-base text-zinc-500 font-light">Cut overhead significantly.</p>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-baseline gap-1 mb-5">
                      <span className="text-7xl font-semibold text-white tracking-tighter">-90</span>
                      <span className="text-3xl text-orange-500 font-medium">%</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 w-[10%] group-hover:w-[90%] transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                    </div>
                  </div>
                </div>

                {/* Hyper Speed */}
                <div className="group relative bg-zinc-900/20 border border-zinc-800 rounded-[2.5rem] p-10 hover:border-zinc-600 transition-all duration-500 flex flex-col justify-between min-h-[320px] overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-3xl font-medium text-white mb-2 tracking-tight">Hyper Speed</h3>
                    <p className="text-base text-zinc-500 font-light">Concept to final in 24h.</p>
                  </div>
                  
                  <div className="relative z-10 flex items-end">
                    <div className="flex items-center gap-3 bg-black border border-zinc-800 rounded-full pl-5 pr-6 py-3 shadow-lg group-hover:border-zinc-600 transition-colors">
                      <div className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                      </div>
                      <span className="text-sm font-mono text-zinc-300 tracking-wide">Rendering...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-32 px-6 md:px-12 bg-zinc-950" id="contact">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          
          {/* Left - Info */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1 mb-6 tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Early Access
              </div>
              <h2 className="text-5xl md:text-7xl font-instrument text-white tracking-tight mb-8 leading-[0.95]">
                Join the<br />waitlist.
              </h2>
              <p className="text-xl text-zinc-400 font-light leading-relaxed max-w-md mb-12">
                Be among the first to experience the future of AI-powered fashion photography. Early members get exclusive benefits.
              </p>

              <div className="space-y-4 mb-12">
                {[
                  "50% discount on launch pricing",
                  "500 bonus generation points",
                  "Priority access to new features",
                  "Direct line to our team"
                ].map((benefit, i) => (
                  <div key={i} className="flex items-center gap-3 text-zinc-300">
                    <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-orange-500" />
                    </div>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
              <a href="mailto:hello@formastudio.app" className="flex items-center gap-4 text-zinc-300 hover:text-white transition-colors group">
                <div className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-lg">hello@formastudio.app</span>
              </a>
              <div className="flex items-center gap-4 text-zinc-300">
                <div className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-lg">Global / Remote</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="glass-panel p-8 md:p-10 rounded-3xl space-y-6">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-6">
                  <Check className="w-8 h-8 text-orange-500" />
                </div>
                <h3 className="text-2xl font-instrument text-white mb-3">You're on the list!</h3>
                <p className="text-zinc-400 max-w-sm">
                  We'll be in touch soon with exclusive early access details.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-semibold tracking-wider text-zinc-500 ml-1">Name</label>
                    <input 
                      type="text" 
                      placeholder="John Doe" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase font-semibold tracking-wider text-zinc-500 ml-1">Email</label>
                    <input 
                      type="email" 
                      placeholder="john@company.com" 
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs uppercase font-semibold tracking-wider text-zinc-500 ml-1">Interest</label>
                  <select 
                    value={formData.interest}
                    onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all appearance-none cursor-pointer"
                  >
                    <option>Casting Studio</option>
                    <option>Outfit Studio</option>
                    <option>Photo Studio</option>
                    <option>All Studios</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-semibold tracking-wider text-zinc-500 ml-1">Company (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="Your company name" 
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={joinWaitlist.isPending}
                  className="hover:bg-zinc-200 transition-colors flex gap-2 group font-semibold text-black bg-white w-full rounded-xl py-4 items-center justify-center disabled:opacity-50"
                >
                  {joinWaitlist.isPending ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-black mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Joining...
                    </>
                  ) : (
                    <>
                      Join Waitlist
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                <p className="text-xs text-zinc-600 text-center">
                  By joining, you agree to receive updates about FormaStudio. Unsubscribe anytime.
                </p>
              </>
            )}
          </form>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t border-zinc-900 bg-zinc-950 pt-12 pb-6">
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          {/* Dynamic Info */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-sm font-mono">
            <span className="text-white">{currentTime}</span>
            <span className="text-zinc-700">|</span>
            <span>{location}</span>
          </div>

          {/* Socials */}
          <div className="flex gap-8 text-sm font-medium uppercase tracking-wide text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-white transition-colors">Instagram</a>
          </div>
        </div>

        {/* Marquee Text Footer */}
        <div className="relative w-full overflow-hidden select-none opacity-40 hover:opacity-100 transition-opacity duration-500">
          <div className="marquee-container-text">
            <div className="flex items-center whitespace-nowrap">
              <span className="text-[12vw] leading-none font-instrument text-zinc-800 px-8">FORMASTUDIO ©</span>
              <span className="text-[12vw] leading-none font-instrument text-zinc-800 px-8">FORMASTUDIO ©</span>
            </div>
            <div className="flex items-center whitespace-nowrap" aria-hidden="true">
              <span className="text-[12vw] leading-none font-instrument text-zinc-800 px-8">FORMASTUDIO ©</span>
              <span className="text-[12vw] leading-none font-instrument text-zinc-800 px-8">FORMASTUDIO ©</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
