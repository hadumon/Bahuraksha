import { createFileRoute } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { WaterfallScene } from "@/components/flood/WaterfallScene";
import { Navbar } from "@/components/flood/Navbar";
import { ScrollRail } from "@/components/flood/ScrollRail";
import { TelemetryHUD } from "@/components/flood/TelemetryHUD";
import { FloodEventBanner } from "@/components/flood/FloodEventBanner";
import { AlertLog } from "@/components/flood/AlertLog";
import { useTelemetry } from "@/hooks/useTelemetry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Activity, Newspaper } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Hydrowatch · Disaster Intelligence for Flood Management" },
      { name: "description", content: "Real-time flood monitoring, scroll-driven 3D river visualization, and disaster intelligence for resilient communities." },
      { property: "og:title", content: "Hydrowatch · Disaster Intelligence" },
      { property: "og:description", content: "Real-time flood monitoring and disaster intelligence." },
    ],
  }),
});

const stories = [
  { tag: "STORY", title: "Kerala Monsoon: A Village Rebuilds", excerpt: "How early-warning sensors gave 4,000 residents a 6-hour head start." },
  { tag: "STORY", title: "The Mississippi's New Memory", excerpt: "ML models trained on a century of river data now predict surge crests within 12cm." },
  { tag: "STORY", title: "Bangkok's Tidal Defense", excerpt: "Inside the floating barrier network protecting 11 million people." },
];

const news = [
  { tag: "NEWS", title: "EU Funds €240M Flood Sensor Network", excerpt: "Twelve nations join the continental telemetry grid set for 2026 rollout." },
  { tag: "NEWS", title: "NOAA Releases 2025 Atlantic Forecast", excerpt: "Above-average storm season expected; coastal cities urged to upgrade systems." },
  { tag: "NEWS", title: "AI Discharge Models Beat Legacy Tools", excerpt: "New benchmark shows 38% improvement in 72-hour flood prediction accuracy." },
];

function Index() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const fallOpacity = useTransform(scrollYProgress, [0.25, 0.45, 0.6], [0, 1, 0]);
  const telemetry = useTelemetry(1500);

  return (
    <>
      {/* Fixed 3D background */}
      <div className="fixed inset-0 z-0">
        <WaterfallScene telemetry={telemetry} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/60" />
      </div>

      <Navbar />
      <ScrollRail />
      <TelemetryHUD t={telemetry} />
      <FloodEventBanner event={telemetry.event} />
      <AlertLog alerts={telemetry.alertLog} />

      <main className="relative z-10">
        {/* SECTION 1 — HERO */}
        <section id="hero" className="relative flex min-h-screen items-center px-6">
          <motion.div style={{ opacity: heroOpacity }} className="mx-auto grid w-full max-w-6xl gap-10 pt-24 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs uppercase tracking-widest text-flood-safe">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-flood-safe" />
                Live · {telemetry.sensorsOnline.toLocaleString()} sensors · {telemetry.discharge} m³/s
              </div>
              <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-7xl">
                Disaster Intelligence<br />
                for <span className="text-flood-safe">Flood Management</span>
              </h1>
              <p className="mt-6 max-w-md text-lg text-foreground/70">
                Stream telemetry from rivers, deltas, and coastlines. Predict crests. Protect communities — before the water rises.
              </p>
            </div>

            <Card className="glass-strong border-white/10 bg-transparent text-foreground">
              <CardContent className="p-7">
                <h2 className="text-xl font-semibold">Sign in to your operations console</h2>
                <p className="mt-1 text-sm text-foreground/60">Access live basins, alerts, and forecast maps.</p>
                <form className="mt-6 space-y-3" onSubmit={(e) => e.preventDefault()}>
                  <Input type="email" placeholder="you@agency.gov" className="border-white/15 bg-white/5 text-foreground placeholder:text-foreground/40" />
                  <Input type="password" placeholder="Password" className="border-white/15 bg-white/5 text-foreground placeholder:text-foreground/40" />
                  <Button type="submit" className="w-full bg-flood-safe text-background font-semibold hover:bg-flood-safe/90">
                    Continue <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </form>
                <p className="mt-4 text-center text-xs text-foreground/50">Don't have credentials? Request agency access.</p>
              </CardContent>
            </Card>
          </motion.div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-foreground/40">
            Scroll to descend ↓
          </div>
        </section>

        {/* SECTION 2 — THE FALL */}
        <section id="fall" className="relative flex min-h-[150vh] items-center justify-center px-6">
          <motion.div
            style={{ opacity: fallOpacity }}
            className="sticky top-1/3 mx-auto max-w-5xl text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs uppercase tracking-widest text-flood-warn">
              <Activity className="h-3 w-3" /> Intensity rising
            </div>
            <h2 className="text-6xl font-bold leading-[0.95] tracking-tighter text-foreground md:text-[9rem]">
              Real-time<br />
              <span className="bg-gradient-to-b from-foreground to-flood-danger bg-clip-text text-transparent">
                Monitoring.
              </span>
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-foreground/70">
              Every second, telemetry surges across our network. Discharge, velocity, turbidity — measured at the moment the river decides.
            </p>
          </motion.div>
        </section>

        {/* SECTION 3 — CONTENT GRID */}
        <section id="stories" className="relative px-6 py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-flood-safe">Field reports</p>
                <h3 className="mt-2 text-4xl font-bold tracking-tight text-foreground md:text-5xl">Disaster Stories</h3>
              </div>
              <Button variant="ghost" className="text-foreground/70 hover:text-foreground">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {stories.map((s) => (
                <Card key={s.title} className="glass border-white/10 bg-transparent text-foreground transition-transform hover:-translate-y-1">
                  <CardContent className="p-6">
                    <span className="text-xs font-semibold uppercase tracking-widest text-flood-safe">{s.tag}</span>
                    <h4 className="mt-3 text-xl font-semibold leading-snug">{s.title}</h4>
                    <p className="mt-3 text-sm text-foreground/65">{s.excerpt}</p>
                    <div className="mt-5 flex items-center text-sm text-flood-safe">
                      Read story <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div id="blog" className="mb-12 mt-24 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-flood-warn">Latest dispatches</p>
                <h3 className="mt-2 text-4xl font-bold tracking-tight text-foreground md:text-5xl">News</h3>
              </div>
              <Newspaper className="h-6 w-6 text-foreground/40" />
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {news.map((n) => (
                <Card key={n.title} className="glass border-white/10 bg-transparent text-foreground transition-transform hover:-translate-y-1">
                  <CardContent className="p-6">
                    <span className="text-xs font-semibold uppercase tracking-widest text-flood-warn">{n.tag}</span>
                    <h4 className="mt-3 text-xl font-semibold leading-snug">{n.title}</h4>
                    <p className="mt-3 text-sm text-foreground/65">{n.excerpt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <footer id="about" className="mx-auto mt-32 max-w-6xl border-t border-white/10 pt-10 text-sm text-foreground/50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span>© Hydrowatch · Disaster Intelligence Platform</span>
              <span>Built for resilience.</span>
            </div>
          </footer>
        </section>
      </main>
    </>
  );
}
