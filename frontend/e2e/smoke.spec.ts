import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

test.describe("L'AMI smoke", () => {
  test("accueil charge", async ({ page }) => {
    await page.goto(BASE + "/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("catalogue accessible", async ({ page }) => {
    await page.goto(BASE + "/catalog");
    await expect(page.locator("body")).toBeVisible();
  });

  test("page panier charge", async ({ page }) => {
    await page.goto(BASE + "/cart");
    await expect(page.locator("body")).toBeVisible();
  });
});
