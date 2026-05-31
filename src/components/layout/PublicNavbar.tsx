import { Link, useLocation } from "react-router-dom";
import { Menu, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function PublicNavbar() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { to: "/about", label: "About" },
    { to: "/disasters", label: "Disasters" },
    { to: "/blog", label: "Blog" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-sm border-b border-transparent">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/Bahuraksha%20logo.svg"
              alt="Bahuraksha Logo"
              className="w-10 h-10 object-contain group-hover:scale-105 transition-transform"
            />
            <span className="font-bold text-lg tracking-tight bg-linear-to-r from-foreground to-foreground/80 bg-clip-text">
              BAHURAKSHA
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm transition-colors relative group ${isActive(to) ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
                <span
                  className={`absolute -bottom-1 left-0 h-0.5 bg-ocean-400 transition-all ${isActive(to) ? "w-full" : "w-0 group-hover:w-full"}`}
                />
              </Link>
            ))}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/login">
                <Button size="sm" className="gap-1">
                  Sign In
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <button className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-foreground">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-65 p-0">
                <SheetHeader className="px-4 py-5 border-b border-border">
                  <SheetTitle className="text-left text-base">Navigation</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col p-3 gap-1">
                  {navLinks.map(({ to, label }) => (
                    <Link
                      key={to}
                      to={to}
                      className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive(to) ? "bg-ocean-400/10 text-ocean-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                    >
                      {label}
                    </Link>
                  ))}
                  <div className="mt-2 pt-3 border-t border-border">
                    <Link to="/login">
                      <Button className="w-full gap-1" size="sm">
                        Sign In
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
