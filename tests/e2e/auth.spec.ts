import { expect, test } from "@playwright/test";

// These flows need a Supabase project (.env.local locally). In CI without
// secrets they are skipped.
test.skip(
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.DEMO_USER_PASSWORD,
  "Supabase settings not available",
);

test("visitors without a session are sent from /app to the sign-in page", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fapp$/);
  await expect(page.getByRole("heading", { name: "Entrar no Rastro" })).toBeVisible();
});

test("refuses the demo e-mail in the magic-link form", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Seu e-mail").fill("demo@rastro.example");
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.locator("#email-error")).toHaveText("Digite um e-mail válido.");
});

test("demo sign-in opens the farm panel and sign-out returns home", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ver demonstração" }).click();
  await page.getByRole("button", { name: "Entrar como demonstração" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Minhas fazendas" })).toBeVisible();
  await expect(page.getByText("Demonstração", { exact: true })).toBeVisible();
  await expect(page.getByText("Você está na conta de demonstração")).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/entrar/);
});
