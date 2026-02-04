import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { Menu, X, User, LogOut, Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface NavigationProps {
  variant?: "default" | "blend";
}

export default function Navigation({ variant = "default" }: NavigationProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const loginUrl = getLoginUrl();

  // Get credits balance if authenticated
  const { data: creditsData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const navLinks = [
    { href: "/casting-studio", label: "Casting Studio" },
    { href: "/outfit-studio", label: "Outfit Studio" },
    { href: "/photo-studio", label: "Photo Studio" },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const baseClasses = variant === "blend"
    ? "fixed top-0 left-0 w-full z-50 mix-blend-difference text-white pointer-events-none"
    : "fixed top-0 left-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/5";

  return (
    <>
      <nav className={baseClasses}>
        <div className="container">
          <div className="flex items-center justify-between h-16 md:h-20 pointer-events-auto">
            {/* Logo */}
            <Link href="/">
              <span className="text-xl md:text-2xl font-instrument tracking-tight cursor-pointer">
                Forma<span className="opacity-60">Studio</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className={`text-sm font-medium transition-opacity cursor-pointer ${
                      location === link.href ? "opacity-100" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>

            {/* Right Side */}
            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  {/* Credits Display */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-button">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium">
                      {creditsData?.balance ?? 0}
                    </span>
                  </div>

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-9 w-9 rounded-full p-0 glass-button"
                      >
                        {user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name || "User"}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 bg-card/95 backdrop-blur-xl border-white/10"
                    >
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium">{user?.name || "User"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email}
                        </p>
                      </div>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard">
                          <span className="flex items-center cursor-pointer w-full">
                            <User className="mr-2 h-4 w-4" />
                            Dashboard
                          </span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings">
                          <span className="flex items-center cursor-pointer w-full">
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                          </span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-destructive focus:text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <a href={loginUrl}>
                  <Button
                    variant="outline"
                    className="h-9 px-4 rounded-full glass-button hover:bg-white hover:text-zinc-900 transition-all duration-300"
                  >
                    Sign in
                  </Button>
                </a>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 pointer-events-auto"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-16 left-0 right-0 bg-card/95 backdrop-blur-xl border-b border-white/10 p-6 animate-slide-up">
            <div className="space-y-4">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className="block text-lg font-medium py-2 cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}

              <div className="pt-4 border-t border-white/10">
                {isAuthenticated ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Credits</span>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        <span className="font-medium">{creditsData?.balance ?? 0}</span>
                      </div>
                    </div>
                    <Link href="/dashboard">
                      <span
                        className="block text-lg font-medium py-2 cursor-pointer"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Dashboard
                      </span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left text-lg font-medium py-2 text-destructive"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <a href={loginUrl} className="block">
                    <Button className="w-full h-12 bg-white text-zinc-900 hover:bg-white/90">
                      Sign in
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
