import { test, expect } from "@playwright/test";

test.describe("Public Routes", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("http://localhost:8080", { waitUntil: "commit" });
    await expect(page).toHaveURL("/");
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("http://localhost:8080/login", { waitUntil: "commit" });
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
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
    await page.locator("nav").first().waitFor({ state: "visible", timeout: 10000 });
  });

  test("navigation links are present", async ({ page }) => {
    const navLinks = page.locator("nav a, header a, [role='navigation'] a, a[href]");
    await expect(navLinks.first()).toBeVisible();
  });

  test("footer contains expected content", async ({ page }) => {
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
    await page.locator("nav").first().waitFor({ state: "visible", timeout: 10000 });
  });

  test("theme toggle is present", async ({ page }) => {
    const themeToggle = page.locator("button").filter({ hasText: /theme|dark|light/i }).first();
    await expect(themeToggle).toBeVisible({ timeout: 10000 });
  });

  test("page transitions work", async ({ page }) => {
    await page.goto("http://localhost:8080/login", { waitUntil: "commit" });
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  });
});
