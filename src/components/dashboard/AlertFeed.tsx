import RiskLevelBadge from "./RiskLevelBadge";
import { AlertTriangle, Droplets, Mountain } from "lucide-react";

type AlertFeedItem = {
  id: string;
  type: "flood" | "landslide" | "glof";
  severity: "safe" | "watch" | "warning" | "evacuate";
  title: string;
  message: string;
  zone: string;
  timestamp: string;
  is_active: boolean;
};

const typeIcons = { flood: Droplets, landslide: Mountain, glof: AlertTriangle };

interface AlertFeedProps {
  alerts: AlertFeedItem[];
}

export default function AlertFeed({ alerts }: AlertFeedProps) {
  const activeAlerts = alerts.filter((a) => a.is_active);

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Active Alerts
        </h3>
        <span className="text-xs font-mono text-risk-evacuate">
          {activeAlerts.length} active
        </span>
      </div>
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {activeAlerts.map((alert) => {
          const Icon = typeIcons[alert.type];
          return (
            <div
              key={alert.id}
              className="p-3 rounded-lg bg-secondary/50 border border-border"
            >
              <div className="flex items-start gap-3">
                <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <RiskLevelBadge level={alert.severity} />
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {alert.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>{" "}
    </div>
  );
}
