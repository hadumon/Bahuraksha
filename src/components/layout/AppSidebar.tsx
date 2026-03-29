import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Map,
  Activity,
  AlertTriangle,
  Users,
  Database,
  Info,
  Shield,
  X,
  Snowflake,
} from "lucide-react";
import { useAuth } from "@/components/auth/useAuth";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/risk-map", icon: Map, label: "Risk Map" },
  { path: "/monitoring", icon: Activity, label: "River Monitoring" },
  { path: "/glof", icon: Snowflake, label: "GLOF Monitoring" },
  { path: "/alerts", icon: AlertTriangle, label: "Alerts" },
  { path: "/citizen-reports", icon: Users, label: "Citizen Reports" },
  { path: "/data-sources", icon: Database, label: "Data Sources" },
  { path: "/about", icon: Info, label: "About" },
];

interface Props {
  isMobile: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

function BrandLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
        <Shield className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="overflow-hidden">
        <h1 className="text-sm font-bold text-foreground tracking-wide">
          BAHURAKSHA
        </h1>
        <p className="text-[10px] text-muted-foreground">
          Bahuraksha | Flood Intelligence
        </p>
      </div>
    </Link>
  );
}

export default function AppSidebar({ isMobile, mobileOpen, onClose }: Props) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.2 }}
            className="fixed left-0 top-0 h-screen w-[280px] bg-sidebar border-r border-sidebar-border z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border gap-3">
              <BrandLink onClick={onClose} />
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavList location={location} onNavigate={onClose} />
            <div className="px-3 py-3 border-t border-sidebar-border text-xs text-muted-foreground">
              {user ? (
                <div className="space-y-2">
                  <p className="truncate">Signed in as: {user.email}</p>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left text-danger hover:text-foreground"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    navigate("/login");
                  }}
                  className="w-full text-left text-primary hover:text-primary-foreground"
                >
                  Sign in / Sign up
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-sidebar border-r border-sidebar-border z-50 flex flex-col">
      <div className="px-4 h-16 border-b border-sidebar-border flex items-center">
        <BrandLink />
      </div>
      <NavList location={location} />

      <div className="px-3 py-3 border-t border-sidebar-border text-xs text-muted-foreground">
        {user ? (
          <div className="space-y-2">
            <p className="truncate">Signed in as: {user.email}</p>
            <button
              onClick={handleLogout}
              className="w-full text-left text-danger hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="w-full text-left text-primary hover:text-primary-foreground"
          >
            Sign in / Sign up
          </button>
        )}
      </div>
    </aside>
  );
}

function NavList({
  location,
  onNavigate,
}: {
  location: ReturnType<typeof useLocation>;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
              isActive
                ? "bg-primary/10 text-primary shadow-glow-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon
              className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
