import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const seriousOrCritical = (violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) =>
  violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );

test("chat shell is usable and accessible", async ({ page }) => {
  await page.goto("/chat");

  await expect(
    page.getByRole("heading", { name: /Hi, I.m Ava at Lakeside Family Dental/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: /Message the dental assistant/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Send$/ })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /book a cleaning/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Call 617-555-0142/i }),
  ).toBeVisible();

  const input = page.getByRole("textbox", {
    name: /Message the dental assistant/i,
  });
  await input.fill("I need help booking a cleaning");
  await expect(page.getByRole("button", { name: /^Send$/ })).toBeEnabled();

  const results = await new AxeBuilder({ page }).analyze();
  expect(seriousOrCritical(results.violations)).toEqual([]);
});

test("chat shell remains usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chat");

  await expect(
    page.getByRole("textbox", { name: /Message the dental assistant/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Send$/ })).toBeVisible();
});

test("staff console shows schedule, alerts, conversations, and feedback", async ({
  page,
}) => {
  await page.goto("/staff");

  await expect(
    page.getByRole("heading", { name: /Staff console/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Alerts$/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Upcoming schedule/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Recent conversations/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Patient feedback/i }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(seriousOrCritical(results.violations)).toEqual([]);
});

test("unknown conversation shows a not-found page", async ({ page }) => {
  const response = await page.goto("/staff/conversations/does-not-exist");
  expect(response?.status()).toBe(404);
});
