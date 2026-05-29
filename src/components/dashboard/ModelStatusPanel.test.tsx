import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ModelStatusPanel from "@/components/dashboard/ModelStatusPanel";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from "@tanstack/react-query";

const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;

describe("ModelStatusPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Fallback badge when prediction data is mocked", () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        error: null,
      })
      .mockReturnValueOnce({
        data: {
          status: "ok",
          isMock: true,
          request: { date: "2026-05-30", bbox: [86.0, 27.7, 86.6, 28.1] },
          prediction: { class: 1, label: "flood_water", color: "#1a6faf", confidence: 0.89, risk_score: 82.5 },
        },
        isLoading: false,
        error: null,
      });

    render(<ModelStatusPanel />);

    expect(screen.getByText("Fallback")).toBeInTheDocument();
  });

  it("shows Online badge when real prediction data exists", () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { status: "healthy", model_loaded: true, model_type: "xgboost" },
        isLoading: false,
        error: null,
      })
      .mockReturnValueOnce({
        data: {
          status: "ok",
          request: { date: "2026-05-30", bbox: [86.0, 27.7, 86.6, 28.1] },
          prediction: { class: 0, label: "dry_land", color: "#22c55e", confidence: 0.92, risk_score: 15.0 },
        },
        isLoading: false,
        error: null,
      });

    render(<ModelStatusPanel />);

    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("shows Unavailable badge when no data and health check fails", () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        error: new Error("Network error"),
      })
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        error: new Error("Network error"),
      });

    render(<ModelStatusPanel />);

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });
});
