import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Home,
  Image,
  Shirt,
  Camera,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  color?: string;
}

const mainNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home, color: "text-orange-400" },
];

const studioNav: NavItem[] = [
  { label: "Casting Studio", href: "/casting-studio", icon: Image, color: "text-purple-400" },
  { label: "Outfit Studio", href: "/outfit-studio", icon: Shirt, color: "text-cyan-400" },
  { label: "Photo Studio", href: "/photo-studio", icon: Camera, color: "text-yellow-400" },
];

const settingsNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings, color: "text-slate-400" },
];

export default function DashboardSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const NavLink = ({ item, isActive }: { item: NavItem; isActive: boolean }) => (
    <Link href={item.href}>
      <a
        className={cn(
          "flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all group",
          isActive
            ? "bg-gradient-to-r from-orange-500/10 to-transparent text-orange-400 border-l-2 border-orange-500 font-medium"
            : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
        )}
        onClick={() => setIsMobileOpen(false)}
      >
        <item.icon
          className={cn(
            "w-5 h-5 transition-colors",
            isActive ? "text-orange-400" : `group-hover:${item.color}`
          )}
        />
        {!isCollapsed && <span>{item.label}</span>}
      </a>
    </Link>
  );

  const SidebarContent = () => (
    <>
      {/* Logo & Menu Toggle */}
      <div className="px-6 pt-5 pb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 hover:text-white transition-colors hidden md:block"
          >
            <Menu className="w-5 h-5" />
          </button>
          {!isCollapsed && (
            <Link href="/dashboard">
              <a className="flex items-center gap-2 text-xl font-semibold text-white tracking-tight">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                  F
                </div>
                <span>Forma</span>
              </a>
            </Link>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6 pb-6">
        {/* Main Section */}
        <nav className="space-y-1">
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} isActive={location === item.href} />
          ))}
        </nav>

        {/* Studios Section */}
        <div>
          {!isCollapsed && (
            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Studios
            </h3>
          )}
          <nav className="space-y-1">
            {studioNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={location === item.href}
              />
            ))}
          </nav>
        </div>

        {/* Settings Section */}
        <div>
          {!isCollapsed && (
            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Account
            </h3>
          )}
          <nav className="space-y-1">
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
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-semibold overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name || ""} className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0).toUpperCase() || "U"
            )}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user?.email || ""}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={() => logout()}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#0D0C12] border border-white/10 text-white md:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static h-screen flex flex-col flex-shrink-0 border-r border-white/5 bg-[#0D0C12] z-50 transition-all duration-300",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen ? "left-0" : "-left-64 md:left-0"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
