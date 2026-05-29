import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/useAuth";
import {
  ROLES_METADATA,
  type UserRole,
} from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, Search } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const { userRole, user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (userRole !== "admin") return;
    loadProfiles();
  }, [userRole]);

  async function loadProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Failed to load profiles:", error);
        toast.error("Failed to load users", { description: error.message });
        return;
      }
      setProfiles(data ?? []);
    } catch (e: any) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(profileId: string, newRole: string) {
    if (newRole === user?.id && profileId === user?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    setUpdatingId(profileId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", profileId);
      if (error) {
        toast.error("Failed to update role", { description: error.message });
        return;
      }
      toast.success("Role updated successfully");
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role: newRole } : p)),
      );
    } catch (e: any) {
      toast.error("Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  if (userRole !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const filtered = profiles.filter(
    (p) =>
      (p.email?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (p.full_name?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-ocean-400" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user roles and permissions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadProfiles} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ocean-400" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Users ({filtered.length})</CardTitle>
            <CardDescription>
              Assign roles to control what each user can access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((profile) => {
                    const roleMeta = ROLES_METADATA[profile.role as UserRole] ?? {
                      label: profile.role,
                      description: "",
                      color: "text-gray-500",
                    };
                    const isSelf = profile.id === user?.id;
                    return (
                      <tr key={profile.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {profile.full_name || "—"}
                            </span>
                            {isSelf && (
                              <span className="text-xs bg-ocean-400/10 text-ocean-400 px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {profile.email || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium capitalize ${roleMeta.color}`}>
                              {roleMeta.label}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Select
                              value={profile.role}
                              disabled={updatingId === profile.id || isSelf}
                              onValueChange={(val) => handleRoleChange(profile.id, val)}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(ROLES_METADATA) as [UserRole, typeof ROLES_METADATA[UserRole]][]).map(
                                  ([role, meta]) => (
                                    <SelectItem key={role} value={role} className="text-xs">
                                      <span className={meta.color}>{meta.label}</span>
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                            {updatingId === profile.id && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Role Descriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.entries(ROLES_METADATA) as [UserRole, typeof ROLES_METADATA[UserRole]][]).map(
              ([role, meta]) => (
                <div key={role} className="p-4 rounded-xl border border-border bg-secondary/30">
                  <h3 className={`font-semibold capitalize ${meta.color}`}>{meta.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
