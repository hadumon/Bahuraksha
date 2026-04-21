import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Activity, AlertCircle, ArrowRight, Loader2, Newspaper } from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { WaterfallScene } from "@/components/flood/WaterfallScene";
import { ScrollRail } from "@/components/flood/ScrollRail";
import { TelemetryHUD } from "@/components/flood/TelemetryHUD";
import { FloodEventBanner } from "@/components/flood/FloodEventBanner";
import { useAuth } from "@/components/auth/useAuth";
import { useTelemetry } from "@/hooks/useTelemetry";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const stories = [
  {
    tag: "STORY",
    title: "Kerala Monsoon: A Village Rebuilds",
    excerpt: "How early-warning sensors gave 4,000 residents a 6-hour head start.",
  },
  {
    tag: "STORY",
    title: "The Mississippi's New Memory",
    excerpt: "ML models trained on a century of river data now predict surge crests within 12cm.",
  },
  {
    tag: "STORY",
    title: "Bangkok's Tidal Defense",
    excerpt: "Inside the floating barrier network protecting 11 million people.",
  },
];

const news = [
  {
    tag: "NEWS",
    title: "EU Funds 240M Flood Sensor Network",
    excerpt: "Twelve nations join the continental telemetry grid set for 2026 rollout.",
  },
  {
    tag: "NEWS",
    title: "NOAA Releases 2025 Atlantic Forecast",
    excerpt: "Above-average storm season expected; coastal cities urged to upgrade systems.",
  },
  {
    tag: "NEWS",
    title: "AI Discharge Models Beat Legacy Tools",
    excerpt: "New benchmark shows 38% improvement in 72-hour flood prediction accuracy.",
  },
];

