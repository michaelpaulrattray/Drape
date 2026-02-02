import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
import { Link } from "wouter";
import { ArrowRight, Sparkles, Image, Shirt, Camera, Zap, Shield, Globe } from "lucide-react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const loginUrl = getLoginUrl();

  return (
    <AppLayout navVariant="blend">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-background to-background" />
        
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[128px] animate-pulse-glow" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[128px] animate-pulse-glow animation-delay-500" />
        </div>

        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '100px 100px'
          }}
        />

        <div className="container relative z-10 text-center px-4 py-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-button mb-8 animate-fade-in-up">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm">AI-Powered Creative Studio</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-instrument tracking-tight leading-[0.95] mb-6 animate-fade-in-up animation-delay-100">
            Create stunning
            <br />
            <span className="text-muted-foreground">AI models</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up animation-delay-200">
            FormaStudio empowers creative directors, brands, and content creators
            to cast AI models, style outfits, and generate campaign-ready visuals.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
            {loading ? (
              <Button size="lg" className="h-14 px-8 rounded-full" disabled>
                Loading...
              </Button>
            ) : isAuthenticated ? (
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="h-14 px-8 rounded-full bg-white text-zinc-900 hover:bg-white/90 font-medium group"
                >
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            ) : (
              <a href={loginUrl}>
                <Button
                  size="lg"
                  className="h-14 px-8 rounded-full bg-white text-zinc-900 hover:bg-white/90 font-medium group"
                >
                  Start Creating
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            )}
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-8 rounded-full glass-button hover:bg-white/10"
            >
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-16 animate-fade-in-up animation-delay-400">
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-instrument">10K+</p>
              <p className="text-sm text-muted-foreground">Models Created</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-instrument">500+</p>
              <p className="text-sm text-muted-foreground">Brands Trust Us</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-instrument">99%</p>
              <p className="text-sm text-muted-foreground">Satisfaction Rate</p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </div>
        </div>
      </section>

      {/* Studios Section */}
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-instrument tracking-tight mb-4">
              Your creative
              <br />
              <span className="text-muted-foreground">toolkit</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three powerful studios designed to streamline your creative workflow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Casting Studio Card */}
            <div className="group relative h-[500px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-900/40 hover:border-white/20 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/30">01</span>
                  <div className="w-12 h-12 rounded-full glass-button flex items-center justify-center">
                    <Image className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-instrument tracking-tight mb-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    Casting Studio
                  </h3>
                  <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
                    <p className="text-muted-foreground text-sm leading-relaxed pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                      Create and cast AI models with precise control over demographics,
                      features, and brand aesthetics. Generate consistent model identities
                      for your campaigns.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Outfit Studio Card */}
            <div className="group relative h-[500px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-900/40 hover:border-white/20 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/30">02</span>
                  <div className="w-12 h-12 rounded-full glass-button flex items-center justify-center">
                    <Shirt className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-instrument tracking-tight mb-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    Outfit Studio
                  </h3>
                  <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
                    <p className="text-muted-foreground text-sm leading-relaxed pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                      Style your AI models with any outfit or product. Perfect for
                      fashion brands, e-commerce, and lookbook creation without
                      physical samples.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Photo Studio Card */}
            <div className="group relative h-[500px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-900/40 hover:border-white/20 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/30">03</span>
                  <div className="w-12 h-12 rounded-full glass-button flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-instrument tracking-tight mb-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    Photo Studio
                  </h3>
                  <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
                    <p className="text-muted-foreground text-sm leading-relaxed pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                      Generate campaign-ready visuals with your models and products.
                      Create call sheets, mood boards, and production-quality images
                      at scale.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 md:py-32 border-t border-white/5">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-instrument tracking-tight mb-6">
                Built for
                <br />
                <span className="text-muted-foreground">professionals</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                FormaStudio combines cutting-edge AI with intuitive design,
                giving you the power to create without limits.
              </p>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl glass-button flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Lightning Fast</h3>
                    <p className="text-sm text-muted-foreground">
                      Generate high-quality images in seconds, not hours
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl glass-button flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Brand Safe</h3>
                    <p className="text-sm text-muted-foreground">
                      Full control over model identities and usage rights
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl glass-button flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Global Diversity</h3>
                    <p className="text-sm text-muted-foreground">
                      Create models representing any demographic or market
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-[2rem] glass-card p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full glass-button flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-12 h-12 text-yellow-400" />
                  </div>
                  <p className="text-2xl font-instrument mb-2">100 Free Points</p>
                  <p className="text-muted-foreground text-sm">
                    Start creating today with free credits
                  </p>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="relative rounded-[2rem] glass-card p-12 md:p-16 text-center overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-instrument tracking-tight mb-6">
                Ready to create?
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
                Join thousands of creative professionals using FormaStudio
                to revolutionize their visual content.
              </p>
              
              {loading ? (
                <Button size="lg" className="h-14 px-8 rounded-full" disabled>
                  Loading...
                </Button>
              ) : isAuthenticated ? (
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="h-14 px-8 rounded-full bg-white text-zinc-900 hover:bg-white/90 font-medium group"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              ) : (
                <a href={loginUrl}>
                  <Button
                    size="lg"
                    className="h-14 px-8 rounded-full bg-white text-zinc-900 hover:bg-white/90 font-medium group"
                  >
                    Get Started Free
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </a>
              )}
            </div>
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
    </AppLayout>
  );
}
