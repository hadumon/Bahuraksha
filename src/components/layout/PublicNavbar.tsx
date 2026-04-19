import { Link, useLocation } from "react-router-dom";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function PublicNavbar() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <img 
              src="/Bahuraksha%20logo.svg" 
              alt="Bahuraksha Logo" 
              className="w-10 h-10 object-contain group-hover:scale-105 transition-transform"
            />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              BAHURAKSHA
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a
              href="/#about"
              className={`text-sm transition-colors relative group ${location.hash === '#about' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              About
              <span className={`absolute -bottom-1 left-0 h-0.5 bg-ocean-400 transition-all ${location.hash === '#about' ? 'w-full' : 'w-0 group-hover:w-full'}`} />
            </a>
            <Link
              to="/disasters"
              className={`text-sm transition-colors relative group ${isActive('/disasters') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Disasters
              <span className={`absolute -bottom-1 left-0 h-0.5 bg-ocean-400 transition-all ${isActive('/disasters') ? 'w-full' : 'w-0 group-hover:w-full'}`} />
            </Link>
            <Link
              to="/blog"
              className={`text-sm transition-colors relative group ${isActive('/blog') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Blog
              <span className={`absolute -bottom-1 left-0 h-0.5 bg-ocean-400 transition-all ${isActive('/blog') ? 'w-full' : 'w-0 group-hover:w-full'}`} />
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="sm" className="gap-1">
                  Dashboard
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Link to="/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
