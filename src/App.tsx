import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AnimatePresence, motion } from "framer-motion";
import NotFound from "./pages/NotFound";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Lazy load pages for better performance
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RiskMapPage = lazy(() => import("./pages/RiskMapPage"));
const MonitoringPage = lazy(() => import("./pages/MonitoringPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const CitizenReportsPage = lazy(() => import("./pages/CitizenReportsPage"));
const DataSourcesPage = lazy(() => import("./pages/DataSourcesPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const GlofPage = lazy(() => import("./pages/GlofPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const DisastersPage = lazy(() => import("./pages/DisastersPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-400" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Page transition wrapper
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Animated Routes component
function AnimatedRoutes() {
  const location = useLocation();

  const getComponent = (path: string) => {
    switch (path) {
      case "/": return <LandingPage />;
      case "/login": return <LoginPage />;
      case "/dashboard": return <Index />;
      case "/risk-map": return <RiskMapPage />;
      case "/monitoring": return <MonitoringPage />;
      case "/alerts": return <AlertsPage />;
      case "/citizen-reports": return <CitizenReportsPage />;
      case "/data-sources": return <DataSourcesPage />;
      case "/about": return <AboutPage />;
      case "/glof": return <GlofPage />;
      case "/blog": return <BlogPage />;
      case "/disasters": return <DisastersPage />;
      default: return null;
    }
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              <PageTransition>
                <LandingPage />
              </PageTransition>
            }
          />
          <Route
            path="/login"
            element={
              <PageTransition>
                <LoginPage />
              </PageTransition>
            }
          />
          <Route
            path="/blog"
            element={
              <PageTransition>
                <BlogPage />
              </PageTransition>
            }
          />
          <Route
            path="/disasters"
            element={
              <PageTransition>
                <DisastersPage />
              </PageTransition>
            }
          />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/dashboard"
              element={
                <PageTransition>
                  <Index />
                </PageTransition>
              }
            />
            <Route
              path="/risk-map"
              element={
                <PageTransition>
                  <RiskMapPage />
                </PageTransition>
              }
            />
            <Route
              path="/monitoring"
              element={
                <PageTransition>
                  <MonitoringPage />
                </PageTransition>
              }
            />
            <Route
              path="/alerts"
              element={
                <PageTransition>
                  <AlertsPage />
                </PageTransition>
              }
            />
            <Route
              path="/citizen-reports"
              element={
                <PageTransition>
                  <CitizenReportsPage />
                </PageTransition>
              }
            />
            <Route
              path="/data-sources"
              element={
                <PageTransition>
                  <DataSourcesPage />
                </PageTransition>
              }
            />
            <Route
              path="/about"
              element={
                <PageTransition>
                  <AboutPage />
                </PageTransition>
              }
            />
            <Route
              path="/glof"
              element={
                <PageTransition>
                  <GlofPage />
                </PageTransition>
              }
            />
          </Route>

          {/* 404 */}
          <Route
            path="*"
            element={
              <PageTransition>
                <NotFound />
              </PageTransition>
            }
          />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="bahuraksha-ui-theme">
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={100}>
          <Sonner
            position="bottom-right"
            toastOptions={{
              className: "bg-card border-border",
            }}
          />
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
