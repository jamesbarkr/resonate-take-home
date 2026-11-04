import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const seriousOrCritical = (
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) =>
  violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );

const STAFF_ORIGIN = "http://localhost:3001";

async function signInPatient(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Phone number").fill("617-555-0102");
  await page.getByLabel("Date of birth").fill("1990-11-30");
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

async function signInStaff(page: Page) {
  await page.goto(`${STAFF_ORIGIN}/login`);
  await page.getByLabel("Work email").fill("frontdesk@lakeside.test");
  await page.getByLabel("Password").fill("frontdesk-demo");
  await page
    .getByRole("button", { name: /Sign in to staff workspace/i })
    .click();
  await expect(page).toHaveURL(`${STAFF_ORIGIN}/staff`);
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

test("staff routes are isolated to the staff site", async ({ page }) => {
  await page.goto(`${STAFF_ORIGIN}/staff`);
  await expect(page).toHaveURL(
    /localhost:3001\/login\?next=(%2F|\/)staff/,
  );
  await expect(
    page.getByRole("heading", { name: /Staff sign in/i }),
  ).toBeVisible();

  await page.goto("/staff");
  await expect(page).toHaveURL("http://localhost:3000/");
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /Staff sign in/i }),
  ).toHaveCount(0);
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

  const sectionGap = await page.evaluate(() => {
    const alerts = document.querySelector(
      'section[aria-labelledby="alerts-heading"]',
    );
    const conversations = document.querySelector(
      'section[aria-labelledby="conversations-heading"]',
    );
    if (!alerts || !conversations) return null;
    return (
      conversations.getBoundingClientRect().top -
      alerts.getBoundingClientRect().bottom
    );
  });
  expect(sectionGap).not.toBeNull();
  expect(sectionGap ?? 0).toBeLessThanOrEqual(32);

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
  const response = await page.goto(
    `${STAFF_ORIGIN}/staff/conversations/does-not-exist`,
  );
  expect(response?.status()).toBe(404);
});

test("footer and login content stay balanced on a tall viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1_400 });
  await page.goto("/login");

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

test("typed slot choice completes the booking flow", async ({
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
  const input = page.getByRole("textbox", {
    name: /Message the dental assistant/i,
  });
  await input.fill("Show me cleaning times next week");
  await page.getByRole("button", { name: /^Send$/ }).click();

  await expect(page.getByText("Which time would you like?")).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose / })).toHaveCount(0);

  await input.fill(`Let's go with ${slotLabel}. Please book it.`);
  await page.getByRole("button", { name: /^Send$/ }).click();

  await expect(
    page.getByText(/Should I book that for you/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Yes, please book it/i }),
  ).toHaveCount(0);

  await input.fill("Yes, please book it");
  await page.getByRole("button", { name: /^Send$/ }).click();

  await expect(
    page.getByText("You're booked. See you Monday."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /How was this experience/i }),
  ).toHaveCount(0);
});

test("family availability renders without clickable slot buttons", async ({
  page,
}) => {
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
            toolCallId: "call-david",
            toolName: "get_availability",
          },
          {
            type: "tool-input-available",
            toolCallId: "call-david",
            toolName: "get_availability",
            input: { patientId: "pat_david", appointmentType: "cleaning" },
          },
          {
            type: "tool-output-available",
            toolCallId: "call-david",
            output: {
              ok: true,
              patientId: "pat_david",
              patientName: "David Johnson",
              count: 1,
              slots: [
                {
                  providerId: "prov_patel",
                  providerName: "Priya Patel, RDH",
                  appointmentType: "cleaning",
                  startsAt: "2026-11-09T14:00:00.000Z",
                  endsAt: "2026-11-09T14:45:00.000Z",
                  label: "Monday, November 9 at 9:00 AM with Priya Patel, RDH",
                },
              ],
            },
          },
          {
            type: "tool-input-start",
            toolCallId: "call-sarah",
            toolName: "get_availability",
          },
          {
            type: "tool-input-available",
            toolCallId: "call-sarah",
            toolName: "get_availability",
            input: { patientId: "pat_sarah", appointmentType: "cleaning" },
          },
          {
            type: "tool-output-available",
            toolCallId: "call-sarah",
            output: {
              ok: true,
              patientId: "pat_sarah",
              patientName: "Sarah Johnson",
              count: 1,
              slots: [
                {
                  providerId: "prov_patel",
                  providerName: "Priya Patel, RDH",
                  appointmentType: "cleaning",
                  startsAt: "2026-11-09T15:00:00.000Z",
                  endsAt: "2026-11-09T15:45:00.000Z",
                  label: "Monday, November 9 at 10:00 AM with Priya Patel, RDH",
                },
              ],
            },
          },
          { type: "text-start", id: "txt-family" },
          {
            type: "text-delta",
            id: "txt-family",
            delta: "Here are back-to-back options for David and Sarah.",
          },
          { type: "text-end", id: "txt-family" },
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
        { type: "text-start", id: "txt-thanks" },
        { type: "text-delta", id: "txt-thanks", delta: "Thanks." },
        { type: "text-end", id: "txt-thanks" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]),
    });
  });

  await page.goto("/chat");
  await page
    .getByRole("textbox", { name: /Message the dental assistant/i })
    .fill("Book cleanings for David and Sarah Johnson");
  await page.getByRole("button", { name: /^Send$/ }).click();

  await expect(
    page.getByText("Here are back-to-back options for David and Sarah."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose / })).toHaveCount(0);
});

test("latest message stays visible at the bottom as the chat grows", async ({
  page,
}) => {
  const longText =
    Array.from(
      { length: 90 },
      (_, index) => `Line ${index + 1}: a longer conversation response.`,
    ).join("\n") + "\nLatest message marker";

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: uiStream([
        { type: "start" },
        { type: "start-step" },
        { type: "text-start", id: "txt-long" },
        { type: "text-delta", id: "txt-long", delta: longText },
        { type: "text-end", id: "txt-long" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]),
    });
  });

  await page.goto("/chat");
  const input = page.getByRole("textbox", {
    name: /Message the dental assistant/i,
  });
  await input.fill("Give me a detailed overview");
  await page.getByRole("button", { name: /^Send$/ }).click();

  const scroll = page.getByTestId("chat-scroll");
  await expect(scroll).toContainText("Latest message marker");
  await expect
    .poll(async () =>
      scroll.evaluate(
        (element) =>
          Math.abs(
            element.scrollHeight - element.clientHeight - element.scrollTop,
          ),
      ),
    )
    .toBeLessThanOrEqual(2);
  await expect(input).toBeVisible();
});

test("assistant markdown renders as formatting while user input stays literal", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: uiStream([
        { type: "start" },
        { type: "start-step" },
        { type: "text-start", id: "txt-markdown" },
        {
          type: "text-delta",
          id: "txt-markdown",
          delta:
            "Here are the details for **Maria Lopez**:\n\n- First item\n- Second item",
        },
        { type: "text-end", id: "txt-markdown" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]),
    });
  });

  await page.goto("/chat");
  const input = page.getByRole("textbox", {
    name: /Message the dental assistant/i,
  });
  await input.fill("Keep **this** literal");
  await page.getByRole("button", { name: /^Send$/ }).click();

  await expect(page.locator("strong", { hasText: "Maria Lopez" })).toBeVisible();
  await expect(page.getByText("**Maria Lopez**")).toHaveCount(0);
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("Keep **this** literal")).toBeVisible();
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

  await page.goto("/login");
  const submit = page.getByRole("button", { name: /^Sign in$/ });
  expect(
    await submit.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("pointer");
});
