import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { hasPermission, routeToPermission, type UserRole } from "@/lib/permissions";
import { AlertTriangle } from "lucide-react";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRouteFallback({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-xl border border-border p-6 bg-secondary">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Authentication Required
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {message ?? "Please log in to access this page. If you don&apos;t have an account, create one now."}
        </p>
        <Link
          to="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}

function ForbiddenFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-xl border border-border p-6 bg-secondary">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-risk-evacuate/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-risk-evacuate" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You do not have the required permissions to access this page. Contact an administrator if you need access.
        </p>
        <Link
          to="/dashboard"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();
  const skipAuth = import.meta.env.VITE_DISABLE_AUTH === "true";

  if (skipAuth) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading session...
      </div>
    );
  }

  if (!user) {
    return <ProtectedRouteFallback />;
  }

  const permission = routeToPermission(location.pathname);
  const roles = allowedRoles ?? ["admin", "ops", "analyst", "field", "viewer"];

  if (permission && !hasPermission(userRole, permission)) {
    return <ForbiddenFallback />;
  }

  if (roles.length > 0 && userRole && !roles.includes(userRole)) {
    return <ForbiddenFallback />;
  }

  return <Outlet />;
}
