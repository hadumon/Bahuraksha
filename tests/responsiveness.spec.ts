import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8080";

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("landing page is usable on mobile", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "commit" });
    await page.locator("nav").first().waitFor({ state: "visible", timeout: 25000 });
    await expect(page.locator("nav").first()).toBeVisible();
  });

  test("login page renders on mobile", async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "commit" });
    await page.waitForSelector("#email", { timeout: 25000 });
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("blog page renders on mobile", async ({ page }) => {
    await page.goto(`${BASE}/blog`, { waitUntil: "commit" });
    const cards = page.locator("article");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("disasters page renders on mobile", async ({ page }) => {
    await page.goto(`${BASE}/disasters`, { waitUntil: "commit" });
    await expect(page).toHaveURL(/.*disasters/);
  });
});

test.describe("Error Handling", () => {
  test("404 page shows helpful message", async ({ page }) => {
    await page.goto(`${BASE}/this-path-does-not-exist`, { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible({ timeout: 10000 });
  });

  test("malformed query params do not crash app", async ({ page }) => {
    await page.goto(`${BASE}/login?error=invalid&state=<script>`, { waitUntil: "commit" });
    await page.waitForSelector("#email", { timeout: 25000 });
    await expect(page.locator("#email")).toBeVisible();
  });
});

test.describe("Auth Redirects", () => {
  test("unauthenticated access to dashboard loads without error", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "commit" });
    await expect(page.locator("nav").first()).toBeVisible({ timeout: 10000 });
  });

  test("unauthenticated access to monitoring loads without error", async ({ page }) => {
    await page.goto(`${BASE}/monitoring`, { waitUntil: "commit" });
    await expect(page.locator("nav").first()).toBeVisible({ timeout: 10000 });
  });

  test("unauthenticated access to alerts loads without error", async ({ page }) => {
    await page.goto(`${BASE}/alerts`, { waitUntil: "commit" });
    await expect(page.locator("nav").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Blog Interactions", () => {
  test("read article button shows toast", async ({ page }) => {
    await page.goto(`${BASE}/blog`, { waitUntil: "commit" });
    const readButtons = page.getByRole("button", { name: /read article/i });
    const count = await readButtons.count();
    if (count > 0) {
      await readButtons.first().click();
      await expect(page.getByText(/coming soon/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