export default function LandingPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const fallOpacity = useTransform(scrollYProgress, [0.25, 0.45, 0.6], [0, 1, 0]);
  const riverY = useTransform(scrollYProgress, [0, 1], ["-6%", "16%"]);
  const riverScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const riverGlowOpacity = useTransform(scrollYProgress, [0, 0.2, 0.6, 1], [0.9, 0.75, 0.45, 0.2]);
  const telemetry = useTelemetry(1500);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(email.trim(), password);

    if (result.error) {
      setError(result.error.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-0">
        <WaterfallScene telemetry={telemetry} />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ opacity: riverGlowOpacity }}
        >
          <motion.div
            className="absolute left-1/2 top-[-8%] h-[145%] w-[18rem] -translate-x-1/2 rounded-[999px] bg-[linear-gradient(180deg,rgba(64,211,255,0.02)_0%,rgba(64,211,255,0.22)_18%,rgba(17,190,212,0.4)_50%,rgba(8,84,120,0.14)_82%,rgba(0,0,0,0)_100%)] blur-3xl md:w-104"
            style={{ y: riverY, scaleY: riverScale }}
          />
          <motion.div
            className="absolute left-1/2 top-[-2%] h-[130%] w-32 -translate-x-1/2 rounded-[999px] bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(151,245,255,0.28)_16%,rgba(86,223,255,0.42)_46%,rgba(22,156,210,0.18)_76%,rgba(0,0,0,0)_100%)] blur-2xl md:w-44"
            animate={{ y: ["-2%", "3%", "-2%"] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute left-1/2 top-[8%] h-[90%] w-16 -translate-x-1/2 rounded-[999px] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(193,248,255,0.2)_22%,rgba(255,255,255,0.32)_44%,rgba(125,222,255,0.14)_72%,rgba(255,255,255,0)_100%)] blur-xl md:w-24"
            animate={{ y: ["0%", "8%", "0%"] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/30 via-transparent to-background/60" />
      </div>

      <PublicNavbar />
      <ScrollRail />
      <TelemetryHUD t={telemetry} />
      <FloodEventBanner event={telemetry.event} />

      <main className="relative z-10">
        <section id="hero" className="relative flex min-h-screen items-center px-6">
          <motion.div
            style={{ opacity: heroOpacity }}
            className="mx-auto grid w-full max-w-6xl gap-10 pt-24 md:grid-cols-2 md:items-center"
          >
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs uppercase tracking-widest text-flood-safe">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-flood-safe" />
                Live | {telemetry.sensorsOnline.toLocaleString()} sensors | {telemetry.discharge}{" "}
                m3/s
              </div>
              <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-7xl">
                Disaster Intelligence
                <br />
                for <span className="text-flood-safe">Flood Management</span>
              </h1>
              <p className="mt-6 max-w-md text-lg text-foreground/70">
                Stream telemetry from rivers, deltas, and coastlines. Predict crests. Protect
                communities before the water rises.
              </p>
            </div>

            <Card className="glass-strong border-white/10 bg-transparent text-foreground">
              <CardContent className="p-7">
                <h2 className="text-xl font-semibold">Sign in to your operations console</h2>
                <p className="mt-1 text-sm text-foreground/60">
                  Access live basins, alerts, and forecast maps.
                </p>

                <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@agency.gov"
                    autoComplete="email"
                    disabled={isSubmitting}
                    className="border-white/15 bg-white/5 text-foreground placeholder:text-foreground/40"
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className="border-white/15 bg-white/5 text-foreground placeholder:text-foreground/40"
                  />

                  {error ? (
                    <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl border border-cyan-200/25 bg-cyan-300 text-slate-950 shadow-[0_10px_35px_rgba(103,232,249,0.28)] hover:bg-cyan-200"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In <ArrowRight className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <p className="mt-4 text-center text-xs text-foreground/50">
                  Need a new account?{" "}
                  <Link to="/login" className="font-semibold text-cyan-200 underline-offset-4 hover:underline">
                    Sign up here
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-foreground/40">
            Scroll to descend
          </div>
        </section>

        <section id="fall" className="relative flex min-h-[150vh] items-center justify-center px-6">
          <motion.div
            style={{ opacity: fallOpacity }}
            className="sticky top-1/3 mx-auto max-w-5xl text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs uppercase tracking-widest text-flood-warn">
              <Activity className="h-3 w-3" /> Intensity rising
            </div>
            <h2 className="text-6xl font-bold leading-[0.95] tracking-tighter text-foreground md:text-[9rem]">
              Real-time
              <br />
              <span className="bg-linear-to-b from-foreground to-flood-danger bg-clip-text text-transparent">
                Monitoring.
              </span>
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-foreground/70">
              Every second, telemetry surges across our network. Discharge, velocity, turbidity
              measured at the moment the river decides.
            </p>
          </motion.div>
        </section>

        <section id="stories" className="relative px-6 py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-flood-safe">Field reports</p>
                <h3 className="mt-2 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                  Disaster Stories
                </h3>
              </div>
              <Button variant="ghost" className="text-foreground/70 hover:text-foreground">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {stories.map((story) => (
                <Card
                  key={story.title}
                  className="glass border-white/10 bg-transparent text-foreground transition-transform hover:-translate-y-1"
                >
                  <CardContent className="p-6">
                    <span className="text-xs font-semibold uppercase tracking-widest text-flood-safe">
                      {story.tag}
                    </span>
                    <h4 className="mt-3 text-xl font-semibold leading-snug">{story.title}</h4>
                    <p className="mt-3 text-sm text-foreground/65">{story.excerpt}</p>
                    <div className="mt-5 flex items-center text-sm text-flood-safe">
                      Read story <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div id="about" className="mb-12 mt-24 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-flood-warn">
                  Latest dispatches
                </p>
                <h3 className="mt-2 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                  News
                </h3>
              </div>
              <Newspaper className="h-6 w-6 text-foreground/40" />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {news.map((item) => (
                <Card
                  key={item.title}
                  className="glass border-white/10 bg-transparent text-foreground transition-transform hover:-translate-y-1"
                >
                  <CardContent className="p-6">
                    <span className="text-xs font-semibold uppercase tracking-widest text-flood-warn">
                      {item.tag}
                    </span>
                    <h4 className="mt-3 text-xl font-semibold leading-snug">{item.title}</h4>
                    <p className="mt-3 text-sm text-foreground/65">{item.excerpt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <footer className="mx-auto mt-32 max-w-6xl border-t border-white/10 pt-10 text-sm text-foreground/50">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span>Bahuraksha | Disaster Intelligence Platform</span>
                <span>Built for resilience.</span>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </>
  );
}
