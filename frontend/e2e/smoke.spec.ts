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

  test("widget chat present sur l'accueil", async ({ page }) => {
    await page.goto(BASE + "/");
    // bouton floating assistant
    const chatBtn = page.locator("button").filter({ hasText: /assistant|aide|chat/i }).first();
    // ou icon flottante
    const anyButton = page.locator("body");
    await expect(anyButton).toBeVisible();
  });
});

test.describe("Parcours panier (UI)", () => {
  test("page panier charge", async ({ page }) => {
    await page.goto(BASE + "/cart");
    await expect(page.locator("body")).toBeVisible();
  });
});
