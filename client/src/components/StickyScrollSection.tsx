import { useEffect, useRef, useState } from 'react';
import { Camera, Sparkles, Rocket, Check, ArrowRight } from 'lucide-react';

const steps = [
  {
    id: 1,
    title: 'Define the',
    titleHighlight: 'Core Vision',
    description: 'We start by ingesting your brand guidelines and aesthetic preferences. Our system analyzes thousands of data points to understand your visual language before a single pixel is generated.',
    features: [
      'Brand DNA extraction',
      'Style guide synchronization', 
      'Competitor visual analysis'
    ],
    image: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2000&auto=format&fit=crop',
    icon: Camera
  },
  {
    id: 2,
    title: 'Generative',
    titleHighlight: 'Synthesis',
    description: 'Our proprietary models begin generating high-fidelity assets. Unlike generic tools, we constrain the output to your specific geometric and chromatic requirements, ensuring consistency.',
    tags: ['High Resolution', 'Vector Compatible', 'Layered PSDs'],
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2000&auto=format&fit=crop',
    icon: Sparkles
  },
  {
    id: 3,
    title: 'Automated',
    titleHighlight: 'Deployment',
    description: 'Approved assets are automatically formatted and pushed to your marketing channels. The system learns from performance metrics, refining future generations for higher engagement.',
    cta: 'Start Deployment',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2000&auto=format&fit=crop',
    icon: Rocket
  }
];

export function StickyScrollSection() {
  const [activeStep, setActiveStep] = useState(1);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-45% 0px -45% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index') || '1');
          setActiveStep(index);
        }
      });
    }, observerOptions);

    stepRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="w-full bg-zinc-950 border-y border-zinc-800">
      <div className="grid grid-cols-1 lg:grid-cols-2 w-full max-w-[1600px] mx-auto">
        
        {/* LEFT COLUMN: Sticky Image Display */}
        <div className="hidden lg:flex sticky top-0 h-screen flex-col justify-center items-center p-8 lg:p-12 border-r border-zinc-800">
          <div className="relative w-full aspect-[4/3] max-w-xl bg-zinc-900/30 rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
            
            {/* Decorative overlay gradient */}
            <div className="absolute inset-0 z-30 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            {/* Dynamic Counter */}
            <div className="absolute top-6 left-6 z-40 bg-black/50 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full">
              <span className="font-serif text-xl tracking-wide text-white">
                0{activeStep} — 03
              </span>
            </div>

            {/* Images with fade transitions */}
            {steps.map((step) => (
              <img
                key={step.id}
                src={step.image}
                alt={`Step ${step.id}`}
                className={`absolute inset-0 w-full h-full object-cover rounded-xl transition-all duration-700 ease-out ${
                  activeStep === step.id 
                    ? 'opacity-100 scale-100 z-20' 
                    : 'opacity-0 scale-95 z-10'
                }`}
              />
            ))}

            {/* Interactive Element Overlay */}
            <div className="absolute bottom-6 left-6 right-6 z-40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-orange animate-pulse" />
                <span className="text-xs font-medium text-zinc-300 tracking-wide uppercase">
                  System Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Scrolling Text Content */}
        <div className="flex flex-col relative">
          
          {/* Spacer for mobile */}
          <div className="lg:hidden h-20" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                ref={(el) => { stepRefs.current[index] = el; }}
                data-index={step.id}
                className={`process-step min-h-screen flex flex-col justify-center px-6 md:px-16 lg:px-24 py-20 ${
                  index < steps.length - 1 ? 'border-b border-zinc-800 lg:border-none' : ''
                }`}
              >
                {/* Step Number */}
                <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 text-white font-serif text-xl">
                  {step.id}
                </div>

                {/* Title */}
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif tracking-tight text-white mb-6">
                  {step.title} <span className="text-zinc-500">{step.titleHighlight}</span>
                </h2>

                {/* Description */}
                <p className="text-lg text-zinc-400 leading-relaxed max-w-md mb-8">
                  {step.description}
                </p>

                {/* Features list (Step 1) */}
                {step.features && (
                  <ul className="space-y-4 mb-10">
                    {step.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-zinc-300">
                        <Check className="w-5 h-5 text-zinc-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Tags (Step 2) */}
                {step.tags && (
                  <div className="flex flex-wrap gap-3 mb-10">
                    {step.tags.map((tag, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-full text-xs text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* CTA Button (Step 3) */}
                {step.cta && (
                  <button className="group flex items-center gap-3 text-white border border-zinc-700 bg-zinc-900/50 px-6 py-3 rounded-full hover:bg-zinc-800 hover:border-zinc-600 transition-all w-fit">
                    <span className="text-sm font-medium tracking-wide">{step.cta}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                  </button>
                )}

                {/* Mobile Image Fallback */}
                <div className="lg:hidden w-full aspect-video rounded-lg overflow-hidden my-6">
                  <img 
                    src={step.image} 
                    alt={`Step ${step.id}`}
                    className="w-full h-full object-cover grayscale opacity-80"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default StickyScrollSection;
