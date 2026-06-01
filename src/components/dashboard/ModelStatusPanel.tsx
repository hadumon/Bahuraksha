import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Brain, CheckCircle2, Satellite } from "lucide-react";
import { getHealth, getLatest } from "@/lib/bahuraksha-api";
import { cn } from "@/lib/utils";

export default function ModelStatusPanel() {
  const health = useQuery({
    queryKey: ["bahuraksha-api-health"],
    queryFn: getHealth,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  const latest = useQuery({
    queryKey: ["bahuraksha-latest-prediction"],
    queryFn: getLatest,
    retry: 1,
    staleTime: 1000 * 60 * 10,
  });

  const hasLatestData = !!latest.data;
  const isHealthy = hasLatestData || (health.data?.model_loaded === true && !health.error);
  const riskScore = latest.data?.prediction?.risk_score;

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-400/15">
            <Brain className="h-4 w-4 text-ocean-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">XGBoost Satellite Model</h3>
            <p className="text-xs text-muted-foreground">
              Sentinel-1/2 water, snow, and flood classifier
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            isHealthy ? "bg-risk-safe/10 text-risk-safe" : "bg-risk-warning/10 text-risk-warning",
          )}
        >
          {isHealthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {health.isLoading ? "Checking" : isHealthy ? "Online" : "Unavailable"}
        </span>
      </div>

      {latest.data?.prediction ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Metric label="Class" value={latest.data.prediction.label.replaceAll("_", " ")} />
          <Metric label="Risk" value={`${riskScore?.toFixed(1) ?? "—"}/100`} />
          <Metric
            label="Confidence"
            value={`${(latest.data.prediction.confidence * 100).toFixed(0)}%`}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-risk-warning/30 bg-risk-warning/10 p-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Satellite className="h-4 w-4 flex-shrink-0 text-risk-warning" />
            <span>
              {latest.isLoading
                ? "Loading latest satellite prediction..."
                : "No latest model prediction is available. The composite risk engine will continue using rainfall, gauge, HEC-RAS, and stored zone values."}
            </span>
          </div>
        </div>
      )}

      {(health.error || latest.error) && !hasLatestData && (
        <p className="mt-3 text-[11px] text-risk-warning">
          API note: the deployed model endpoint did not respond successfully. Check Render health,
          cold-start time, and installed Python dependencies.
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
      <div className="truncate text-sm font-semibold capitalize text-foreground">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
