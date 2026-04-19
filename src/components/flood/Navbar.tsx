import { Link } from "@tanstack/react-router";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="glass mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/Bahuraksha%20logo.svg" alt="Bahuraksha" className="h-6 w-6 object-contain" />
          <span className="font-semibold tracking-tight text-foreground">Bahuraksha</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-foreground/80 md:flex">
          <Link to="/" hash="about" className="hover:text-foreground transition-colors">About</Link>
          <Link to="/" hash="blog" className="hover:text-foreground transition-colors">Blog</Link>
          <Link to="/" hash="stories" className="hover:text-foreground transition-colors">Stories</Link>
        </div>
        <Link 
          to="/dashboard"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-flood-safe text-background hover:bg-flood-safe/90"
        >
          Dashboard
        </Link>
      </div>
    </nav>
  );
}

