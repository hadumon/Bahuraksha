import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import AlertFeed from "@/components/dashboard/AlertFeed";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendWhatsAppAlert } from "@/lib/bahuraksha-api";
import { Droplets, Mountain, Bell, BellOff, Inbox, CheckCircle2, XCircle } from "lucide-react";

const typeIcons = { flood: Droplets, landslide: Mountain };
const typeLabels = { flood: "Flood", landslide: "Landslide" };

type AlertRow = {
  id: string;
  type: "flood" | "landslide";
  severity: "safe" | "watch" | "warning" | "evacuate";
  title: string;
  message: string;
  zone: string;
  created_at?: string;
  status: "pending" | "approved" | "dismissed";
  is_active: boolean;
};

type AlertFormState = {
  title: string;
  message: string;
  zone: string;
  type: AlertRow["type"];
  severity: AlertRow["severity"];
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<AlertFormState>({
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
    () => alerts.filter((a) => a.status === "approved").length,
    [alerts],
  );

  const pendingCount = useMemo(
    () => alerts.filter((a) => a.status === "pending").length,
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
      status: "approved" as const,
      id: crypto.randomUUID(),
    };

    const { error } = await supabase.from("alerts").insert(newAlert);
    if (error) {
      toast.error("Failed to create alert", { description: error.message });
      return;
    }

    setFormState({
      title: "",
      message: "",
      zone: "",
      type: "flood",
      severity: "watch",
    });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });

    const wa = await sendWhatsAppAlert({
      zone: newAlert.zone,
      title: newAlert.title,
      message: newAlert.message,
      severity: newAlert.severity,
    });

    if (wa.status === "sent") {
      toast.success("WhatsApp alert sent", {
        description: `${wa.recipients} recipient(s) notified for ${newAlert.zone}`,
      });
    } else {
      toast.info("Alert created", {
        description: wa.note ?? "Twilio not configured — alert logged",
      });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-start gap-3">
          <BellOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">WhatsApp notifications not configured</p>
            <p className="text-amber-700 dark:text-amber-400 mt-0.5">
              Add <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">TWILIO_ACCOUNT_SID</code> and{" "}
              <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">TWILIO_AUTH_TOKEN</code> to{" "}
              <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">.env</code> to send real WhatsApp alerts.
              Currently all alerts are <strong>simulated</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Alert Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All system alerts — SMS, push notifications, dashboard
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Bell className="w-4 h-4" />
              {activeCount} active
            </span>
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <BellOff className="w-4 h-4" />
                {pendingCount} pending
              </span>
            )}
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
                        type:                     e.target.value as "flood" | "landslide",
                      }))
                    }
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="flood">Flood</option>
                    <option value="landslide">Landslide</option>
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
                  <span className="hidden md:block" />
                  <span className="hidden md:block" />
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
                <AlertFeed
                  alerts={alerts.map((alert) => ({
                    ...alert,
                    timestamp: alert.created_at ?? "—",
                  }))}
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-8 text-center">
              <Inbox className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground font-semibold">No alerts yet</p>
              <p className="text-sm text-muted-foreground mt-1">Alerts will appear here once created.</p>
            </div>
          ) : (
          alerts.map((alert) => {
            const Icon = typeIcons[alert.type];
            const isPending = alert.status === "pending";
            const isApproved = alert.status === "approved";
            const isDismissed = alert.status === "dismissed";
            return (
              <div
                key={alert.id}
                className={`gradient-card rounded-xl border p-5 transition-all ${
                  isApproved
                    ? "border-border"
                    : "border-border/50 opacity-60"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
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
                      {isPending && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">
                          <BellOff className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {isApproved && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded">
                          <Bell className="w-3 h-3" /> Approved
                        </span>
                      )}
                      {isDismissed && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                          <XCircle className="w-3 h-3" /> Dismissed
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
                    <div className="flex items-center gap-2 mt-3">
                      {isPending && (
                        <button
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from("alerts")
                                .update({ is_active: true, status: "approved" })
                                .eq("id", alert.id);
                              if (error) {
                                toast.error("Failed to approve", { description: error.message });
                              } else {
                                toast.success("Alert approved");
                                queryClient.invalidateQueries({ queryKey: ["alerts"] });
                                const wa = await sendWhatsAppAlert({
                                  zone: alert.zone,
                                  title: alert.title,
                                  message: alert.message,
                                  severity: alert.severity,
                                });
                                if (wa.status === "sent") {
                                  toast.success("WhatsApp alert sent", {
                                    description: `${alert.zone}: ${alert.severity} risk`,
                                  });
                                } else {
                                  toast.info("WhatsApp not configured", {
                                    description: wa.note ?? "Alert approved locally",
                                  });
                                }
                              }
                            } catch (err) {
                              console.error("Failed to approve alert:", err);
                              toast.error("Failed to approve alert");
                            }
                          }}
                          className="text-xs bg-primary text-white px-3 py-1.5 rounded-md hover:bg-primary/90"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Approve
                        </button>
                      )}
                      {(isPending || isApproved) && (
                        <button
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from("alerts")
                                .update({ is_active: false, status: "dismissed" })
                                .eq("id", alert.id);
                              if (error) {
                                toast.error("Failed to dismiss", { description: error.message });
                              } else {
                                toast.success("Alert dismissed");
                                queryClient.invalidateQueries({ queryKey: ["alerts"] });
                              }
                            } catch (err) {
                              console.error("Failed to dismiss alert:", err);
                              toast.error("Failed to dismiss alert");
                            }
                          }}
                          className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-md hover:bg-border"
                        >
                          <XCircle className="w-3 h-3 mr-1 inline" /> Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
