import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Check,
  Zap,
  Globe,
  Clock,
  DollarSign,
  ChevronDown,
  Sparkles,
  Image,
  Shirt,
  Camera,
  Plus,
  Minus,
} from "lucide-react";
import { Link } from "wouter";

// FAQ Accordion Item Component
function FAQItem({ question, answer, isOpen, onClick }: { 
  question: string; 
  answer: string; 
  isOpen: boolean; 
  onClick: () => void;
}) {
  return (
    <div className="border-b border-white/10">
      <button
        onClick={onClick}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg md:text-xl font-instrument pr-8">{question}</span>
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange transition-colors">
          {isOpen ? (
            <Minus className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-6' : 'max-h-0'}`}>
        <p className="text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

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

  const scrollToWaitlist = () => {
    document.getElementById("waitlist-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const faqs = [
    {
      question: "What exactly is AI-generated content?",
      answer: "AI-generated content uses advanced machine learning models to create photorealistic images of virtual models. These aren't stock photos or composites—they're entirely new, unique images created specifically for your brand, indistinguishable from traditional photography."
    },
    {
      question: "Will my content look generic or fake?",
      answer: "Not at all. Our AI models are trained on millions of high-quality images and can produce content that matches or exceeds traditional photography. You control every aspect—demographics, styling, poses, lighting—ensuring your brand's unique aesthetic is maintained."
    },
    {
      question: "How fast can I get my project done?",
      answer: "Most projects are completed within 24-48 hours. Simple headshots can be generated in minutes. Compare that to traditional photoshoots that take weeks of planning, booking, shooting, and editing."
    },
    {
      question: "How much money will I actually save?",
      answer: "On average, brands save 90% compared to traditional photoshoots. A campaign that would cost $10,000-$50,000 with agencies, models, photographers, and studios can be done for a fraction of the cost with FormaStudio."
    },
    {
      question: "What if I need changes?",
      answer: "That's the beauty of AI. Need a different pose? Different outfit? Different background? Changes are instant and unlimited. No reshoots, no additional fees, no waiting."
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-black/80 backdrop-blur-md">
        <div className="container">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link href="/">
              <span className="text-xl md:text-2xl font-instrument tracking-tight cursor-pointer">
                Forma<span className="opacity-50">Studio</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Services
              </button>
              <button 
                onClick={() => document.getElementById("process")?.scrollIntoView({ behavior: "smooth" })}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Process
              </button>
              <button 
                onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                FAQ
              </button>
            </div>
            <Button
              onClick={scrollToWaitlist}
              className="h-10 px-5 rounded-full btn-orange font-medium"
            >
              Join Waitlist
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col justify-center pt-20">
        <div className="container relative z-10">
          {/* Badge */}
          <div className="flex justify-center mb-8 animate-fade-in-up">
            <div className="pill-badge px-5 py-2 rounded-full text-sm font-medium">
              Custom AI Images & Videos For Your Brand
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-instrument tracking-tight leading-[0.95] mb-6 animate-fade-in-up animation-delay-100">
            AI-Powered Visuals
            <br />
            <span className="text-orange">in 24 Hours</span>
          </h1>

          {/* Subheadline */}
          <p className="text-center text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 animate-fade-in-up animation-delay-200">
            No photoshoots. No waiting. Just AI-powered visuals for your brand
          </p>

          {/* CTA */}
          <div className="flex justify-center mb-16 animate-fade-in-up animation-delay-300">
            <Button
              onClick={scrollToWaitlist}
              size="lg"
              className="h-14 px-8 rounded-full btn-orange font-medium group text-base"
            >
              Get Early Access
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-6 h-6 text-white/40" />
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 md:py-24 border-t border-white/5">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-w-5xl mx-auto">
            {[
              { gradient: "from-zinc-800 to-zinc-900", label: "Fashion Model" },
              { gradient: "from-zinc-700 to-zinc-800", label: "Product Shot" },
              { gradient: "from-zinc-800 to-zinc-700", label: "Lifestyle" },
              { gradient: "from-zinc-900 to-zinc-800", label: "Portrait" },
              { gradient: "from-zinc-700 to-zinc-900", label: "Campaign" },
              { gradient: "from-zinc-800 to-zinc-700", label: "Editorial" },
            ].map((img, i) => (
              <div 
                key={i}
                className={`aspect-[4/5] rounded-2xl bg-gradient-to-br ${img.gradient} overflow-hidden group cursor-pointer relative`}
              >
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-sm font-medium">{img.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-24 md:py-32">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Image */}
            <div className="aspect-[4/5] rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 overflow-hidden">
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white/20 text-lg font-instrument">AI Generated Visual</span>
              </div>
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-orange" />
                <span className="text-sm font-medium text-orange uppercase tracking-wider">The Problem</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-instrument tracking-tight mb-6 leading-[1.1]">
                Struggling with slow content creation?
              </h2>
              
              <p className="text-lg text-white/60 mb-8 leading-relaxed">
                Creating quality visuals shouldn't take weeks or cost thousands. I use cutting-edge AI to deliver stunning, photorealistic content in hours, not months.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Traditional shoots cost $10,000+</h4>
                    <p className="text-sm text-white/50">Models, photographers, studios, stylists—it adds up fast.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-orange" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Weeks of planning and editing</h4>
                    <p className="text-sm text-white/50">By the time you launch, trends have moved on.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Limited diversity and flexibility</h4>
                    <p className="text-sm text-white/50">Need different demographics? Start over from scratch.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 md:py-32 border-t border-white/10">
        <div className="container">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-orange" />
              <span className="text-sm font-medium text-orange uppercase tracking-wider">Services</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-instrument tracking-tight mb-6">
              Everything you need
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              A complete AI-powered production pipeline for modern brands
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Casting Studio */}
            <div className="group solid-card-hover rounded-3xl p-8 h-full">
              <div className="w-14 h-14 rounded-2xl bg-orange/10 flex items-center justify-center mb-6 group-hover:bg-orange/20 transition-colors">
                <Image className="w-7 h-7 text-orange" />
              </div>
              <h3 className="text-2xl font-instrument mb-4">Casting Studio</h3>
              <p className="text-white/60 leading-relaxed mb-6">
                Create and cast AI models with precise control over demographics, features, and brand aesthetics. Generate consistent model identities for all your campaigns.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Custom model creation</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Consistent identity across shots</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Global diversity options</span>
                </li>
              </ul>
            </div>

            {/* Outfit Studio */}
            <div className="group solid-card-hover rounded-3xl p-8 h-full">
              <div className="w-14 h-14 rounded-2xl bg-orange/10 flex items-center justify-center mb-6 group-hover:bg-orange/20 transition-colors">
                <Shirt className="w-7 h-7 text-orange" />
              </div>
              <h3 className="text-2xl font-instrument mb-4">Outfit Studio</h3>
              <p className="text-white/60 leading-relaxed mb-6">
                Dress your AI models in any outfit. Upload your products or describe styles, and watch them come to life on your virtual talent.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Virtual try-on technology</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Product photography</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Style mixing & matching</span>
                </li>
              </ul>
            </div>

            {/* Photo Studio */}
            <div className="group solid-card-hover rounded-3xl p-8 h-full">
              <div className="w-14 h-14 rounded-2xl bg-orange/10 flex items-center justify-center mb-6 group-hover:bg-orange/20 transition-colors">
                <Camera className="w-7 h-7 text-orange" />
              </div>
              <h3 className="text-2xl font-instrument mb-4">Photo Studio</h3>
              <p className="text-white/60 leading-relaxed mb-6">
                Generate campaign-ready outputs combining your models with products, backgrounds, and props. Create call sheets and export in any format.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Campaign generation</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Multiple export formats</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-white/70">
                  <Check className="w-4 h-4 text-orange" />
                  <span>Call sheet creation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-24 md:py-32 border-t border-white/10">
        <div className="container">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-orange" />
              <span className="text-sm font-medium text-orange uppercase tracking-wider">Process</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-instrument tracking-tight mb-6">
              How it works
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              From concept to campaign-ready visuals in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange/10 border border-orange/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-instrument text-orange">1</span>
              </div>
              <h3 className="text-xl font-instrument mb-3">Cast Your Model</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Define your ideal model's demographics, features, and aesthetic. Our AI generates a unique, consistent identity.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange/10 border border-orange/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-instrument text-orange">2</span>
              </div>
              <h3 className="text-xl font-instrument mb-3">Style & Outfit</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Upload your products or describe outfits. Our AI dresses your model in any style, any setting.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange/10 border border-orange/30 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-instrument text-orange">3</span>
              </div>
              <h3 className="text-xl font-instrument mb-3">Generate & Export</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Create campaign-ready visuals in minutes. Export in any format, ready for social, web, or print.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 md:py-32 border-t border-white/10">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-4xl md:text-5xl font-instrument text-orange mb-2">90%</div>
              <p className="text-sm text-white/60">Cost Savings</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-instrument text-orange mb-2">24h</div>
              <p className="text-sm text-white/60">Turnaround</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-instrument text-orange mb-2">∞</div>
              <p className="text-sm text-white/60">Variations</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-instrument text-orange mb-2">100%</div>
              <p className="text-sm text-white/60">Commercial Rights</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 md:py-32 border-t border-white/10">
        <div className="container max-w-3xl">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-orange" />
              <span className="text-sm font-medium text-orange uppercase tracking-wider">FAQ</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-instrument tracking-tight">
              Common questions
            </h2>
          </div>

          <div className="border-t border-white/10">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist Form Section */}
      <section id="waitlist-form" className="py-24 md:py-32 border-t border-white/10">
        <div className="container max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-orange" />
            <span className="text-sm font-medium text-orange uppercase tracking-wider">Early Access</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-instrument tracking-tight mb-6">
            Ready to transform your content?
          </h2>
          
          <p className="text-lg text-white/60 mb-10">
            Join {stats?.displayCount || 847}+ creators on the waitlist. Early access members get 50% off launch pricing.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="space-y-4">
                <Input
                  type="text"
                  placeholder="Your name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-14 px-6 rounded-full bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-orange focus:ring-orange"
                />
                <Input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 px-6 rounded-full bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-orange focus:ring-orange"
                />
                <Button
                  type="submit"
                  disabled={joinMutation.isPending}
                  className="w-full h-14 rounded-full btn-orange font-medium text-base"
                >
                  {joinMutation.isPending ? (
                    "Joining..."
                  ) : (
                    <>
                      Get Early Access
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-white/40 mt-4">
                No spam. Unsubscribe anytime.
              </p>
            </form>
          ) : (
            <div className="max-w-md mx-auto solid-card rounded-3xl p-8">
              <div className="w-16 h-16 rounded-full bg-orange/20 flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-orange" />
              </div>
              <h3 className="text-2xl font-instrument mb-3">
                {alreadyRegistered ? "You're already on the list!" : "You're on the list!"}
              </h3>
              <p className="text-white/60 mb-4">
                {position && `You're #${position} on the waitlist.`}
                {" "}We'll notify you when early access opens.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-orange">
                <Sparkles className="w-4 h-4" />
                <span>50% discount secured</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="text-xl font-instrument">
              Forma<span className="opacity-50">Studio</span>
            </span>
            <p className="text-sm text-white/40">
              © 2025 FormaStudio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
