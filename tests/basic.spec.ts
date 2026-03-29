import { test, expect, Page } from "@playwright/test";

const AUTH_ENABLED = process.env.PLAYWRIGHT_DISABLE_AUTH !== "true";
const E2E_EMAIL = process.env.PLAYWRIGHT_AUTH_EMAIL || "test+e2e@example.com";
const E2E_PASSWORD = process.env.PLAYWRIGHT_AUTH_PASSWORD || "Password123!";

async function signIn(page: Page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "PLAYWRIGHT_AUTH_EMAIL and PLAYWRIGHT_AUTH_PASSWORD are required for sign-in tests.",
    );
  }

  await page.goto("http://localhost:8080/login");
  await page.getByRole("textbox", { name: /email/i }).fill(E2E_EMAIL);
  await page.getByRole("textbox", { name: /password/i }).fill(E2E_PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("Basic App Functionality", () => {
  test.beforeEach(async ({ page }) => {
    if (AUTH_ENABLED) {
      await signIn(page);
    } else {
      await page.goto("http://localhost:8080");
    }
  });

  test("should load the main dashboard", async ({ page }) => {
    await expect(page.getByText("Command Dashboard")).toBeVisible();
    await expect(page.getByText("System Online")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Active Alerts" }),
    ).toBeVisible();
    await expect(page.getByText("Stations")).toBeVisible();
    await expect(page.getByText("Sensors")).toBeVisible();
  });

  test("should navigate to risk map page", async ({ page }) => {
    await page.getByRole("link", { name: /risk map/i }).click();
    await expect(page).toHaveURL(/.*risk-map/);
  });

  test("should navigate to monitoring page", async ({ page }) => {
    await page.getByRole("link", { name: "River Monitoring" }).click();
    await expect(page).toHaveURL(/.*monitoring/);
  });

  test("should handle 404 page", async ({ page }) => {
    await page.goto("http://localhost:8080/nonexistent-page");
    await expect(page.getByText("404")).toBeVisible();
  });
});
