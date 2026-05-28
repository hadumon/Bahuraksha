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
  Mountain,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/components/auth/useAuth";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

interface NavItemDef {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
  permission: Parameters<typeof hasPermission>[1];
}

const ALL_NAV_ITEMS: NavItemDef[] = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: "view:dashboard" },
  { path: "/risk-map", icon: Map, label: "Risk Map", permission: "view:risk-map" },
  { path: "/monitoring", icon: Activity, label: "River Monitoring", permission: "view:monitoring" },
  { path: "/glof", icon: Snowflake, label: "GLOF Monitoring", permission: "view:glof" },
  { path: "/landslides", icon: Mountain, label: "Landslide Prediction", permission: "view:landslides" },
  { path: "/alerts", icon: AlertTriangle, label: "Alerts", permission: "view:alerts" },
  { path: "/citizen-reports", icon: Users, label: "Citizen Reports", permission: "view:citizen-reports" },
  { path: "/data-sources", icon: Database, label: "Data Sources", permission: "view:data-sources" },
  { path: "/about", icon: Info, label: "About", permission: "view:about" },
  { path: "/admin/users", icon: UserCog, label: "User Management", permission: "view:admin" },
];

interface Props {
  isMobile: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

function BrandLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/dashboard" onClick={onClick} className="flex items-center gap-3 min-w-0 group">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center flex-shrink-0 shadow-glow group-hover:shadow-glow-primary transition-shadow overflow-hidden">
        <img
          src="/Bahuraksha%20logo.svg"
          alt="Bahuraksha Logo"
          className="w-6 h-6 object-contain"
        />
      </div>
      <div className="overflow-hidden">
        <h1 className="text-sm font-bold text-foreground tracking-wide">BAHURAKSHA</h1>
        <p className="text-[10px] text-muted-foreground">Disaster Intelligence</p>
      </div>
    </Link>
  );
}

export default function AppSidebar({ isMobile, mobileOpen, onClose }: Props) {
  const location = useLocation();
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const sidebar = (
    <>
      <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border gap-3">
        <BrandLink onClick={isMobile ? onClose : undefined} />
        {isMobile && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <NavList location={location} userRole={userRole} onNavigate={isMobile ? onClose : undefined} />
      <div className="px-3 py-4 border-t border-sidebar-border mt-auto">
        {user ? (
          <div className="space-y-3">
            <div className="px-3 py-2 rounded-lg bg-sidebar-accent/50">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
              {userRole && (
                <p className="text-xs capitalize text-muted-foreground mt-0.5">{userRole}</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-left text-sm text-risk-evacuate hover:bg-risk-evacuate/10 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="w-full px-3 py-2 text-left text-sm text-ocean-400 hover:bg-ocean-400/10 rounded-lg transition-colors"
          >
            Sign in / Sign up
          </button>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="fixed left-0 top-0 h-screen w-[280px] bg-sidebar border-r border-sidebar-border z-50 flex flex-col"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-sidebar border-r border-sidebar-border z-50 flex flex-col">
      {sidebar}
    </aside>
  );
}

function NavList({
  location,
  userRole,
  onNavigate,
}: {
  location: ReturnType<typeof useLocation>;
  userRole: string | null;
  onNavigate?: () => void;
}) {
  const skipAuth = import.meta.env.VITE_DISABLE_AUTH === "true";
  const visibleItems = skipAuth
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter(
        (item) => !item.permission || hasPermission(userRole as any, item.permission),
      );

  return (
    <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
      {visibleItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm group relative overflow-hidden",
              isActive
                ? "bg-ocean-400/10 text-ocean-400 border border-ocean-400/20"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent",
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeNav"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-ocean-400 rounded-full"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <item.icon
              className={cn(
                "w-5 h-5 flex-shrink-0 transition-colors",
                isActive
                  ? "text-ocean-400"
                  : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
              )}
            />
            <span className="truncate font-medium">{item.label}</span>
            {isActive && <div className="absolute inset-0 bg-ocean-400/5 rounded-xl" />}
          </Link>
        );
      })}
    </nav>
  );
}
