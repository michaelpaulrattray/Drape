import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Sparkles,
  Check,
  Zap,
  Shield,
  Globe,
  Clock,
  DollarSign,
  Users,
  Image,
  Shirt,
  Camera,
  ChevronDown,
  Star,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="container">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link href="/">
              <span className="text-xl md:text-2xl font-instrument tracking-tight cursor-pointer">
                Forma<span className="opacity-60">Studio</span>
              </span>
            </Link>
            <Button
              onClick={scrollToWaitlist}
              className="h-9 px-4 rounded-full bg-white text-zinc-900 hover:bg-white/90 font-medium"
            >
              Join Waitlist
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-background to-background" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/4 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[150px] animate-pulse-glow" />
          <div className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px] animate-pulse-glow animation-delay-500" />
        </div>

        <div className="container relative z-10 text-center px-4 py-16 md:py-24">
          {/* Social proof badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-button mb-8 animate-fade-in-up">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-background"
                />
              ))}
            </div>
            <span className="text-sm">
              <span className="font-semibold">{stats?.displayCount || 847}+</span> creators on the waitlist
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-instrument tracking-tight leading-[0.95] mb-6 animate-fade-in-up animation-delay-100">
            Stop paying $10,000
            <br />
            <span className="text-muted-foreground">per photoshoot</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 animate-fade-in-up animation-delay-200 leading-relaxed">
            FormaStudio creates <span className="text-foreground">photorealistic AI models</span> for your brand.
            Cast them once, use them forever. No agencies, no scheduling, no limits.
          </p>

          {/* Value props */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-10 animate-fade-in-up animation-delay-300">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-400" />
              <span>Unlimited generations</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-400" />
              <span>Full commercial rights</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-400" />
              <span>Campaign-ready in minutes</span>
            </div>
          </div>

          {/* CTA */}
          <div className="animate-fade-in-up animation-delay-400">
            <Button
              onClick={scrollToWaitlist}
              size="lg"
              className="h-14 px-8 rounded-full bg-white text-zinc-900 hover:bg-white/90 font-medium group text-base"
            >
              Get Early Access
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Join the waitlist for exclusive early access pricing
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={() => document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer"
        >
          <ChevronDown className="w-8 h-8 text-muted-foreground" />
        </button>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              The Problem
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-instrument tracking-tight mb-6">
              Traditional photoshoots are
              <br />
              <span className="text-muted-foreground">broken for modern brands</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <DollarSign className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-instrument mb-3">Expensive</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                A single campaign shoot costs $10,000-$50,000. Models, photographers, studios, stylists—it adds up fast.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-xl font-instrument mb-3">Slow</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Weeks of planning, booking, shooting, editing. By the time you launch, trends have moved on.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-instrument mb-3">Limited</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                One model, one look, one day. Need different demographics or styles? Start over from scratch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <p className="text-sm font-medium text-purple-400 uppercase tracking-wider mb-4">
              The Solution
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-instrument tracking-tight mb-6">
              Your AI creative studio
              <br />
              <span className="text-muted-foreground">that never sleeps</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              FormaStudio gives you a complete AI-powered production pipeline. Cast models, style outfits, generate campaigns—all from one platform.
            </p>
          </div>

          {/* Studios Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="group relative h-[450px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-900/40 hover:border-purple-500/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/20">01</span>
                  <div className="w-12 h-12 rounded-full glass-button flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                    <Image className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-instrument tracking-tight mb-3">Casting Studio</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Create photorealistic AI models with precise control over demographics, features, and brand aesthetics. Your models, your rules.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative h-[450px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-900/40 hover:border-blue-500/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/20">02</span>
                  <div className="w-12 h-12 rounded-full glass-button flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <Shirt className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-instrument tracking-tight mb-3">Outfit Studio</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Dress your AI models in any outfit or product. Perfect for fashion, e-commerce, and lookbooks—no physical samples needed.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative h-[450px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-900/40 hover:border-orange-500/50 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/20">03</span>
                  <div className="w-12 h-12 rounded-full glass-button flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                    <Camera className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-instrument tracking-tight mb-3">Photo Studio</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Generate campaign-ready visuals at scale. Call sheets, mood boards, and production-quality images in minutes, not weeks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-medium text-green-400 uppercase tracking-wider mb-4">
                Why FormaStudio
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-instrument tracking-tight mb-8">
                Built for the way
                <br />
                <span className="text-muted-foreground">modern brands work</span>
              </h2>

              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl glass-button flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg mb-2">10x Faster Production</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Go from concept to campaign in hours, not weeks. Generate hundreds of variations while your competitors are still booking studios.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl glass-button flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg mb-2">90% Cost Reduction</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Replace $10,000+ photoshoots with AI-generated content. Same quality, fraction of the cost. Scale without scaling your budget.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl glass-button flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg mb-2">Global Representation</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Create models representing any demographic, any market. Authentic diversity without the logistics of global casting.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl glass-button flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg mb-2">Full Commercial Rights</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Own your AI models completely. No usage fees, no licensing headaches, no contract renewals. Your brand assets, forever.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-[2rem] glass-card p-8 flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <p className="text-6xl md:text-7xl font-instrument mb-2">90%</p>
                  <p className="text-muted-foreground">average cost savings</p>
                </div>
                <div className="w-full h-px bg-white/10 my-6" />
                <div className="grid grid-cols-2 gap-8 w-full">
                  <div className="text-center">
                    <p className="text-3xl font-instrument mb-1">10x</p>
                    <p className="text-sm text-muted-foreground">faster delivery</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-instrument mb-1">∞</p>
                    <p className="text-sm text-muted-foreground">variations</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-green-500/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-4 -left-4 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <p className="text-sm font-medium text-yellow-400 uppercase tracking-wider mb-4">
              Trusted By
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-instrument tracking-tight">
              Join the brands already
              <br />
              <span className="text-muted-foreground">transforming their creative</span>
            </h2>
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="glass-card rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "We cut our content production costs by 85% and increased our output 10x. FormaStudio is the future of fashion marketing."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                <div>
                  <p className="font-medium text-sm">Sarah Chen</p>
                  <p className="text-xs text-muted-foreground">Creative Director, Luxe Fashion</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "Finally, a tool that understands what creative directors actually need. The model consistency is incredible."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400" />
                <div>
                  <p className="font-medium text-sm">Marcus Williams</p>
                  <p className="text-xs text-muted-foreground">Brand Manager, Urban Collective</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "We launched campaigns in 12 markets simultaneously. Before FormaStudio, that would have taken 6 months and $500K."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400" />
                <div>
                  <p className="font-medium text-sm">Elena Rodriguez</p>
                  <p className="text-xs text-muted-foreground">CMO, Global Beauty Co</p>
                </div>
              </div>
            </div>
          </div>

          {/* Brand logos placeholder */}
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-40">
            {["VOGUE", "ELLE", "GQ", "BAZAAR", "COSMOPOLITAN"].map((brand) => (
              <span key={brand} className="text-lg md:text-xl font-instrument tracking-wider">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Early Access Section */}
      <section className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <p className="text-sm font-medium text-purple-400 uppercase tracking-wider mb-4">
              Early Access
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-instrument tracking-tight mb-6">
              Be first in line for
              <br />
              <span className="text-muted-foreground">exclusive benefits</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-medium mb-2">50% Launch Discount</h3>
              <p className="text-sm text-muted-foreground">
                Waitlist members get half off their first 3 months
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="font-medium mb-2">500 Bonus Points</h3>
              <p className="text-sm text-muted-foreground">
                Extra generation credits to explore every feature
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-medium mb-2">Priority Access</h3>
              <p className="text-sm text-muted-foreground">
                Skip the line and get access before public launch
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist Form Section */}
      <section id="waitlist-form" className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <div className="glass-card rounded-[2rem] p-8 md:p-12 relative overflow-hidden">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />

              <div className="relative z-10">
                {submitted ? (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                      <Check className="w-10 h-10 text-green-400" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-instrument mb-4">
                      {alreadyRegistered ? "You're already on the list!" : "You're on the list!"}
                    </h3>
                    {position && (
                      <p className="text-muted-foreground mb-4">
                        You're <span className="text-foreground font-medium">#{position}</span> in line
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      We'll email you when it's your turn to access FormaStudio.
                      <br />
                      Get ready to transform your creative workflow.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-8">
                      <h3 className="text-2xl md:text-3xl font-instrument mb-4">
                        Join the waitlist
                      </h3>
                      <p className="text-muted-foreground">
                        Be the first to know when FormaStudio launches.
                        <br />
                        Early access members get exclusive benefits.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Input
                          type="text"
                          placeholder="Your name (optional)"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-12 bg-white/5 border-white/10 focus:border-white/20 rounded-xl"
                        />
                      </div>
                      <div>
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-12 bg-white/5 border-white/10 focus:border-white/20 rounded-xl"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={joinMutation.isPending}
                        className="w-full h-12 rounded-xl bg-white text-zinc-900 hover:bg-white/90 font-medium"
                      >
                        {joinMutation.isPending ? (
                          "Joining..."
                        ) : (
                          <>
                            Get Early Access
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </form>

                    {joinMutation.isError && (
                      <p className="text-red-400 text-sm text-center mt-4">
                        Something went wrong. Please try again.
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground text-center mt-6">
                      No spam, ever. Unsubscribe anytime.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Social proof below form */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-background"
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Join <span className="text-foreground font-medium">{stats?.displayCount || 847}+</span> creators waiting
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-instrument tracking-tight">
                Frequently asked
                <br />
                <span className="text-muted-foreground">questions</span>
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "How realistic are the AI-generated models?",
                  a: "Our models are indistinguishable from real photography. We use state-of-the-art AI trained specifically for fashion and commercial imagery, ensuring photorealistic results that meet professional standards.",
                },
                {
                  q: "Do I own the rights to the generated content?",
                  a: "Yes, absolutely. All content generated through FormaStudio is yours to use commercially without any additional licensing fees or restrictions. Your AI models belong to you.",
                },
                {
                  q: "Can I use the same model across multiple campaigns?",
                  a: "That's exactly what FormaStudio is designed for. Create a model once, and use their consistent identity across unlimited campaigns, seasons, and markets.",
                },
                {
                  q: "How does pricing work?",
                  a: "FormaStudio uses a points-based system. Each generation consumes points based on complexity. Waitlist members receive 500 bonus points and 50% off their first 3 months.",
                },
                {
                  q: "When will FormaStudio launch?",
                  a: "We're currently in private beta with select brands. Public launch is planned for Q2 2026. Waitlist members get priority access before the general public.",
                },
              ].map((faq, i) => (
                <div key={i} className="glass-card rounded-xl p-6">
                  <h3 className="font-medium mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-instrument tracking-tight mb-6">
              Ready to revolutionize
              <br />
              <span className="text-muted-foreground">your creative workflow?</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of creative professionals already on the waitlist.
              Don't miss your chance at early access pricing.
            </p>
            <Button
              onClick={scrollToWaitlist}
              size="lg"
              className="h-14 px-8 rounded-full bg-white text-zinc-900 hover:bg-white/90 font-medium group"
            >
              Join the Waitlist
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-instrument">
                Forma<span className="text-muted-foreground">Studio</span>
              </span>
              <span className="text-xs text-muted-foreground">™</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} FormaStudio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
