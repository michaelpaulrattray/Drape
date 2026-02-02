import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Image,
  Shirt,
  Camera,
  Settings,
  History,
  Folder,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/dashboard" },
  { icon: Image, label: "Casting Studio", href: "/casting-studio", badge: "New" },
  { icon: Shirt, label: "Outfit Studio", href: "/outfit-studio" },
  { icon: Camera, label: "Photo Studio", href: "/photo-studio" },
];

const libraryNavItems: NavItem[] = [
  { icon: Folder, label: "My Models", href: "/dashboard/models" },
  { icon: History, label: "History", href: "/dashboard/history" },
];

interface DashboardSidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
  pointsBalance?: number;
}

export function DashboardSidebar({ user, pointsBalance = 0 }: DashboardSidebarProps) {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location === "/dashboard";
    }
    return location.startsWith(href);
  };

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer",
          isActive(item.href)
            ? "bg-lime/10 text-lime"
            : "text-white/60 hover:text-white hover:bg-white/5"
        )}
        onClick={() => setMobileOpen(false)}
      >
        <item.icon className={cn(
          "w-5 h-5 transition-colors",
          isActive(item.href) ? "text-lime" : "text-white/40 group-hover:text-white/60"
        )} />
        <span className="text-sm font-medium">{item.label}</span>
        {item.badge && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-lime/20 text-lime">
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-white/5">
        <Link href="/dashboard">
          <span className="text-xl font-instrument tracking-tight cursor-pointer flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-lime" />
            Forma<span className="opacity-50">Studio</span>
          </span>
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="p-3 space-y-1">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>

      {/* Library Section */}
      <div className="px-3 pt-4">
        <div className="px-3 mb-2">
          <span className="text-xs font-medium text-white/30 uppercase tracking-wider">
            Library
          </span>
        </div>
        <div className="space-y-1">
          {libraryNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* Show More */}
      <div className="px-3 pt-2">
        <button
          onClick={() => setShowMore(!showMore)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-white/60 transition-colors w-full"
        >
          {showMore ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show More
            </>
          )}
        </button>
        {showMore && (
          <div className="space-y-1 mt-1">
            <Link href="/settings">
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                onClick={() => setMobileOpen(false)}
              >
                <Settings className="w-5 h-5 text-white/40" />
                <span className="text-sm font-medium">Settings</span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Points Balance */}
      <div className="mt-auto p-4 border-t border-white/5">
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40 uppercase tracking-wider">Points Balance</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-instrument text-lime">{pointsBalance.toLocaleString()}</span>
            <span className="text-sm text-white/40">pts</span>
          </div>
          <button className="w-full mt-3 py-2 text-sm font-medium rounded-lg bg-lime/10 text-lime hover:bg-lime/20 transition-colors">
            Get More Points
          </button>
        </div>
      </div>

      {/* User Profile */}
      {user && (
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime/30 to-lime/10 flex items-center justify-center">
              <span className="text-sm font-medium text-lime">
                {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || "User"}</p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-[#0a0a0a] border-r border-white/5 flex flex-col z-40 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
