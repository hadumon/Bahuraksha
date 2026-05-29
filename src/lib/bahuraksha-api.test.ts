import { describe, it, expect, vi, beforeEach } from "vitest";
import { getHistory } from "@/lib/bahuraksha-api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("getHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isMock true when API call fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await getHistory(3);

    expect(result.isMock).toBe(true);
    expect(result.history.length).toBe(3);
  });

  it("returns real data without isMock when API succeeds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        history: [
          { date: "2026-05-28", label: "dry_land", risk_score: 20, confidence: 0.9 },
        ],
      }),
    });

    const result = await getHistory(3);

    expect(result.isMock).toBeUndefined();
    expect(result.history[0].label).toBe("dry_land");
  });
});
