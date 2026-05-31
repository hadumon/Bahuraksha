import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, X } from "lucide-react";
import { useApiHealth } from "@/hooks/useApiHealth";
import { useState } from "react";

const LABELS: Record<string, string> = {
  bahuraksha: "Flood Prediction API",
};

export default function ApiDegradationBanner() {
  const backends = useApiHealth();
  const [dismissed, setDismissed] = useState(false);

  const degraded = Object.entries(backends).filter(
    ([, healthy]) => !healthy,
  );

  if (dismissed || degraded.length === 0) return null;

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Backend Degraded</span>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </AlertTitle>
      <AlertDescription>
        {degraded.map(([name]) => LABELS[name] ?? name).join(", ")} is
        unreachable. Predictions may be unavailable or using fallback data.
      </AlertDescription>
    </Alert>
  );
}
