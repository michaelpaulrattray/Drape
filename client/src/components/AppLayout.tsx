import Navigation from "./Navigation";
import { ReactNode, useEffect } from "react";

interface AppLayoutProps {
  children: ReactNode;
  navVariant?: "default" | "blend";
  showNav?: boolean;
}

export default function AppLayout({
  children,
  navVariant = "default",
  showNav = true,
}: AppLayoutProps) {
  // Apply dark theme when AppLayout is mounted (for dashboard/app pages)
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showNav && <Navigation variant={navVariant} />}
      <main className={showNav ? "pt-16 md:pt-20" : ""}>
        {children}
      </main>
    </div>
  );
}
