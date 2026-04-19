import RiskLevelBadge from "./RiskLevelBadge";
import { AlertTriangle, Droplets, Mountain, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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

const typeIcons = {
  flood: { icon: Droplets, color: "text-ocean-400", bg: "bg-ocean-400/15" },
  landslide: { icon: Mountain, color: "text-risk-watch", bg: "bg-risk-watch/15" },
  glof: { icon: AlertTriangle, color: "text-risk-evacuate", bg: "bg-risk-evacuate/15" },
};

interface AlertFeedProps {
  alerts: AlertFeedItem[];
}

export default function AlertFeed({ alerts }: AlertFeedProps) {
  const activeAlerts = alerts.filter((a) => a.is_active);

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-risk-evacuate/15">
            <AlertTriangle className="h-4 w-4 text-risk-evacuate" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Active Alerts
          </h3>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-risk-evacuate/15 px-2.5 py-1 text-xs font-medium text-risk-evacuate">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-risk-evacuate" />
          {activeAlerts.length} active
        </span>
      </div>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {activeAlerts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-risk-safe/15">
                <AlertTriangle className="h-6 w-6 text-risk-safe" />
              </div>
              <p className="text-sm font-medium text-foreground">No Active Alerts</p>
              <p className="mt-1 text-xs text-muted-foreground">
                All systems operating normally
              </p>
            </motion.div>
          ) : (
            activeAlerts.map((alert, index) => {
              const typeConfig = typeIcons[alert.type];
              const Icon = typeConfig.icon;

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:border-border",
                    alert.severity === "evacuate" && "bg-risk-evacuate/5 border-risk-evacuate/30",
                    alert.severity === "warning" && "bg-risk-warning/5 border-risk-warning/30",
                    alert.severity === "watch" && "bg-risk-watch/5 border-risk-watch/30",
                    alert.severity === "safe" && "bg-secondary/30 border-border/50"
                  )}
                >
                  {/* Severity indicator */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full w-1 transition-all",
                      alert.severity === "evacuate" && "bg-risk-evacuate",
                      alert.severity === "warning" && "bg-risk-warning",
                      alert.severity === "watch" && "bg-risk-watch",
                      alert.severity === "safe" && "bg-risk-safe"
                    )}
                  />

                  <div className="flex items-start gap-3 pl-2">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        typeConfig.bg
                      )}
                    >
                      <Icon className={cn("h-4 w-4", typeConfig.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <RiskLevelBadge level={alert.severity} />
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="mt-1.5 text-sm font-semibold text-foreground">
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {alert.message}
                      </p>

                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[10px] rounded-full bg-secondary/50 px-2 py-0.5 text-muted-foreground">
                          {alert.zone}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
