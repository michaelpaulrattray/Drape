import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Home,
  Image,
  Shirt,
  Camera,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
];

const studioNav: NavItem[] = [
  { label: "Casting Studio", href: "/casting-studio", icon: Image },
  { label: "Outfit Studio", href: "/outfit-studio", icon: Shirt },
  { label: "Photo Studio", href: "/photo-studio", icon: Camera },
];

const settingsNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const NavLink = ({ item, isActive }: { item: NavItem; isActive: boolean }) => (
    <Link href={item.href}>
      <a
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all",
          isActive
            ? "text-orange bg-orange/10 border-l-2 border-orange"
            : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
        )}
        onClick={() => setIsMobileOpen(false)}
      >
        <item.icon className="w-4 h-4" />
        <span>{item.label}</span>
      </a>
    </Link>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <Link href="/dashboard">
          <a className="inline-flex items-center gap-2 font-bold tracking-tighter text-xl">
            <span className="w-6 h-6 rounded flex items-center justify-center text-sm text-zinc-900 bg-orange">F</span>
            <span className="font-geist text-white">FORMA</span>
          </a>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6">
        {/* Main Section */}
        <nav className="space-y-1 px-2">
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} isActive={location === item.href} />
          ))}
        </nav>

        {/* Studios Section */}
        <div className="mt-8">
          <h3 className="px-6 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
            Studios
          </h3>
          <nav className="space-y-1 px-2">
            {studioNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={location === item.href}
              />
            ))}
          </nav>
        </div>

        {/* Account Section */}
        <div className="mt-8">
          <h3 className="px-6 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
            Account
          </h3>
          <nav className="space-y-1 px-2">
            {settingsNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={location === item.href}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange to-orange-600 flex items-center justify-center text-white text-sm font-semibold overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name || ""} className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0).toUpperCase() || "U"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-white/40 truncate">
              {user?.email || ""}
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2.5 rounded bg-sidebar border border-sidebar-border text-white md:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Close Button */}
      {isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(false)}
          className="fixed top-4 right-4 z-50 p-2.5 rounded bg-sidebar border border-sidebar-border text-white md:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static h-screen w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar z-50 transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
