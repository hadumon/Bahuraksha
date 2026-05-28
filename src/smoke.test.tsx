import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("Smoke test", () => {
  it("renders without crashing", () => {
    render(<div data-testid="smoke">Hello</div>);
    expect(screen.getByTestId("smoke")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
