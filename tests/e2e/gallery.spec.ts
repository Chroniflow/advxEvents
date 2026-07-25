import { expect, test } from "@playwright/test";

test("renders the text-first gallery without overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /把那个夏天/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "凌晨四点，我们终于让那块板子亮了起来" }),
  ).toBeVisible();
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});

test("switches gallery ordering controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "最热" }).click();
  await expect(page.getByRole("button", { name: "最热" })).toHaveClass(/active/);
});
