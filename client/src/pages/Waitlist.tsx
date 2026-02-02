import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "wouter";
import { 
  ArrowRight, 
  ArrowUpRight,
  Check, 
  ChevronDown,
  Sparkles,
  Zap,
  Users,
  Camera,
  Shirt,
  Image,
  Mail,
  MapPin,
  Menu,
  X
} from "lucide-react";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeProcess, setActiveProcess] = useState(1);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      toast.success("You're on the list!");
    },
    onError: (error) => {
      if (error.message.includes("already")) {
        toast.info("You're already on the waitlist!");
        setIsSubmitted(true);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    joinWaitlist.mutate({ email });
  };

  // Draggable marquee logic
  useEffect(() => {
    const container = marqueeRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    let position = 0;
    const speed = 0.5;
    let isDragging = false;
    let startX = 0;
    let prevTranslate = 0;
    let animationID: number;

    function animate() {
      if (!isDragging) position += speed;
      const trackWidth = track!.scrollWidth;
      const setWidth = trackWidth / 3;

      if (position >= setWidth) {
        position = 0;
      }
      if (position < 0) {
        position = setWidth - 1;
      }

      track!.style.transform = `translateX(${-position}px)`;
      animationID = requestAnimationFrame(animate);
    }
    animationID = requestAnimationFrame(animate);

    const startDrag = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      container.style.cursor = 'grabbing';
      startX = 'pageX' in e ? e.pageX : e.touches[0].clientX;
      prevTranslate = position;
    };

    const moveDrag = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const currentX = 'pageX' in e ? e.pageX : e.touches[0].clientX;
      const diff = startX - currentX;
      position = prevTranslate + diff;
    };

    const endDrag = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };

    container.addEventListener('mousedown', startDrag);
    container.addEventListener('touchstart', startDrag);
    container.addEventListener('mousemove', moveDrag);
    container.addEventListener('touchmove', moveDrag);
    container.addEventListener('mouseup', endDrag);
    container.addEventListener('mouseleave', endDrag);
    container.addEventListener('touchend', endDrag);

    return () => {
      cancelAnimationFrame(animationID);
      container.removeEventListener('mousedown', startDrag);
      container.removeEventListener('touchstart', startDrag);
      container.removeEventListener('mousemove', moveDrag);
      container.removeEventListener('touchmove', moveDrag);
      container.removeEventListener('mouseup', endDrag);
      container.removeEventListener('mouseleave', endDrag);
      container.removeEventListener('touchend', endDrag);
    };
  }, []);

  // Process section observer
  useEffect(() => {
    const steps = document.querySelectorAll('.process-step');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const step = entry.target.getAttribute('data-step');
            if (step) setActiveProcess(parseInt(step));
          }
        });
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );

    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  const services = [
    {
      num: "01",
      title: "Casting Studio",
      description: "Create and cast AI models with precise control over demographics, features, and brand aesthetics.",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80"
    },
    {
      num: "02", 
      title: "Outfit Studio",
      description: "Dress your AI models in any outfit. Mix and match styles for endless creative possibilities.",
      image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80"
    },
    {
      num: "03",
      title: "Photo Studio",
      description: "Generate campaign-ready photoshoots with your models, products, and custom environments.",
      image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80"
    }
  ];

  const processSteps = [
    {
      step: 1,
      title: "Cast Your Model",
      description: "Define your ideal model's characteristics—age, ethnicity, features, and brand aesthetic. Our AI generates a unique, consistent identity you can use across all campaigns.",
      image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80"
    },
    {
      step: 2,
      title: "Style & Outfit",
      description: "Dress your AI model in any outfit from your catalog or generate new looks. Perfect for e-commerce, lookbooks, and fashion campaigns without physical samples.",
      image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80"
    },
    {
      step: 3,
      title: "Generate Campaign",
      description: "Create full photoshoots in any environment—studio, outdoor, lifestyle. Export high-resolution assets ready for print, web, and social media.",
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80"
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-6">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <span className="text-lg font-semibold tracking-tight">FormaStudio</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm text-zinc-400 hover:text-white transition-colors">Services</a>
            <a href="#process" className="text-sm text-zinc-400 hover:text-white transition-colors">Process</a>
            <a href="#contact" className="text-sm text-zinc-400 hover:text-white transition-colors">Contact</a>
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <a href="#waitlist" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors">
              Join Waitlist
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800 p-6">
            <div className="flex flex-col gap-4">
              <a href="#services" className="text-lg text-zinc-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Services</a>
              <a href="#process" className="text-lg text-zinc-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Process</a>
              <a href="#contact" className="text-lg text-zinc-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Contact</a>
              <a href="#waitlist" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-black text-sm font-medium mt-4" onClick={() => setMobileMenuOpen(false)}>
                Join Waitlist
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Full Viewport */}
      <section className="min-h-screen flex flex-col justify-center px-6 md:px-12 pt-24 pb-12 relative">
        {/* Decorative gradient */}
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-indigo-900/20 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-[1800px] mx-auto w-full relative z-10">
          <div className="max-w-4xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/50 rounded-full px-3 py-1 mb-8 tracking-wider uppercase animate-fade-in">
              <Sparkles className="w-3 h-3" />
              AI-Powered Creative Studio
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-instrument tracking-tight text-white mb-6 animate-fade-in-up">
              The future of<br />
              <span className="text-zinc-400 italic">fashion photography</span><br />
              is here.
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-zinc-400 font-light max-w-2xl mb-10 animate-fade-in-up animation-delay-200">
              Create photorealistic AI models, style them in any outfit, and generate campaign-ready content—all without a single photoshoot.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up animation-delay-300">
              <a href="#waitlist" className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-white text-black font-medium hover:bg-zinc-200 transition-all group">
                Join the Waitlist
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#services" className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full border border-zinc-700 text-white font-medium hover:bg-white hover:text-black hover:border-white transition-all">
                Explore Services
              </a>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 md:gap-16 mt-16 pt-8 border-t border-zinc-800 animate-fade-in-up animation-delay-400">
              <div>
                <div className="text-4xl md:text-5xl font-instrument text-white">90%</div>
                <div className="text-sm text-zinc-500 mt-1">Cost Reduction</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-instrument text-white">10x</div>
                <div className="text-sm text-zinc-500 mt-1">Faster Production</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-instrument text-white">∞</div>
                <div className="text-sm text-zinc-500 mt-1">Creative Possibilities</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce-slow">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Scroll</span>
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        </div>
      </section>

      {/* Services Section - Horizontal Scroll Cards */}
      <section id="services" className="py-24 bg-black relative overflow-hidden">
        <div className="px-6 md:px-12 mb-12">
          <div className="max-w-[1800px] mx-auto">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/50 rounded-full px-3 py-1 mb-6 tracking-wider uppercase">
              Services
            </div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <h2 className="text-4xl md:text-6xl font-instrument text-white tracking-tight">
                Everything you need<br />
                <span className="text-zinc-500 italic">to create without limits.</span>
              </h2>
              <p className="text-zinc-400 max-w-md text-lg">
                Three powerful studios working together to transform your creative workflow.
              </p>
            </div>
          </div>
        </div>

        {/* Draggable Marquee */}
        <div 
          ref={marqueeRef}
          className="relative overflow-hidden cursor-grab select-none py-4"
        >
          <div 
            ref={trackRef}
            className="flex gap-6 pl-6 md:pl-12"
            style={{ width: 'max-content' }}
          >
            {/* Triple the cards for infinite scroll */}
            {[...services, ...services, ...services].map((service, index) => (
              <div key={index} className="service-card group">
                <div className="absolute inset-0 w-full h-full">
                  <img 
                    src={service.image} 
                    alt={service.title}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700 ease-out"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/20 to-zinc-950" />
                </div>
                <div className="absolute inset-0 p-8 md:p-10 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="font-instrument text-5xl md:text-6xl text-white/90">{service.num}</span>
                    <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 border border-white/20">
                      <ArrowUpRight className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-3xl md:text-4xl font-instrument tracking-tight text-white mb-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                      {service.title}
                    </h3>
                    <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
                      <p className="text-zinc-300 text-sm leading-relaxed max-w-[90%] pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                        {service.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section - Sticky Scroll */}
      <section id="process" className="py-24 px-6 md:px-12 bg-zinc-950 relative">
        <div className="max-w-[1800px] mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/50 rounded-full px-3 py-1 mb-6 tracking-wider uppercase">
            Process
          </div>
          <h2 className="text-4xl md:text-6xl font-instrument text-white tracking-tight mb-16">
            How it <span className="text-zinc-500 italic">works.</span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            {/* Left - Sticky Image */}
            <div className="hidden lg:block">
              <div className="sticky top-32">
                <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-zinc-900">
                  {/* Step number */}
                  <div className="absolute top-8 left-8 z-20">
                    <span className="font-instrument text-8xl text-white/20">
                      0{activeProcess}
                    </span>
                  </div>
                  
                  {/* Images */}
                  {processSteps.map((step, index) => (
                    <div 
                      key={step.step}
                      className={`process-image ${activeProcess === step.step ? 'active' : 'inactive'}`}
                    >
                      <img 
                        src={step.image} 
                        alt={step.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Steps */}
            <div className="space-y-0">
              {processSteps.map((step) => (
                <div 
                  key={step.step}
                  data-step={step.step}
                  className="process-step border-t border-zinc-800 py-16 first:border-t-0 first:pt-0"
                >
                  {/* Mobile Image */}
                  <div className="lg:hidden mb-8 rounded-2xl overflow-hidden aspect-video">
                    <img 
                      src={step.image} 
                      alt={step.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex items-start gap-6">
                    <span className="font-instrument text-5xl text-zinc-700">0{step.step}</span>
                    <div>
                      <h3 className="text-2xl md:text-3xl font-instrument text-white mb-4">{step.title}</h3>
                      <p className="text-zinc-400 text-lg leading-relaxed max-w-lg">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-24 px-6 md:px-12 bg-black relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/50 rounded-full px-3 py-1 mb-8 tracking-wider uppercase">
              Early Access
            </div>
            <h2 className="text-5xl md:text-7xl font-instrument text-white tracking-tight mb-6">
              Join the<br />
              <span className="text-zinc-500 italic">waitlist.</span>
            </h2>
            <p className="text-xl text-zinc-400 font-light mb-12 max-w-md">
              Be among the first to experience the future of AI-powered fashion photography. Early members get exclusive benefits.
            </p>

            {/* Benefits */}
            <div className="space-y-4">
              {[
                "50% discount on launch pricing",
                "500 bonus generation points",
                "Priority access to new features",
                "Direct line to our team"
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-3 text-zinc-300">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="glass-panel p-8 md:p-10 rounded-3xl">
            {isSubmitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-instrument text-white mb-3">You're on the list!</h3>
                <p className="text-zinc-400 max-w-sm">
                  We'll notify you as soon as FormaStudio is ready. Get ready to transform your creative workflow.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase font-semibold tracking-wider text-zinc-500 ml-1">Name</label>
                  <Input 
                    type="text" 
                    placeholder="John Doe"
                    className="w-full bg-zinc-950/50 border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-semibold tracking-wider text-zinc-500 ml-1">Email</label>
                  <Input 
                    type="email" 
                    placeholder="john@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-zinc-950/50 border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-semibold tracking-wider text-zinc-500 ml-1">Interest</label>
                  <select className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 appearance-none cursor-pointer">
                    <option>Casting Studio</option>
                    <option>Outfit Studio</option>
                    <option>Photo Studio</option>
                    <option>All Studios</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-semibold tracking-wider text-zinc-500 ml-1">Company (Optional)</label>
                  <Input 
                    type="text" 
                    placeholder="Your company name"
                    className="w-full bg-zinc-950/50 border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  />
                </div>

                <Button 
                  type="submit"
                  disabled={joinWaitlist.isPending}
                  className="w-full py-4 rounded-xl bg-white text-black font-medium hover:bg-zinc-200 transition-all group flex items-center justify-center gap-2"
                >
                  {joinWaitlist.isPending ? "Joining..." : "Join Waitlist"}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>

                <p className="text-xs text-zinc-600 text-center">
                  By joining, you agree to receive updates about FormaStudio. Unsubscribe anytime.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-6 md:px-12 bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-[1800px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-4xl md:text-5xl font-instrument text-white tracking-tight mb-6">
                Have questions?<br />
                <span className="text-zinc-500 italic">Let's talk.</span>
              </h2>
              <p className="text-zinc-400 text-lg mb-8 max-w-md">
                We're here to help you understand how FormaStudio can transform your creative workflow.
              </p>
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
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 pt-12 pb-6">
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          {/* Dynamic Info */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-sm font-mono">
            <span className="text-white">{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-zinc-700">|</span>
            <span>{Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace(/_/g, ' ') || 'Global'}</span>
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
      </footer>
    </div>
  );
}
