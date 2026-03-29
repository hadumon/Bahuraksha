import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export function ProtectedRouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-xl border border-border p-6 bg-secondary">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Authentication Required
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Please log in to access this page. If you don&apos;t have an account,
          create one now.
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

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
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

  return <Outlet />;
}
