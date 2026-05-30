import { test, expect, Page } from "@playwright/test";

const AUTH_ENABLED =
  process.env.PLAYWRIGHT_DISABLE_AUTH !== "true" &&
  Boolean(process.env.PLAYWRIGHT_AUTH_EMAIL) &&
  Boolean(process.env.PLAYWRIGHT_AUTH_PASSWORD);
const E2E_EMAIL = process.env.PLAYWRIGHT_AUTH_EMAIL || "test+e2e@example.com";
const E2E_PASSWORD = process.env.PLAYWRIGHT_AUTH_PASSWORD || "Password123!";

async function signIn(page: Page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      "PLAYWRIGHT_AUTH_EMAIL and PLAYWRIGHT_AUTH_PASSWORD are required for sign-in tests.",
    );
  }

  await page.goto("http://localhost:8080/login", { waitUntil: "commit" });
  await page.locator("#email").fill(E2E_EMAIL);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("Basic App Functionality", () => {
  test.beforeEach(async ({ page }) => {
    if (AUTH_ENABLED) {
      await signIn(page);
    } else {
      await page.goto("http://localhost:8080/dashboard", { waitUntil: "load" });
    }
  });

  test("should load the main dashboard", async ({ page }) => {
    await expect(page.getByText("Command Dashboard")).toBeVisible({ timeout: 15000 });
  });

  test("should navigate to risk map page", async ({ page }) => {
    await page.locator("nav").first().waitFor({ state: "attached", timeout: 15000 });
    const riskMapLink = page.locator("a[href*='risk-map']").first();
    await expect(riskMapLink).toBeVisible({ timeout: 10000 });
    await riskMapLink.click();
    await expect(page).toHaveURL(/.*risk-map/, { timeout: 10000 });
  });

  test("should navigate to monitoring page", async ({ page }) => {
    await page.locator("nav").first().waitFor({ state: "attached", timeout: 15000 });
    const monitoringLink = page.locator("a[href*='monitoring']").first();
    await expect(monitoringLink).toBeVisible({ timeout: 10000 });
    await monitoringLink.click();
    await expect(page).toHaveURL(/.*monitoring/, { timeout: 10000 });
  });

  test("should handle 404 page", async ({ page }) => {
    await page.goto("http://localhost:8080/nonexistent-page", { waitUntil: "commit" });
    await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Demo Mode", () => {
  test("shows demo banner when API is unreachable", async ({ page }) => {
    await page.goto("http://localhost:8080/dashboard", { waitUntil: "commit" });
    await expect(page.getByText("Demo Mode")).toBeVisible({ timeout: 15000 });
  });

  test("demo banner can be dismissed", async ({ page }) => {
    await page.goto("http://localhost:8080/dashboard", { waitUntil: "commit" });
    await expect(page.getByText("Demo Mode")).toBeVisible({ timeout: 15000 });
    await page.getByLabel("Dismiss demo banner").click();
    await expect(page.getByText("Demo Mode")).not.toBeVisible();
  });
});
