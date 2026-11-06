import { expect, test } from "@playwright/test";

test("home shows the satellite map with attribution", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Rastro" })).toBeVisible();

  const map = page.getByTestId("base-map");
  await expect(map).toBeVisible();
  await expect(map.locator("canvas.maplibregl-canvas")).toBeVisible();
  await expect(map).toHaveAttribute("data-state", "ready", { timeout: 15_000 });

  // Attribution must be present (license requirement), even if collapsed.
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("EOX", {
    useInnerText: false,
  });
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("Copernicus Sentinel", {
    useInnerText: false,
  });
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText(
    "Dados: INPE/TerraBrasilis, CC BY-SA 4.0",
    { useInnerText: false },
  );
});

test("language toggle switches to English and back", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Região-piloto: Transamazônica, Pará")).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("Pilot region: Transamazônica, Pará")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Português" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});
