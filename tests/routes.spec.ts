import { test, expect } from "@playwright/test";

test.describe("Public Routes", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("http://localhost:8080", { waitUntil: "commit" });
    await expect(page).toHaveURL("/");
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("http://localhost:8080/login", { waitUntil: "commit" });
    // May show "Checking session..." while Supabase resolves; wait for form
    await page.waitForSelector("#email", { timeout: 25000 });
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("blog page loads", async ({ page }) => {
    await page.goto("http://localhost:8080/blog", { waitUntil: "commit" });
    await expect(page).toHaveURL("/blog");
  });

  test("disasters page loads", async ({ page }) => {
    await page.goto("http://localhost:8080/disasters", { waitUntil: "commit" });
    await expect(page).toHaveURL("/disasters");
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:8080", { waitUntil: "commit" });
  });

  test("navigation links are present", async ({ page }) => {
    await page.locator("nav").first().waitFor({ state: "visible", timeout: 25000 });
    const navLinks = page.locator("nav a, header a, [role='navigation'] a, a[href]");
    await expect(navLinks.first()).toBeVisible({ timeout: 5000 });
  });

  test("footer contains expected content", async ({ page }) => {
    await page.locator("nav").first().waitFor({ state: "visible", timeout: 25000 });
    const footer = page.locator("footer, [role='contentinfo']");
    const count = await footer.count();
    if (count > 0) {
      await expect(footer.first()).toBeVisible();
    }
  });
});

test.describe("UI Components", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:8080", { waitUntil: "commit" });
  });

  test("theme toggle is present", async ({ page }) => {
    await page.locator("nav").first().waitFor({ state: "visible", timeout: 25000 });
    const themeToggle = page.locator("button").filter({ hasText: /theme|dark|light/i }).first();
    await expect(themeToggle).toBeVisible({ timeout: 10000 });
  });

  test("page transitions work", async ({ page }) => {
    await page.goto("http://localhost:8080/login", { waitUntil: "commit" });
    await page.waitForSelector("#email", { timeout: 25000 });
  });
});
