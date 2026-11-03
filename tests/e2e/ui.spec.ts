import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const seriousOrCritical = (
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) =>
  violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );

async function signInPatient(page: Page) {
  await page.goto("/login?role=patient");
  await page.getByLabel("Phone number").fill("617-555-0102");
  await page.getByLabel("Date of birth").fill("1990-11-30");
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

async function signInStaff(page: Page) {
  await page.goto("/login?role=staff");
  await page.getByLabel("Work email").fill("frontdesk@lakeside.test");
  await page.getByLabel("Password").fill("frontdesk-demo");
  await page
    .getByRole("button", { name: /Sign in to staff workspace/i })
    .click();
  await expect(page).toHaveURL(/\/staff$/);
}

test("landing page reads as a complete practice site", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Dentistry that fits your life/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Book an appointment/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Patient portal/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/A calm, capable scheduling assistant/i),
  ).toHaveCount(0);

  const results = await new AxeBuilder({ page }).analyze();
  expect(seriousOrCritical(results.violations)).toEqual([]);
});

test("protected staff routes redirect to staff sign-in", async ({ page }) => {
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/login\?role=staff/);
  await expect(
    page.getByRole("heading", { name: /Staff sign in/i }),
  ).toBeVisible();
});

test("patient can sign in and see the portal", async ({ page }) => {
  await signInPatient(page);

  await expect(
    page.getByRole("heading", { name: /Hi, Maria/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Upcoming appointments/i }),
  ).toBeVisible();
  await expect(page.getByText(/Maria Lopez/i).first()).toBeVisible();

  await page.goto("/chat");
  await expect(
    page.getByRole("heading", { name: /Hi, Maria\. I.m Ava/i }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(seriousOrCritical(results.violations)).toEqual([]);
});

test("staff can sign in, review alerts, and open a conversation", async ({
  page,
}) => {
  await signInStaff(page);

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

test("chat shell is usable, accessible, and stays usable on mobile", async ({
  page,
}) => {
  await page.goto("/chat");

  await expect(
    page.getByRole("heading", {
      name: /Hi, I.m Ava at Lakeside Family Dental/i,
    }),
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

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toBeVisible();
  await expect(page.getByRole("button", { name: /^Send$/ })).toBeVisible();
});

test("unknown conversation is a 404 for signed-in staff", async ({ page }) => {
  await signInStaff(page);
  const response = await page.goto("/staff/conversations/does-not-exist");
  expect(response?.status()).toBe(404);
});

test("footer and login content stay balanced on a tall viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1_400 });
  await page.goto("/login?role=patient");

  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  const footerBox = await footer.boundingBox();
  expect(footerBox).not.toBeNull();
  expect(Math.round(footerBox!.y + footerBox!.height)).toBe(1_400);

  const headerBox = await page.locator("header").boundingBox();
  const contentBox = await page.getByTestId("login-content").boundingBox();
  expect(headerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();

  const availableCenter =
    (headerBox!.y + headerBox!.height + footerBox!.y) / 2;
  const contentCenter = contentBox!.y + contentBox!.height / 2;
  expect(Math.abs(contentCenter - availableCenter)).toBeLessThanOrEqual(2);
});

test("interactive controls use pointer, disabled controls use not-allowed", async ({
  page,
}) => {
  await page.goto("/");
  const book = page.getByRole("link", { name: /Book an appointment/i }).first();
  await expect(book).toBeVisible();
  expect(
    await book.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("pointer");

  await page.goto("/chat");
  const quickReply = page
    .getByRole("button", { name: /book a cleaning/i })
    .first();
  expect(
    await quickReply.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("pointer");

  const send = page.getByRole("button", { name: /^Send$/ });
  expect(
    await send.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("not-allowed");

  await page.goto("/login?role=patient");
  const submit = page.getByRole("button", { name: /^Sign in$/ });
  expect(
    await submit.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("pointer");
});
