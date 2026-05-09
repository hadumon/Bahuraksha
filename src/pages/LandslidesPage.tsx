import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Mountain, AlertTriangle, CloudRain, Activity, MapPin, ChevronRight, Wind } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";

// Mock data for landslide prediction chart
const predictionData = [
  { date: "May 01", soilMoisture: 40, risk: 10 },
  { date: "May 02", soilMoisture: 45, risk: 15 },
  { date: "May 03", soilMoisture: 55, risk: 30 },
  { date: "May 04", soilMoisture: 70, risk: 60 },
  { date: "May 05", soilMoisture: 85, risk: 85 },
  { date: "May 06", soilMoisture: 80, risk: 75 },
  { date: "May 07", soilMoisture: 60, risk: 40 },
];

const riskZones = [
  { id: 1, name: "Sindhupalchok", risk: "evacuate", probability: 92, status: "Critical slope failure detected" },
  { id: 2, name: "Rasuwa", risk: "warning", probability: 75, status: "High soil saturation" },
  { id: 3, name: "Dolakha", risk: "watch", probability: 45, status: "Moderate rainfall forecast" },
];

export default function LandslidesPage() {
  const [activeZone, setActiveZone] = useState(riskZones[0]);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Mountain className="w-8 h-8 text-amber-500" />
              Landslide Prediction
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Geospatial susceptibility analysis & real-time slope monitoring
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">Elevated Risk Active</span>
          </div>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Overall Risk Level</p>
              <Activity className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">Critical</p>
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" /> 2 zones require evacuation
            </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Avg Soil Moisture</p>
              <CloudRain className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">85%</p>
            <p className="text-xs text-blue-400 mt-1">
              +15% since yesterday
            </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Slope Instability</p>
              <Mountain className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">High</p>
            <p className="text-xs text-amber-400 mt-1">
              0.4m displacement detected
            </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Seismic Activity</p>
              <Wind className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">Normal</p>
            <p className="text-xs text-emerald-400 mt-1">
              No recent tremors
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 gradient-card border border-border rounded-xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full" />
            <h3 className="text-lg font-bold text-foreground mb-1">Risk vs Soil Saturation</h3>
            <p className="text-sm text-muted-foreground mb-6">7-day correlation analysis</p>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={predictionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" name="Risk Probability (%)" />
                  <Area type="monotone" dataKey="soilMoisture" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorMoisture)" name="Soil Moisture (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Susceptibility Zones List */}
          <div className="gradient-card border border-border rounded-xl p-5 shadow-xl flex flex-col">
            <h3 className="text-lg font-bold text-foreground mb-4">Susceptible Zones</h3>
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2">
              {riskZones.map((zone) => (
                <motion.div 
                  key={zone.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveZone(zone)}
                  className={`p-4 rounded-lg cursor-pointer border transition-colors ${
                    activeZone.id === zone.id 
                      ? 'bg-secondary/50 border-primary/50' 
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{zone.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded flex items-center gap-1 ${
                      zone.risk === 'evacuate' ? 'bg-red-500/20 text-red-500' : 
                      zone.risk === 'warning' ? 'bg-amber-500/20 text-amber-500' : 
                      'bg-emerald-500/20 text-emerald-500'
                    }`}>
                      {zone.risk}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Failure Probability</span>
                    <span className="text-xs font-mono font-bold">{zone.probability}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full ${
                        zone.risk === 'evacuate' ? 'bg-red-500' : 
                        zone.risk === 'warning' ? 'bg-amber-500' : 
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${zone.probability}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{zone.status}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
