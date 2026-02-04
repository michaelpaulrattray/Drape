import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Menu, X, Plus, Play, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

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
    title: "AI Model Casting",
    number: 1,
    description: "We generate unique, consistent AI model identities for your brand with photorealistic quality and complete creative control.",
    items: ["Model Generation", "Identity Systems", "Character Guidelines", "Ethnicity & Aesthetic", "Pose Libraries", "Expression Ranges"],
  },
  {
    title: "Outfit Generation",
    number: 2,
    description: "We create any outfit on your AI models. From streetwear to haute couture, no physical samples needed.",
    items: ["Virtual Try-On", "Garment Design", "Fabric Simulation", "Color Variants", "Style Matching", "Seasonal Collections"],
  },
  {
    title: "Campaign Production",
    number: 3,
    description: "Full photoshoot generation with complete lighting and environment control for campaign-ready assets.",
    items: ["Scene Composition", "Lighting Design", "Background Generation", "Multi-angle Shots", "Post-processing", "Asset Delivery"],
  },
  {
    title: "Brand Consistency",
    number: 4,
    description: "Maintain perfect visual consistency across all channels with AI-powered brand asset generation.",
    items: ["Style Guidelines", "Asset Libraries", "Cross-platform Assets", "Brand Templates", "Quality Control", "Version Management"],
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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-white/95 backdrop-blur-sm shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-black">Forma®</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-sm text-black/70 hover:text-black transition-colors">About</a>
            <a href="#work" className="text-sm text-black/70 hover:text-black transition-colors">Work</a>
            <a href="#services" className="text-sm text-black/70 hover:text-black transition-colors">Services</a>
            <a href="#pricing" className="text-sm text-black/70 hover:text-black transition-colors">Pricing</a>
            <a href="#blog" className="text-sm text-black/70 hover:text-black transition-colors">Blog</a>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/waitlist"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-full hover:bg-black/90 transition-colors"
            >
              Start a project
            </Link>
            <button className="w-10 h-10 flex items-center justify-center rounded-full border border-black/10 hover:bg-black/5 transition-colors">
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
          <div className="md:hidden absolute top-20 left-0 right-0 bg-white border-t border-black/10 shadow-lg">
            <nav className="flex flex-col p-6 gap-4">
              <a href="#about" className="text-lg text-black/70 hover:text-black transition-colors" onClick={() => setIsMobileMenuOpen(false)}>About</a>
              <a href="#work" className="text-lg text-black/70 hover:text-black transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Work</a>
              <a href="#services" className="text-lg text-black/70 hover:text-black transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Services</a>
              <a href="#pricing" className="text-lg text-black/70 hover:text-black transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
              <a href="#blog" className="text-lg text-black/70 hover:text-black transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Blog</a>
              <Link
                href="/waitlist"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-black text-white text-sm font-medium rounded-full hover:bg-black/90 transition-colors mt-4"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Start a project
              </Link>
            </nav>
          </div>
        )}
      </div>
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
            <span className="text-xl font-semibold text-black/40">{logo.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="min-h-screen pt-20 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Main Hero Content */}
        <div className="pt-16 pb-8">
          {/* Large Wordmark */}
          <h1 className="text-[clamp(4rem,15vw,12rem)] font-bold tracking-tighter leading-[0.85] text-black">
            Forma®
          </h1>
          
          {/* Tagline */}
          <div className="mt-8 max-w-md ml-auto text-right">
            <p className="text-lg text-black/60 leading-relaxed">
              Forma is an AI studio crafting refined model identities and photorealistic campaign assets.
            </p>
          </div>
        </div>

        {/* Logo Marquee + Trust Badge - Inline */}
        <div className="flex items-center gap-6 py-6 border-y border-black/10">
          {/* Logo Marquee with gradient fades */}
          <LogoMarquee />
          
          {/* Trust Badge - Right aligned */}
          <div className="flex items-center gap-4 shrink-0 pl-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-3.5 h-3.5 text-black/60 fill-current" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
              <span className="ml-1.5 text-sm font-medium text-black/80">4.9/5</span>
            </div>
            <span className="text-sm text-black/50">Trusted by <span className="font-medium text-black/70">100+</span> businesses</span>
          </div>
        </div>

        {/* Hero Image */}
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black/5">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&q=80"
            alt="AI Generated Model"
            className="w-full h-full object-cover grayscale contrast-125"
          />
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ label, number }: { label: string; number: string }) {
  return (
    <div className="flex items-center justify-between mb-12">
      <span className="text-sm text-black/40 tracking-wide">/ {label}</span>
      <span className="text-sm text-black/40">({number})</span>
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
              <span className="font-semibold text-black/70">{stat.value}</span>
              <span className="text-black/40 ml-1.5">{stat.label}</span>
              <span className="text-black/30 ml-3">/</span>
            </span>
          ))}
        </div>
        {/* Duplicate set for seamless loop */}
        <div className="flex shrink-0 items-center whitespace-nowrap">
          {statsSet.map((stat, index) => (
            <span key={`dup-${index}`} className="flex items-center text-sm mx-3">
              <span className="font-semibold text-black/70">{stat.value}</span>
              <span className="text-black/40 ml-1.5">{stat.label}</span>
              <span className="text-black/30 ml-3">/</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <SectionLabel label="About us" number="01" />

        {/* Two-tone Headline - Kanso Style with font-medium, smaller size */}
        <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.15] tracking-tight mb-12">
          <span className="text-black">We're a design studio focused on creating</span>
          <br />
          <span className="text-gray-400">simple, purposeful, and elegant solutions.</span>
        </h2>

        {/* Stats Marquee + Description - Inline Layout */}
        <div className="flex items-center gap-6 py-6 mb-16">
          {/* Stats Marquee with gradient fades */}
          <StatsMarquee />
          
          {/* Description - Right aligned */}
          <p className="shrink-0 max-w-xs text-sm text-black/60 leading-relaxed text-right">
            Our studio is dedicated to crafting clean, purposeful solutions that cut through the noise.
          </p>
        </div>

        {/* Video Block - Full Width */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-200">
          <img
            src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80"
            alt="Showreel"
            className="w-full h-full object-cover grayscale contrast-110"
          />
          {/* Play Button + Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <button className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
              <Play className="w-6 h-6 text-black fill-black ml-0.5" />
            </button>
            <span className="mt-4 text-white text-sm font-medium">Play Showreel</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkSection() {
  return (
    <section id="work" className="py-24 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <SectionLabel label="Selected Work" number="02" />

        {/* Header with subtext and button */}
        <div className="flex items-start justify-between mb-16">
          <div>
            <h2 className="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.1] tracking-tight text-black mb-4">Selected Work.</h2>
            <p className="text-black/50 text-sm max-w-sm leading-relaxed">
              A curated selection of projects that reflect our commitment to simplicity and purposeful design.
            </p>
          </div>
          <a href="#" className="inline-flex items-center gap-2 px-5 py-2.5 border border-black/20 text-sm text-black rounded-full hover:bg-black hover:text-white transition-all">
            View all projects
            <Plus className="w-4 h-4" />
          </a>
        </div>

        {/* Project Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <a
              key={index}
              href="#"
              className="group block rounded-2xl overflow-hidden transition-all duration-300 bg-[#EBEBEB] hover:bg-black"
            >
              {/* Image Container with zoom effect - border stays constant */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl m-2">
                <img
                  src={project.image}
                  alt={project.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              {/* Info Bar with scroll-up animation */}
              <div className="flex items-center justify-between p-4 pt-3 translate-y-2 opacity-80 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <div>
                  <h3 className="text-base font-semibold text-black group-hover:text-white transition-colors">{project.name}</h3>
                  <p className="text-sm text-black/50 group-hover:text-white/60 transition-colors">{project.category}</p>
                </div>
                <span className="text-sm text-black/40 group-hover:text-white/50 transition-colors">{project.year}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyUsSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <SectionLabel label="Why us" number="03" />

        {/* Two-tone Headline */}
        <h2 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[1.1] mb-16">
          <span className="text-black">We cut through noise to create designs that are </span>
          <span className="text-black/30">thoughtful, timeless, and impactful.</span>
        </h2>

        {/* Bento Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Tall Card */}
          <div className="lg:row-span-2 relative rounded-2xl overflow-hidden bg-black p-8 flex flex-col justify-between min-h-[500px]">
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">Purposeful Design for Modern Brands.</h3>
              <p className="text-white/60 text-sm">© 2025</p>
            </div>
            <img
              src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80"
              alt="Design"
              className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale"
            />
            <div className="relative z-10">
              <a href="/waitlist" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors">
                Get started
                <Plus className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Center Column */}
          <div className="space-y-6">
            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2">
              {["Collaborative Approach", "Quick turnaround", "Clear Communication", "Consistent Quality", "Reliable Support"].map((feature, i) => (
                <span key={i} className="px-4 py-2 bg-black/5 rounded-full text-sm text-black/70">
                  {feature}
                </span>
              ))}
            </div>

            {/* Testimonial Card */}
            <div className="bg-white rounded-2xl border border-black/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 text-black fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs text-black/50">4.9/5</span>
              </div>
              <p className="text-sm text-black/50 mb-4">100+ Happy clients worldwide</p>
              <blockquote className="text-black/80 mb-6">
                "Forma understood our brand better than we did. Their ability to find the essential and express it simply is what sets them apart."
              </blockquote>
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80"
                  alt="Sofia Ford"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-black">Sofia Ford</p>
                  <p className="text-xs text-black/50">Founder</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Feature Cards */}
            {[
              { icon: "⚡", title: "Streamlined Process", desc: "Our focused, step-by-step approach saves time and keeps projects moving smoothly." },
              { icon: "📐", title: "Scalable Design", desc: "We create systems that grow with your brand and stay effective over time." },
              { icon: "🕐", title: "24/7 Dedicated Support", desc: "We're always here when you need us, ready to answer questions, provide updates." },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl border border-black/10 p-6">
                <span className="text-2xl mb-4 block">{feature.icon}</span>
                <h4 className="font-bold text-black mb-2">{feature.title}</h4>
                <p className="text-sm text-black/60">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Brand Statement */}
        <div className="mt-6 bg-black/5 rounded-2xl p-8 flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-black">Forma®</span>
            <p className="text-black/50 mt-2">Design with intent.</p>
            <p className="text-black/30 text-sm">No excess, no fluff.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  const [activeService, setActiveService] = useState(0);

  return (
    <section id="services" className="py-24 bg-black text-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between mb-12">
          <span className="text-sm text-white/40 tracking-wide">/ Services</span>
          <span className="text-sm text-white/40">(04)</span>
        </div>

        {/* Service List */}
        <div className="space-y-4 mb-12">
          {services.map((service, index) => (
            <button
              key={index}
              onClick={() => setActiveService(index)}
              className={`w-full text-left flex items-center justify-between py-4 border-b border-white/10 transition-colors ${
                activeService === index ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              <span className="text-[clamp(1.5rem,4vw,3rem)] font-bold">{service.title}</span>
              <span className="text-[clamp(2rem,5vw,4rem)] font-light text-white/20">{service.number}</span>
            </button>
          ))}
        </div>

        {/* Active Service Details */}
        <div className="grid lg:grid-cols-2 gap-12 mb-12">
          <p className="text-lg text-white/60 leading-relaxed">
            {services[activeService].description}
          </p>
          <div className="grid grid-cols-2 gap-4">
            {services[activeService].items.map((item, i) => (
              <span key={i} className="text-sm text-white/40">{item}</span>
            ))}
          </div>
        </div>

        <a
          href="#pricing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition-colors"
        >
          See pricing
          <Plus className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <SectionLabel label="Process" number="05" />

        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left - Headline */}
          <div>
            <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.1] mb-8">
              Our process is simple, purposeful, and adaptable.
            </h2>
            <p className="text-black/60 mb-8">
              We believe great design is a result of clarity, collaboration, and craft.
            </p>
            <a
              href="/waitlist"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-medium rounded-full hover:bg-black/90 transition-colors"
            >
              Let's talk
              <Plus className="w-4 h-4" />
            </a>
          </div>

          {/* Right - Steps */}
          <div className="space-y-6">
            {processSteps.map((step, index) => (
              <div key={index} className="border-b border-black/10 pb-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-black">{step.title}</h3>
                  <span className="text-sm text-black/30">{step.number}</span>
                </div>
                <p className="text-black/60">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const [billingType, setBillingType] = useState<"monthly" | "project">("monthly");

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <SectionLabel label="Pricing Plans" number="06" />

        <p className="text-black/60 mb-8 max-w-xl">
          Flexible pricing designed to match your creative needs and scale with your brand.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center gap-4 mb-12">
          <button
            onClick={() => setBillingType("monthly")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              billingType === "monthly" ? "bg-black text-white" : "bg-black/5 text-black/60 hover:bg-black/10"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingType("project")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              billingType === "project" ? "bg-black text-white" : "bg-black/5 text-black/60 hover:bg-black/10"
            }`}
          >
            Project based
          </button>
        </div>

        {/* Pricing Card */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-black text-white rounded-2xl p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="text-sm text-white/50">Subscription</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-5xl font-bold">${billingType === "monthly" ? "2500" : "5000"}</span>
                  <span className="text-white/50">{billingType === "monthly" ? "/month" : "/project"}</span>
                </div>
              </div>
              <span className="text-sm text-white/30">Forma®</span>
            </div>
            <p className="text-white/60 mb-8">
              For ongoing support and flexible design needs. Ideal for startups, growing brands, and marketing teams needing consistent creative support.
            </p>
            <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span>($800/m) SEO optimization Add-on.</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-black/50 mb-4">What's included:</h4>
            <ul className="space-y-3 mb-8">
              {pricingFeatures.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-black/70">
                  <span className="w-2 h-2 rounded-full bg-black" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mb-8">
              <span className="text-sm text-black/50">Estimated delivery:</span>
              <p className="text-2xl font-bold text-black">48 hours</p>
            </div>
            <a
              href="/waitlist"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-medium rounded-full hover:bg-black/90 transition-colors"
            >
              Get started
              <Plus className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <section className="py-24 bg-black text-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between mb-12">
          <span className="text-sm text-white/40 tracking-wide">/ Testimonials</span>
          <span className="text-sm text-white/40">(07)</span>
        </div>

        <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold mb-16">
          Success stories from our clients.
        </h2>

        {/* Testimonial Carousel */}
        <div className="relative">
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm"
              >
                <div className="aspect-video rounded-xl overflow-hidden bg-white/10 mb-6 relative">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-full h-full object-cover grayscale"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </button>
                  </div>
                </div>
                <blockquote className="text-white/80 mb-6">
                  "{testimonial.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{testimonial.name}</p>
                    <p className="text-xs text-white/50">{testimonial.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentIndex(Math.min(testimonials.length - 1, currentIndex + 1))}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
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
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <SectionLabel label="FAQs" number="08" />

        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left - Headline */}
          <div>
            <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.1] mb-8">
              Wondering How We Work?
            </h2>
            <p className="text-black/60 mb-8">
              Answers to common questions about our process, services, and how we work.
            </p>
            <a
              href="/waitlist"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-medium rounded-full hover:bg-black/90 transition-colors"
            >
              Contact us
              <Plus className="w-4 h-4" />
            </a>
          </div>

          {/* Right - Accordion */}
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-black/10">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between py-4 text-left"
                >
                  <span className="font-medium text-black">{index + 1}. {faq.question}</span>
                  <Plus
                    className={`w-5 h-5 text-black/50 transition-transform ${
                      openIndex === index ? "rotate-45" : ""
                    }`}
                  />
                </button>
                {openIndex === index && (
                  <div className="pb-4">
                    <p className="text-black/60">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BlogSection() {
  return (
    <section id="blog" className="py-24 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <SectionLabel label="Blog" number="09" />

        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl font-bold text-black mb-4">Latest insights from our blog.</h2>
            <p className="text-black/60">Thoughts, ideas, and perspectives on design, simplicity, and creative process.</p>
          </div>
          <a href="#" className="hidden md:inline-flex items-center gap-2 text-sm text-black/60 hover:text-black transition-colors">
            View all articles
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Blog Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {blogPosts.map((post, index) => (
            <a
              key={index}
              href="#"
              className="group"
            >
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-black/5 mb-4 relative">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
                <span className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-black">
                  {post.category}
                </span>
              </div>
              <span className="text-sm text-black/50">{post.date}</span>
              <h3 className="text-lg font-bold text-black mt-2 mb-2 group-hover:text-black/70 transition-colors">
                {post.title}
              </h3>
              <p className="text-sm text-black/60 line-clamp-2">{post.excerpt}</p>
            </a>
          ))}
        </div>

        <a href="#" className="md:hidden inline-flex items-center gap-2 text-sm text-black/60 hover:text-black transition-colors mt-8">
          View all articles
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-24 bg-black text-white">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Large Wordmark */}
        <h2 className="text-[clamp(3rem,10vw,8rem)] font-bold tracking-tighter mb-16">
          Forma® Studio
        </h2>

        <div className="grid lg:grid-cols-2 gap-16 mb-16">
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
                className="px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-white/90 transition-colors"
              >
                Sign up
              </button>
            </form>
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-white/10">
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
        </div>

        {/* Copyright */}
        <div className="flex items-center justify-between pt-8 border-t border-white/10 text-sm text-white/40">
          <span>© 2025 All rights reserved</span>
          <span>Designed with AI</span>
        </div>
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
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <BlogSection />
      <Footer />
    </div>
  );
}
