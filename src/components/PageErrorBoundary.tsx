import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "react-router-dom";

interface PageErrorBoundaryProps {
  children: ReactNode;
  pageName?: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("PageErrorBoundary caught:", error.message, error.stack, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-linear-to-br from-risk-evacuate/20 to-risk-warning/20 flex items-center justify-center animate-pulse">
                <AlertTriangle className="h-10 w-10 text-risk-evacuate" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">
                {this.props.pageName ? `${this.props.pageName} unavailable` : "Page unavailable"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {this.state.error?.message ?? "Unknown error"}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-all"
              >
                <Home className="h-4 w-4" />
                Home
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              If this persists, contact the system administrator.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
