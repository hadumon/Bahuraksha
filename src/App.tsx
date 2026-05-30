import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import PageSkeleton from "@/components/PageSkeleton";

import { AnimatePresence, motion } from "framer-motion";
import NotFound from "./pages/NotFound";
import { Suspense, lazy } from "react";

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
const BlogPage = lazy(() => import("./pages/BlogPage"));
const DisastersPage = lazy(() => import("./pages/DisastersPage"));
const LandslidesPage = lazy(() => import("./pages/LandslidesPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function skeletonVariant(path: string) {
  if (path.startsWith("/admin")) return "list";
  if (path.startsWith("/dashboard")) return "dashboard";
  if (path.startsWith("/risk-map")) return "map";
  if (path.startsWith("/monitoring")) return "detail";
  if (path.startsWith("/citizen-reports")) return "list";
  if (path.startsWith("/data-sources")) return "list";
  return "default";
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
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
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route
          path="/"
          element={
            <PageErrorBoundary pageName="Home">
              <Suspense fallback={<PageSkeleton variant="default" />}>
                <PageTransition>
                  <LandingPage />
                </PageTransition>
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="/login"
          element={
            <PageErrorBoundary pageName="Login">
              <Suspense fallback={<PageSkeleton variant="default" />}>
                <PageTransition>
                  <LoginPage />
                </PageTransition>
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="/blog"
          element={
            <PageErrorBoundary pageName="Blog">
              <Suspense fallback={<PageSkeleton variant="list" />}>
                <PageTransition>
                  <BlogPage />
                </PageTransition>
              </Suspense>
            </PageErrorBoundary>
          }
        />
        <Route
          path="/disasters"
          element={
            <PageErrorBoundary pageName="Disasters">
              <Suspense fallback={<PageSkeleton variant="list" />}>
                <PageTransition>
                  <DisastersPage />
                </PageTransition>
              </Suspense>
            </PageErrorBoundary>
          }
        />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={
              <PageErrorBoundary pageName="Dashboard">
                <Suspense fallback={<PageSkeleton variant="dashboard" />}>
                  <PageTransition>
                    <Index />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
          <Route
            path="/risk-map"
            element={
              <PageErrorBoundary pageName="Risk Map">
                <Suspense fallback={<PageSkeleton variant="map" />}>
                  <PageTransition>
                    <RiskMapPage />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
          <Route
            path="/monitoring"
            element={
              <PageErrorBoundary pageName="River Monitoring">
                <Suspense fallback={<PageSkeleton variant="detail" />}>
                  <PageTransition>
                    <MonitoringPage />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
          <Route
            path="/alerts"
            element={
              <PageErrorBoundary pageName="Alerts">
                <Suspense fallback={<PageSkeleton variant="list" />}>
                  <PageTransition>
                    <AlertsPage />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
          <Route
            path="/citizen-reports"
            element={
              <PageErrorBoundary pageName="Citizen Reports">
                <Suspense fallback={<PageSkeleton variant="list" />}>
                  <PageTransition>
                    <CitizenReportsPage />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
          <Route
            path="/data-sources"
            element={
              <PageErrorBoundary pageName="Data Sources">
                <Suspense fallback={<PageSkeleton variant="list" />}>
                  <PageTransition>
                    <DataSourcesPage />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
          <Route
            path="/about"
            element={
              <PageErrorBoundary pageName="About">
                <Suspense fallback={<PageSkeleton variant="detail" />}>
                  <PageTransition>
                    <AboutPage />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
          <Route
            path="/landslides"
            element={
              <PageErrorBoundary pageName="Landslide Prediction">
                <Suspense fallback={<PageSkeleton variant="detail" />}>
                  <PageTransition>
                    <LandslidesPage />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
          <Route
            path="/admin/users"
            element={
              <PageErrorBoundary pageName="User Management">
                <Suspense fallback={<PageSkeleton variant="list" />}>
                  <PageTransition>
                    <AdminUsersPage />
                  </PageTransition>
                </Suspense>
              </PageErrorBoundary>
            }
          />
        </Route>

        {/* 404 */}
        <Route
          path="*"
          element={
            <PageErrorBoundary>
              <PageTransition>
                <NotFound />
              </PageTransition>
            </PageErrorBoundary>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <ErrorBoundary>
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
  </ErrorBoundary>
);

export default App;
