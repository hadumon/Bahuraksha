export type UserRole = "admin" | "ops" | "analyst" | "field" | "viewer";

export type Permission =
  | "view:dashboard"
  | "view:risk-map"
  | "view:monitoring"
  | "view:flood-detection"
  | "view:alerts"
  | "view:citizen-reports"
  | "view:data-sources"
  | "view:about"
  | "view:landslides"
  | "view:admin"
  | "manage:alerts"
  | "manage:citizen-reports"
  | "manage:users"
  | "submit:field-reports";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "view:dashboard", "view:risk-map", "view:monitoring", "view:flood-detection", "view:alerts",
    "view:citizen-reports", "view:data-sources", "view:about",
    "view:landslides", "view:admin",
    "manage:alerts", "manage:citizen-reports", "manage:users",
    "submit:field-reports",
  ],
  ops: [
    "view:dashboard", "view:risk-map", "view:monitoring", "view:flood-detection", "view:alerts",
    "view:citizen-reports", "view:data-sources", "view:about",
    "view:landslides",
    "manage:alerts", "manage:citizen-reports",
  ],
  analyst: [
    "view:dashboard", "view:risk-map", "view:monitoring", "view:flood-detection",
    "view:data-sources", "view:about", "view:landslides",
  ],
  field: [
    "view:dashboard", "view:risk-map", "view:monitoring", "view:flood-detection",
    "view:citizen-reports", "view:about",
    "submit:field-reports",
  ],
  viewer: [
    "view:dashboard", "view:risk-map", "view:about",
  ],
};

export const ROLES_METADATA: Record<UserRole, { label: string; description: string; color: string }> = {
  admin: { label: "Admin", description: "Full system access, user management", color: "text-red-500" },
  ops: { label: "Operator", description: "Operational management, alerts, reports", color: "text-orange-500" },
  analyst: { label: "Analyst", description: "Data analysis and monitoring", color: "text-blue-500" },
  field: { label: "Field Officer", description: "Field reports and observations", color: "text-green-500" },
  viewer: { label: "Viewer", description: "Read-only access", color: "text-gray-500" },
};

export function hasPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function routeToPermission(path: string): Permission | null {
  const map: Record<string, Permission> = {
    "/dashboard": "view:dashboard",
    "/risk-map": "view:risk-map",
    "/monitoring": "view:monitoring",
    "/flood-detection": "view:flood-detection",
    "/alerts": "view:alerts",
    "/citizen-reports": "view:citizen-reports",
    "/data-sources": "view:data-sources",
    "/about": "view:about",

    "/landslides": "view:landslides",
    "/admin": "view:admin",
    "/admin/users": "view:admin",
  };
  return map[path] ?? null;
}
