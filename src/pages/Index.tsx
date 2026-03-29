import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Satellite,
  Users,
  Gauge,
  Brain,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/dashboard/StatCard";
import AlertFeed from "@/components/dashboard/AlertFeed";
import RiverLevelChart from "@/components/dashboard/RiverLevelChart";
import ZoneRiskTable from "@/components/dashboard/ZoneRiskTable";
import RainfallChart from "@/components/dashboard/RainfallChart";
import { systemStats } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";

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

export default function Index() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery<AlertRow[]>(
    ["alerts"],
    async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  );

  useEffect(() => {
    const channel = supabase
      .channel("alerts-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => {
          queryClient.invalidateQueries(["alerts"]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const activeAlerts = alerts.filter((alert) => alert.is_active).length;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Command Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bagmati Basin • Real-time flood & landslide intelligence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-risk-safe animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">
              System Online
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
          <StatCard
            title="Active Alerts"
            value={isLoading ? "…" : activeAlerts}
            icon={AlertTriangle}
            variant="danger"
            subtitle={`${activeAlerts} active`}
          />
          <StatCard
            title="Stations"
            value={systemStats.totalStations}
            icon={Activity}
            variant="primary"
            subtitle="All reporting"
          />
          <StatCard
            title="Sensors"
            value={systemStats.activeSensors}
            icon={Gauge}
            subtitle="23 of 25 online"
          />
          <StatCard
            title="Citizen Reports"
            value={systemStats.citizenReports}
            icon={Users}
            subtitle="Today"
          />
          <StatCard
            title="Model Accuracy"
            value={`${systemStats.modelAccuracy}%`}
            icon={Brain}
            variant="success"
            subtitle="LSTM flood model"
          />
          <StatCard
            title="Prediction"
            value={systemStats.predictionHorizon}
            icon={Satellite}
            subtitle="Lead time"
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <RiverLevelChart />
            <ZoneRiskTable />
          </div>
          <div className="space-y-6">
            <AlertFeed alerts={alerts} />
            <RainfallChart />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
