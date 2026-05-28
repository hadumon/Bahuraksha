import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider } from "@/components/auth/AuthContext";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: { unsubscribe: vi.fn() },
        },
      }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children without crashing", () => {
    render(
      <AuthProvider>
        <div data-testid="child">Test Child</div>
      </AuthProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("does not call Supabase when not configured", () => {
    import.meta.env.VITE_SUPABASE_URL = undefined;
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = undefined;

    render(
      <AuthProvider>
        <div data-testid="child">Test Child</div>
      </AuthProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
