import { describe, it, expect, vi, beforeEach } from "vitest";
import { getHistory } from "@/lib/bahuraksha-api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("getHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns history data when API succeeds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        history: [
          { date: "2026-05-28", label: "dry_land", risk_score: 20, confidence: 0.9 },
        ],
      }),
    });

    const result = await getHistory(3);

    expect(result.history[0].label).toBe("dry_land");
  });

  it("returns fallback history when API call fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await getHistory(3);

    expect(result.history).toHaveLength(3);
    expect(result.history[0]).toHaveProperty("date");
    expect(result.history[0]).toHaveProperty("label");
    expect(result.history[0]).toHaveProperty("risk_score");
    expect(result.history[0]).toHaveProperty("confidence");
  });
});
