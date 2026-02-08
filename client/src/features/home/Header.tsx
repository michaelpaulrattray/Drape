import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Menu, X, Plus } from "lucide-react";
import { Button, NavLink, SocialLink } from "@/components/design-system";
import { motion, AnimatePresence } from "framer-motion";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Live time update every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Close mega menu on Escape key press
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMegaMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    
    if (isMegaMenuOpen || isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isMegaMenuOpen, isMobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  // Format time for display
  const formattedTime = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Australia/Sydney'
    };
    return currentTime.toLocaleString('en-US', options).replace(',', '');
  }, [currentTime]);

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {isMegaMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-[90]"
            onClick={() => setIsMegaMenuOpen(false)}
          />
        )}
      </AnimatePresence>
      
      <header 
        className="sticky top-0 z-[100] max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-12 bg-[#EBEBEB] relative rounded-b-xl overflow-hidden"
      >
      {/* Header content */}
      <div className="flex items-center justify-between h-14">
        {/* Logo + Time */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png" 
              alt="Forma®" 
              className="w-[31px] h-[31px]"
            />
          </Link>
          <span className="text-sm hidden sm:inline text-gray-secondary">{formattedTime}</span>
        </div>

        {/* Desktop Navigation - Hidden when mega menu is open */}
        {!isMegaMenuOpen && (
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            <NavLink href="#about">About</NavLink>
            <NavLink href="#work">Work</NavLink>
            <NavLink href="#services">Services</NavLink>
            <NavLink href="#blog">Blog</NavLink>
          </nav>
        )}

        {/* CTA Button */}
        <div className="hidden md:flex items-center gap-3 lg:gap-4">
          <Button href="/#contact" variant="primary" size="md">
            Join waitlist
          </Button>
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full border border-[#0A0A0A]/10 hover:bg-[#0A0A0A]/5 transition-colors"
            onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
            aria-label={isMegaMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMegaMenuOpen}
          >
            <Plus className={`w-4 h-4 transition-transform duration-300 ${isMegaMenuOpen ? '-rotate-45' : ''}`} />
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden w-10 h-10 flex items-center justify-center"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu — Full screen overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden fixed inset-0 top-14 bg-white z-50 overflow-y-auto"
          >
            <nav className="flex flex-col p-6 gap-1">
              {[
                { name: 'About', href: '#about' },
                { name: 'Work', href: '#work' },
                { name: 'Services', href: '#services' },
                { name: 'Blog', href: '#blog' },
                { name: 'Contact', href: '#contact' },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="py-3 text-2xl font-medium text-[#0A0A0A] hover:text-[#0A0A0A]/70 transition-colors border-b border-[#0A0A0A]/5"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    const target = document.querySelector(item.href);
                    if (target) {
                      const headerOffset = 72;
                      const elementPosition = target.getBoundingClientRect().top + window.scrollY;
                      setTimeout(() => {
                        window.scrollTo({ top: elementPosition - headerOffset, behavior: 'smooth' });
                      }, 300);
                    }
                  }}
                >
                  {item.name}
                </a>
              ))}
              <Button 
                href="/#contact" 
                variant="primary" 
                className="mt-6 justify-center w-full"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Join waitlist
              </Button>

              {/* Social links on mobile */}
              <div className="mt-8 pt-6 border-t border-[#0A0A0A]/5">
                <div className="flex items-center gap-6">
                  <a href="#" className="text-sm text-[#757575] hover:text-[#0A0A0A] transition-colors">Twitter/X</a>
                  <a href="#" className="text-sm text-[#757575] hover:text-[#0A0A0A] transition-colors">Instagram</a>
                  <a href="#" className="text-sm text-[#757575] hover:text-[#0A0A0A] transition-colors">LinkedIn</a>
                </div>
                <p className="text-xs text-[#757575] mt-4">hello@formastudio.ai</p>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mega Menu Dropdown */}
      <AnimatePresence>
        {isMegaMenuOpen && (
          <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              {/* Content wrapper */}
              <div className="pt-6 pb-8 flex flex-col md:flex-row gap-8">
                {/* Left Column - Navigation */}
                <div className="w-full md:w-1/2 flex flex-col">
                  <nav className="flex flex-col">
                    {[
                      { name: 'Home', href: '/', index: '01' },
                      { name: 'About', href: '#about', index: '02' },
                      { name: 'Projects', href: '#work', index: '03' },
                      { name: 'Blog', href: '#blog', index: '04' },
                      { name: 'Contact', href: '#contact', index: '05' },
                    ].map((item, i) => (
                      <motion.a
                        key={item.name}
                        href={item.href}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 + 0.05, duration: 0.3 }}
                        className="group flex items-center justify-between py-2 border-b border-gray-300 transition-colors overflow-hidden"
                        onClick={(e) => {
                          if (item.href.startsWith('#')) {
                            e.preventDefault();
                            setIsMegaMenuOpen(false);
                            const target = document.querySelector(item.href);
                            if (target) {
                              const headerOffset = 72;
                              const elementPosition = target.getBoundingClientRect().top + window.scrollY;
                              setTimeout(() => {
                                window.scrollTo({ top: elementPosition - headerOffset, behavior: 'smooth' });
                              }, 350);
                            }
                          } else {
                            setIsMegaMenuOpen(false);
                          }
                        }}
                      >
                        {/* Nav item name with conveyor effect */}
                        <span className="overflow-hidden h-7 text-card-title font-inter">
                          <span className="block text-[#0A0A0A] transition-transform duration-500 ease-out group-hover:-translate-y-full">
                            {item.name}
                          </span>
                          <span className="block text-[#0A0A0A] transition-transform duration-500 ease-out group-hover:-translate-y-full">
                            {item.name}
                          </span>
                        </span>
                        {/* Index number with conveyor effect */}
                        <span className="overflow-hidden h-5 relative w-8">
                          <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-muted font-medium transition-transform duration-500 ease-out group-hover:translate-y-5">({item.index})</span>
                          <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-muted font-medium transition-transform duration-500 ease-out -translate-y-5 group-hover:translate-y-0">({item.index})</span>
                        </span>
                      </motion.a>
                    ))}
                  </nav>
                </div>

                {/* Right Column - Feature Image */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="hidden lg:block w-1/2"
                >
                  <div className="relative w-full rounded-lg overflow-hidden h-mega-menu-image">
                    <img 
                      src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80" 
                      alt="FormaStudio™" 
                      className="w-full h-full object-cover grayscale"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute top-4 right-4">
                      <span className="text-white font-medium text-sm">FormaStudio™</span>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="text-white/70 text-xs">© 2025 All rights reserved</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Bottom row - Contact info on left, social links on right */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-0.5">
                  <a href="mailto:hello@formastudio.ai" className="group overflow-hidden">
                    <span className="overflow-hidden h-5 block">
                      <span className="block text-[#0A0A0A] font-medium transition-transform duration-500 ease-out group-hover:-translate-y-full">hello@formastudio.ai</span>
                      <span className="block text-[#0A0A0A] font-medium transition-transform duration-500 ease-out group-hover:-translate-y-full">hello@formastudio.ai</span>
                    </span>
                  </a>
                  <a href="tel:+11234567890" className="group overflow-hidden">
                    <span className="overflow-hidden h-5 block">
                      <span className="block text-sm text-dark font-medium transition-transform duration-500 ease-out group-hover:-translate-y-full">(123) 456-7890</span>
                      <span className="block text-sm text-dark font-medium transition-transform duration-500 ease-out group-hover:-translate-y-full">(123) 456-7890</span>
                    </span>
                  </a>
                </div>
                <div className="flex items-center gap-6">
                  <SocialLink href="#">Twitter/X</SocialLink>
                  <SocialLink href="#">Instagram</SocialLink>
                  <SocialLink href="#">LinkedIn</SocialLink>
                </div>
              </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </header>
    </>
  );
}
