import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Waves } from "lucide-react";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="glass mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3">
        <div className="flex items-center gap-2">
          <Waves className="h-5 w-5 text-flood-safe" />
          <span className="font-semibold tracking-tight text-foreground">Hydrowatch</span>
        </div>
        <div className="hidden items-center gap-6 text-sm text-foreground/80 md:flex">
          <a href="#about" className="hover:text-foreground transition-colors">About</a>
          <a href="#blog" className="hover:text-foreground transition-colors">Blog</a>
          <a href="#stories" className="hover:text-foreground transition-colors">Stories</a>
        </div>
        <Button asChild size="sm" className="bg-flood-safe text-background hover:bg-flood-safe/90 font-semibold">
          <Link to="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </nav>
  );
}

