import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import AlertFeed from "@/components/dashboard/AlertFeed";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import { supabase } from "@/integrations/supabase/client";
import { Droplets, Mountain, AlertTriangle, Bell, BellOff } from "lucide-react";

const typeIcons = { flood: Droplets, landslide: Mountain, glof: AlertTriangle };
const typeLabels = { flood: "Flood", landslide: "Landslide", glof: "GLOF" };

type AlertRow = {
  id: string;
  type: "flood" | "landslide" | "glof";
  severity: "safe" | "watch" | "warning" | "evacuate";
  title: string;
  message: string;
  zone: string;
  created_at?: string;
  is_active: boolean;
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({
    title: "",
    message: "",
    zone: "",
    type: "flood",
    severity: "watch",
  });

  const {
    data: alerts = [],
    isLoading,
    error,
  } = useQuery<AlertRow[]>({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("alerts-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["alerts"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const activeCount = useMemo(
    () => alerts.filter((a) => a.is_active).length,
    [alerts],
  );

  const handleCreateAlert = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const newAlert = {
      title: formState.title,
      message: formState.message,
      zone: formState.zone,
      type: formState.type,
      severity: formState.severity,
      is_active: true,
      id: crypto.randomUUID(),
    };

    const { error } = await supabase.from("alerts").insert(newAlert);
    if (error) {
      console.error("Cannot insert alert", error);
    } else {
      setFormState({
        title: "",
        message: "",
        zone: "",
        type: "flood",
        severity: "watch",
      });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Alert Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All system alerts — SMS, push notifications, dashboard
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bell className="w-4 h-4" />
            <span>{activeCount} active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <div className="gradient-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold mb-3">Create New Alert</h2>
              <form onSubmit={handleCreateAlert} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    required
                    value={formState.title}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Title"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    required
                    value={formState.zone}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        zone: e.target.value,
                      }))
                    }
                    placeholder="Zone"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    value={formState.type}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        type: e.target.value as "flood" | "landslide" | "glof",
                      }))
                    }
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="flood">Flood</option>
                    <option value="landslide">Landslide</option>
                    <option value="glof">GLOF</option>
                  </select>
                  <select
                    value={formState.severity}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        severity: e.target.value as
                          | "safe"
                          | "watch"
                          | "warning"
                          | "evacuate",
                      }))
                    }
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="safe">Safe</option>
                    <option value="watch">Watch</option>
                    <option value="warning">Warning</option>
                    <option value="evacuate">Evacuate</option>
                  </select>
                  <span />
                  <span />
                </div>
                <textarea
                  required
                  value={formState.message}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  placeholder="Description"
                  className="w-full min-h-[100px] bg-background border border-border rounded-md px-3 py-2 text-sm"
                />
                <button className="rounded-md bg-primary px-4 py-2 text-white">
                  Create alert
                </button>
              </form>
            </div>
          </div>

          <div className="xl:col-span-1">
            <div className="gradient-card rounded-xl border p-5">
              <h3 className="text-sm font-semibold mb-3">Recent Alerts</h3>
              {isLoading ? (
                <p>Loading...</p>
              ) : error ? (
                <p className="text-danger">Error loading alerts</p>
              ) : (
                <AlertFeed alerts={alerts} />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {alerts.map((alert) => {
            const Icon = typeIcons[alert.type];
            return (
              <div
                key={alert.id}
                className={`gradient-card rounded-xl border p-5 transition-all ${
                  alert.is_active
                    ? "border-border"
                    : "border-border/50 opacity-60"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      alert.severity === "evacuate"
                        ? "bg-risk-evacuate/20"
                        : alert.severity === "warning"
                          ? "bg-risk-warning/20"
                          : alert.severity === "watch"
                            ? "bg-risk-watch/20"
                            : "bg-risk-safe/20"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        alert.severity === "evacuate"
                          ? "text-risk-evacuate"
                          : alert.severity === "warning"
                            ? "text-risk-warning"
                            : alert.severity === "watch"
                              ? "text-risk-watch"
                              : "text-risk-safe"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <RiskLevelBadge level={alert.severity} size="lg" />
                      <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                        {typeLabels[alert.type]}
                      </span>
                      {!alert.is_active && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BellOff className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mt-2">
                      {alert.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>Zone: {alert.zone}</span>
                      <span>
                        {new Date(alert.created_at ?? "").toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
