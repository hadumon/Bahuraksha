import { ErrorBoundary } from "./ErrorBoundary";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "react-router-dom";

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  pageName?: string;
}

export default function PageErrorBoundary({ children, pageName }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-linear-to-br from-risk-evacuate/20 to-risk-warning/20 flex items-center justify-center animate-pulse">
                <AlertTriangle className="h-10 w-10 text-risk-evacuate" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">
                {pageName ? `${pageName} unavailable` : "Page unavailable"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                This section failed to load. It might be a temporary connection issue or the data
                source may be offline.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-all"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              If this persists, contact the system administrator.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
