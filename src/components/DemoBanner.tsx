import { useQuery } from "@tanstack/react-query";
import { getLatest } from "@/lib/bahuraksha-api";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

const isTestMode = import.meta.env.VITE_DISABLE_AUTH === "true";

export default function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  const latest = useQuery({
    queryKey: ["bahuraksha-latest-prediction"],
    queryFn: getLatest,
    retry: 0,
    staleTime: 1000 * 60 * 10,
  });

  const isMock = latest.data?.isMock === true;

  if (dismissed) return null;
  if (!isTestMode && !isMock) return null;

  return (
    <div className="relative z-50 flex items-center justify-center gap-3 bg-gradient-to-r from-risk-warning/90 via-risk-evacuate/80 to-risk-warning/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        Demo Mode — All data is simulated for demonstration purposes.{" "}
        {isTestMode && "(Auth is disabled)"}
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        aria-label="Dismiss demo banner"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
