import type { ComponentType } from "react";
import Index from "@/pages/Index";
import RiskMapPage from "@/pages/RiskMapPage";
import MonitoringPage from "@/pages/MonitoringPage";
import AlertsPage from "@/pages/AlertsPage";
import CitizenReportsPage from "@/pages/CitizenReportsPage";
import DataSourcesPage from "@/pages/DataSourcesPage";
import AboutPage from "@/pages/AboutPage";
import GlofPage from "@/pages/GlofPage";
import LoginPage from "@/pages/LoginPage";

export type AppRoute = {
  path: string;
  component: ComponentType;
  isPublic: boolean;
};

export const appRoutes: AppRoute[] = [
  { path: "/login", component: LoginPage, isPublic: true },
  { path: "/", component: Index, isPublic: false },
  { path: "/risk-map", component: RiskMapPage, isPublic: false },
  { path: "/monitoring", component: MonitoringPage, isPublic: false },
  { path: "/alerts", component: AlertsPage, isPublic: false },
  { path: "/citizen-reports", component: CitizenReportsPage, isPublic: false },
  { path: "/data-sources", component: DataSourcesPage, isPublic: false },
  { path: "/about", component: AboutPage, isPublic: false },
  { path: "/glof", component: GlofPage, isPublic: false },
];

export function isPublicRoute(path: string): boolean {
  const route = appRoutes.find((r) => r.path === path);
  return route?.isPublic ?? false;
}
