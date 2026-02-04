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
    <AppLayout navVariant="blend" showNav={false}>
      {/* Editorial Hero Section */}
      <section className="relative min-h-screen bg-[#f5f5f0] text-zinc-900 overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="absolute top-0 left-0 right-0 z-50 px-6 md:px-12 py-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/">
              <span className="text-lg md:text-xl font-instrument tracking-tight cursor-pointer text-zinc-900">
                FORMASTUDIO
              </span>
            </Link>
            
            {/* Center tagline */}
            <span className="hidden md:block text-xs tracking-[0.3em] uppercase text-zinc-500">
              "AI-Powered Creative Studio"
            </span>
            
            {/* Year */}
            <div className="text-right">
              <div className="text-xs text-zinc-400 leading-none">20</div>
              <div className="text-xs text-zinc-400 leading-none">26</div>
            </div>
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="relative min-h-screen flex items-center">
          <div className="w-full px-6 md:px-12 py-24 md:py-32">
            <div className="grid grid-cols-12 gap-4 md:gap-8 items-center">
              
              {/* Left Column - Image Card + Metadata */}
              <div className="col-span-12 md:col-span-5 lg:col-span-4 relative">
                {/* Floating Image Card */}
                <div className="relative">
                  {/* Vertical text */}
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 hidden lg:block">
                    <span className="text-xs tracking-[0.2em] text-zinc-400 [writing-mode:vertical-lr] rotate-180">
                      AI Model Generation ®
                    </span>
                  </div>
                  
                  {/* Image card */}
                  <div className="relative w-full max-w-[280px] mx-auto md:mx-0">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden shadow-2xl">
                      <img
                        src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/KeybyENSlZUJUbHm.jpg"
                        alt="AI Fashion Model"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Number overlay */}
                    <span className="absolute -top-4 -right-4 md:top-4 md:-right-8 text-6xl md:text-8xl font-instrument text-zinc-200/60 select-none">
                      01
                    </span>
                  </div>
                </div>
                
                {/* Description text */}
                <div className="mt-8 md:mt-12 max-w-[280px] mx-auto md:mx-0">
                  <p className="text-xs md:text-sm text-zinc-500 leading-relaxed">
                    FormaStudio is an AI-powered creative platform bridging the gap between fashion and technology. Cast AI models, style outfits, and generate campaign-ready visuals.
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
                    <span>Hand crafted by</span>
                    <span className="w-8 h-px bg-zinc-300" />
                    <span className="font-medium text-zinc-600">FormaStudio</span>
                  </div>
                </div>
              </div>
              
              {/* Center/Right Column - Typography + Hero Image */}
              <div className="col-span-12 md:col-span-7 lg:col-span-8 relative">
                {/* Large Typography */}
                <div className="relative z-10 mb-8 md:mb-0 md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 md:z-20">
                  <h1 className="font-instrument tracking-tight leading-[0.85]">
                    <span className="block text-6xl sm:text-7xl md:text-8xl lg:text-[10rem] xl:text-[12rem] text-zinc-900">
                      Forma
                    </span>
                    <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-[8rem] xl:text-[10rem] text-[#ff6b35] -mt-2 md:-mt-6">
                      Studio
                    </span>
                  </h1>
                </div>
                
                {/* Hero Image - Right side */}
                <div className="relative md:ml-auto md:w-[60%] lg:w-[55%]">
                  <div className="aspect-[3/4] md:aspect-[4/5] rounded-lg overflow-hidden">
                    <img
                      src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/caZUATkQFVjPkZky.jpeg"
                      alt="Fashion Editorial"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  
                  {/* Stats overlay */}
                  <div className="absolute top-4 right-4 text-right hidden md:block">
                    <div className="text-xs text-zinc-400 mb-1">Volume</div>
                    <div className="text-xs text-zinc-600">382 —— Traded</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bottom Section - CTA + Footer Info */}
            <div className="mt-12 md:mt-16 grid grid-cols-12 gap-4 md:gap-8 items-end">
              {/* CTA Section */}
              <div className="col-span-12 md:col-span-6 lg:col-span-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {loading ? (
                    <Button 
                      size="lg" 
                      className="h-14 px-8 rounded-full bg-zinc-900 text-white hover:bg-zinc-800" 
                      disabled
                    >
                      Loading...
                    </Button>
                  ) : isAuthenticated ? (
                    <Link href="/dashboard">
                      <Button
                        size="lg"
                        className="h-14 px-8 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 font-medium group"
                      >
                        Go to Dashboard
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  ) : (
                    <a href={loginUrl}>
                      <Button
                        size="lg"
                        className="h-14 px-8 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 font-medium group"
                      >
                        Get Early Access
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
              
              {/* Footer text */}
              <div className="col-span-12 md:col-span-6 lg:col-span-7">
                <div className="flex items-end justify-between">
                  <span className="text-4xl md:text-5xl font-instrument text-zinc-200">003.</span>
                  <p className="text-xs text-zinc-400 max-w-xs text-right hidden md:block">
                    A simple garment for a complex global problem to solve or survive in the dystopia we live in. Reimagining a world where we can explore new ideas and technologies.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-8 left-6 md:left-12 text-xs text-zinc-400 hidden md:block">
          <span className="tracking-[0.2em]">ALL RIGHTS RESERVED ®</span>
        </div>
      </section>

      {/* Studios Section - Updated for light theme transition */}
      <section className="py-24 md:py-32 bg-zinc-900">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-instrument tracking-tight mb-4 text-white">
              Your creative
              <br />
              <span className="text-zinc-400">toolkit</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              Three powerful studios designed to streamline your creative workflow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Casting Studio Card */}
            <div className="group relative h-[500px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-800/40 hover:border-white/20 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/30">01</span>
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Image className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-instrument tracking-tight mb-3 text-white translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    Casting Studio
                  </h3>
                  <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
                    <p className="text-zinc-400 text-sm leading-relaxed pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                      Create and cast AI models with precise control over demographics,
                      features, and brand aesthetics. Generate consistent model identities
                      for your campaigns.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Outfit Studio Card */}
            <div className="group relative h-[500px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-800/40 hover:border-white/20 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/30">02</span>
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Shirt className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-instrument tracking-tight mb-3 text-white translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    Outfit Studio
                  </h3>
                  <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
                    <p className="text-zinc-400 text-sm leading-relaxed pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                      Style your AI models with any outfit or product. Perfect for
                      fashion brands, e-commerce, and lookbook creation without
                      physical samples.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Photo Studio Card */}
            <div className="group relative h-[500px] rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-800/40 hover:border-white/20 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-instrument text-white/30">03</span>
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-instrument tracking-tight mb-3 text-white translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    Photo Studio
                  </h3>
                  <div className="h-0 overflow-hidden group-hover:h-auto transition-all duration-500">
                    <p className="text-zinc-400 text-sm leading-relaxed pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
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
      <section className="py-24 md:py-32 bg-zinc-900 border-t border-white/5">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-instrument tracking-tight mb-6 text-white">
                Built for
                <br />
                <span className="text-zinc-400">professionals</span>
              </h2>
              <p className="text-zinc-400 text-lg mb-8">
                FormaStudio combines cutting-edge AI with intuitive design,
                giving you the power to create without limits.
              </p>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1 text-white">Lightning Fast</h3>
                    <p className="text-sm text-zinc-400">
                      Generate high-quality images in seconds, not hours
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1 text-white">Brand Safe</h3>
                    <p className="text-sm text-zinc-400">
                      Full control over model identities and usage rights
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1 text-white">Global Diversity</h3>
                    <p className="text-sm text-zinc-400">
                      Create models representing any demographic or market
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-[2rem] bg-zinc-800/40 border border-white/10 p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-12 h-12 text-yellow-400" />
                  </div>
                  <p className="text-2xl font-instrument mb-2 text-white">100 Free Credits</p>
                  <p className="text-zinc-400 text-sm">
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
      <section className="py-24 md:py-32 bg-zinc-900">
        <div className="container">
          <div className="relative rounded-[2rem] bg-zinc-800/40 border border-white/10 p-12 md:p-16 text-center overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-instrument tracking-tight mb-6 text-white">
                Ready to create?
              </h2>
              <p className="text-zinc-400 text-lg max-w-xl mx-auto mb-8">
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
      <footer className="py-12 bg-zinc-900 border-t border-white/5">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-instrument text-white">
                Forma<span className="text-zinc-400">Studio</span>
              </span>
              <span className="text-xs text-zinc-500">™</span>
            </div>
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} FormaStudio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </AppLayout>
  );
}
