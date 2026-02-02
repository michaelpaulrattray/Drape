import Navigation from "./Navigation";
import { ReactNode } from "react";

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
  return (
    <div className="min-h-screen bg-background">
      {showNav && <Navigation variant={navVariant} />}
      <main className={showNav ? "pt-16 md:pt-20" : ""}>
        {children}
      </main>
    </div>
  );
}
