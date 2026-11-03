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

function uiStream(chunks: Array<Record<string, unknown>>): string {
  return (
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
    "data: [DONE]\n\n"
  );
}

test("clickable slots, confirmation replies, and end-of-chat feedback", async ({
  page,
}) => {
  const slotLabel =
    "Monday, November 9 at 8:00 AM with Priya Patel, RDH";
  let call = 0;

  await page.route("**/api/chat", async (route) => {
    call += 1;

    if (call === 1) {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
        },
        body: uiStream([
          { type: "start" },
          { type: "start-step" },
          {
            type: "tool-input-start",
            toolCallId: "call-slots",
            toolName: "get_availability",
          },
          {
            type: "tool-input-available",
            toolCallId: "call-slots",
            toolName: "get_availability",
            input: { appointmentType: "cleaning" },
          },
          {
            type: "tool-output-available",
            toolCallId: "call-slots",
            output: {
              ok: true,
              count: 1,
              slots: [
                {
                  providerId: "prov_patel",
                  providerName: "Priya Patel, RDH",
                  appointmentType: "cleaning",
                  startsAt: "2026-11-09T13:00:00.000Z",
                  endsAt: "2026-11-09T13:45:00.000Z",
                  label: slotLabel,
                },
              ],
            },
          },
          { type: "text-start", id: "txt-1" },
          {
            type: "text-delta",
            id: "txt-1",
            delta: "Which time would you like?",
          },
          { type: "text-end", id: "txt-1" },
          { type: "finish-step" },
          { type: "finish", finishReason: "stop" },
        ]),
      });
      return;
    }

    if (call === 2) {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
        },
        body: uiStream([
          { type: "start" },
          { type: "start-step" },
          { type: "text-start", id: "txt-2" },
          {
            type: "text-delta",
            id: "txt-2",
            delta: `I have ${slotLabel}. Should I book that for you?`,
          },
          { type: "text-end", id: "txt-2" },
          { type: "finish-step" },
          { type: "finish", finishReason: "stop" },
        ]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: uiStream([
        { type: "start" },
        { type: "start-step" },
        {
          type: "tool-input-start",
          toolCallId: "call-book",
          toolName: "book_appointment",
        },
        {
          type: "tool-input-available",
          toolCallId: "call-book",
          toolName: "book_appointment",
          input: { patientId: "pat_maria" },
        },
        {
          type: "tool-output-available",
          toolCallId: "call-book",
          output: {
            ok: true,
            appointment: {
              id: "appt_mock",
              patientId: "pat_maria",
              patientName: "Maria Lopez",
              providerId: "prov_patel",
              providerName: "Priya Patel, RDH",
              appointmentType: "cleaning",
              appointmentTypeName: "Cleaning",
              startsAt: "2026-11-09T13:00:00.000Z",
              endsAt: "2026-11-09T13:45:00.000Z",
              status: "booked",
              notes: null,
              startsAtLabel: slotLabel,
              endsAtLabel: "Monday, November 9 at 8:45 AM",
            },
          },
        },
        { type: "text-start", id: "txt-3" },
        {
          type: "text-delta",
          id: "txt-3",
          delta: "You're booked. See you Monday.",
        },
        { type: "text-end", id: "txt-3" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]),
    });
  });

  await page.goto("/chat");
  await page
    .getByRole("textbox", { name: /Message the dental assistant/i })
    .fill("Show me cleaning times next week");
  await page.getByRole("button", { name: /^Send$/ }).click();

  await page
    .getByRole("button", { name: new RegExp(`Choose ${slotLabel}`) })
    .click();
  await expect(page.getByText(/Let.s go with Monday, November 9/i)).toBeVisible();

  await page.getByRole("button", { name: /Yes, please book it/i }).click();
  await expect(
    page.getByRole("heading", { name: /How was this experience/i }),
  ).toBeVisible();
  await expect(page.getByText("Was this helpful?")).toHaveCount(0);
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
