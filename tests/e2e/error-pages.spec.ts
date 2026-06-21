import { expect, test } from "@playwright/test";

const errorPages = [
  {
    path: "/400",
    heading: "Bad Request",
    primaryHref: "/docs",
    secondaryHref: "/dashboard/endpoint",
  },
  {
    path: "/401",
    heading: "Unauthorized",
    primaryHref: "/login",
    secondaryHref: "/dashboard/api-manager",
  },
  {
    path: "/403",
    heading: "Forbidden",
    primaryHref: "/forbidden",
    secondaryHref: "/dashboard/settings/general",
  },
  {
    path: "/408",
    heading: "Request Timeout",
    primaryHref: "/dashboard/endpoint",
    secondaryHref: "/dashboard/health",
  },
  {
    path: "/429",
    heading: "Too Many Requests",
    primaryHref: "/dashboard/health",
    secondaryHref: "/dashboard/combos",
  },
  {
    path: "/500",
    heading: "Internal Server Error",
    primaryHref: "/dashboard/health",
    secondaryHref: "/dashboard/logs",
  },
  {
    path: "/502",
    heading: "Bad Gateway",
    primaryHref: "/dashboard/providers",
    secondaryHref: "/dashboard/health",
  },
  {
    path: "/503",
    heading: "Service Unavailable",
    primaryHref: "/dashboard/health",
    secondaryHref: "/dashboard/logs",
  },
];

test.describe("Error and Resilience Pages", () => {
  for (const pageSpec of errorPages) {
    test(`${pageSpec.path} renders actionable recovery actions`, async ({ page }) => {
      const response = await page.goto(pageSpec.path);
      expect(response).toBeTruthy();
      const expectedHttpStatus = Number.parseInt(pageSpec.path.slice(1), 10);
      expect([200, expectedHttpStatus]).toContain(response?.status());

      await expect(page.getByRole("heading", { name: pageSpec.heading })).toBeVisible();
      await expect(page.locator(`a[href="${pageSpec.primaryHref}"]`).first()).toBeVisible();
      await expect(page.locator(`a[href="${pageSpec.secondaryHref}"]`).first()).toBeVisible();
    });
  }

  test("missing route renders not-found recovery actions", async ({ page }) => {
    await page.goto("/route-that-does-not-exist");

    await expect(page.getByRole("heading", { name: /Page not found/i })).toBeVisible();
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/health"]')).toBeVisible();
  });
});
