import { Button } from "@/components/ui/button";
import { Home, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black px-4">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-orange/5 rounded-full blur-3xl" />
      </div>

      <div className="text-center relative z-10 max-w-lg mx-auto">
        <div className="w-20 h-20 rounded-2xl bg-orange/10 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-orange" />
        </div>

        <h1 className="text-7xl md:text-8xl font-instrument text-orange mb-4">404</h1>

        <h2 className="text-2xl md:text-3xl font-instrument text-white mb-4">
          Page Not Found
        </h2>

        <p className="text-white/50 mb-8 leading-relaxed">
          Sorry, the page you are looking for doesn't exist.
          <br />
          It may have been moved or deleted.
        </p>

        <Button
          onClick={handleGoHome}
          className="btn-orange rounded-full px-8 py-3 h-auto font-medium transition-all duration-300"
        >
          <Home className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    </div>
  );
}
