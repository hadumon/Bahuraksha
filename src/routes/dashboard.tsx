import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RiverScene } from "@/components/flood/RiverScene";
import { Dashboard } from "@/components/flood/Dashboard";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Operations Console · Hydrowatch" },
      { name: "description", content: "Live 3D flood monitoring dashboard with river telemetry and risk meters." },
    ],
  }),
});

function DashboardPage() {
  const [waterLevel, setWaterLevel] = useState(0.3);
  const [flowSpeed, setFlowSpeed] = useState(1);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <h1 className="sr-only">Hydrowatch Operations Console</h1>
      <div className="absolute inset-0">
        <RiverScene waterLevel={waterLevel} flowSpeed={flowSpeed} />
      </div>
      <Link
        to="/"
        className="glass absolute right-6 top-6 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-foreground/80 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to site
      </Link>
      <Dashboard
        waterLevel={waterLevel}
        flowSpeed={flowSpeed}
        setWaterLevel={setWaterLevel}
        setFlowSpeed={setFlowSpeed}
      />
    </main>
  );
}
