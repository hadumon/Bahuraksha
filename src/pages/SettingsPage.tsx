import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/useAuth";
import { optInWhatsApp, optOutWhatsApp } from "@/lib/bahuraksha-api";
import { Phone, Bell, BellOff, Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("phone, whatsapp_opt_in")
        .eq("id", user.id)
        .single();
      return data as { phone: string | null; whatsapp_opt_in: boolean } | null;
    },
  });

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? "");
      setOptIn(profile.whatsapp_opt_in);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        phone: phone || null,
        whatsapp_opt_in: optIn,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save settings", { description: error.message });
      setSaving(false);
      return;
    }

    if (optIn && phone) {
      const result = await optInWhatsApp(user.id, phone);
      if (result.status !== "ok") {
        toast.warning("Saved locally but WhatsApp opt-in API unavailable");
      }
    } else if (!optIn) {
      await optOutWhatsApp(user.id);
    }

    setSaving(false);
    toast.success("Notification settings saved");
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your notification preferences
          </p>
        </div>

        <div className="gradient-card rounded-xl border p-6 space-y-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            WhatsApp Alert Preferences
          </h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Phone Number (WhatsApp)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+97798XXXXXXXX"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Format: +977 followed by your 10-digit Nepali phone number
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Receive WhatsApp Alerts</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get real-time flood and landslide warnings via WhatsApp
              </p>
            </div>
            <button
              onClick={() => setOptIn(!optIn)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                optIn ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  optIn ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
            {optIn ? (
              <Bell className="w-4 h-4 text-green-500 shrink-0" />
            ) : (
              <BellOff className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <p>
              {optIn
                ? "You will receive WhatsApp alerts for high-risk flood and landslide events in your area."
                : "You are currently opted out of WhatsApp alerts. Toggle on to receive warnings."}
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-white text-sm flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
