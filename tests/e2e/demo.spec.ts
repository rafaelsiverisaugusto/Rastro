import { expect, test, type Page } from "@playwright/test";

// Next.js keeps up to 3 visited routes hidden in the DOM (React <Activity>),
// so locators must target the visible page only.
const visible = (page: Page, testId: string) => page.locator(`[data-testid="${testId}"]:visible`);

// Needs the seeded demo account (npm run data:seed).
test.skip(
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.DEMO_USER_PASSWORD,
  "Supabase settings not available",
);

const EXPECTED = [
  { name: "Fazenda Boa Esperança", status: "Não conforme" },
  { name: "Fazenda Santa Clara", status: "Conforme" },
  { name: "Sítio Rio Verde", status: "Conforme" },
];

test("the demo account shows the three fictitious farms with their verdicts", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Entrar como demonstração" }).click();
  await expect(page).toHaveURL(/\/app$/);

  const list = visible(page, "farm-list");
  for (const farm of EXPECTED) {
    const item = list.getByRole("listitem").filter({ hasText: farm.name });
    await expect(item).toContainText("Fazenda fictícia");
    await expect(item).toContainText("Cacau");
    await expect(item.locator("[data-status]")).toHaveText(farm.status);
  }

  // Boa Esperança: the real DETER alert of 12/09/2022, confirmed by PRODES.
  await list.getByRole("link", { name: /Fazenda Boa Esperança/ }).click();
  await expect(visible(page, "farm-verdict")).toHaveAttribute("data-status", "NON_COMPLIANT");
  const findings = visible(page, "findings");
  await expect(findings).toContainText("DETER · DESMATAMENTO_CR · detectado em 12/09/2022");
  await expect(findings).toContainText("PRODES 2022");
  const map = visible(page, "farm-result-map");
  await expect(map).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  // The farm outline and the deforestation patches are really drawn.
  await expect(map).toHaveAttribute("data-rendered", /deforestation:[1-9]/);
  await expect(map).toHaveAttribute("data-rendered", /farm:[1-9]/);

  // Santa Clara: compliant, nothing found.
  await page.getByRole("link", { name: "Minhas fazendas" }).click();
  await list.getByRole("link", { name: /Fazenda Santa Clara/ }).click();
  await expect(visible(page, "farm-verdict")).toHaveAttribute("data-status", "COMPLIANT");
  await expect(
    page.getByText("Nenhum registro de desmatamento ou área protegida dentro da fazenda."),
  ).toBeVisible();
});
