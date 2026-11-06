import path from "node:path";

import { expect, test } from "@playwright/test";

import { deleteTestUserFarms, hasSupabase, signInAsTestUser } from "./helpers";

test.skip(!hasSupabase, "Supabase settings not available");
// Each project (desktop, mobile) signs in the same test user: run one at a time.
test.describe.configure({ mode: "serial" });

let userId: string | undefined;

test.afterEach(async () => {
  if (userId) await deleteTestUserFarms(userId);
});

test("magic-link landing signs the user in", async ({ page }, testInfo) => {
  userId = await signInAsTestUser(page, testInfo);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Minhas fazendas" })).toBeVisible();
});

test("an invalid magic link shows a clear error", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=invalido&type=magiclink");
  await expect(page).toHaveURL(/\/entrar\?erro=link/);
  await expect(page.getByText("O link expirou ou já foi usado")).toBeVisible();
});

test("import a farm file, save and see the verdict with the real DETER alert", async ({
  page,
}, testInfo) => {
  userId = await signInAsTestUser(page, testInfo, "/app/fazendas/nova");
  await expect(page.getByRole("heading", { name: "Mapear nova fazenda" })).toBeVisible();

  await page.getByRole("button", { name: /Importar arquivo/ }).click();
  await page
    .getByTestId("farm-file")
    .setInputFiles(path.join(__dirname, "fixtures", "test-farm.geojson"));
  await expect(page.getByTestId("farm-area")).toContainText(/6[34],\d+ ha/);
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Nome da fazenda").fill("Fazenda Teste E2E");
  await page.getByLabel("O que é produzido").selectOption("cocoa");
  await page.getByRole("button", { name: "Salvar e checar" }).click();

  await expect(page).toHaveURL(/\/app\/fazendas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const verdict = page.getByTestId("farm-verdict");
  await expect(verdict).toHaveAttribute("data-status", "NON_COMPLIANT");
  await expect(verdict).toContainText("Não conforme");
  await expect(page.getByTestId("findings")).toContainText("DETER · DESMATAMENTO_CR");
  await expect(page.getByTestId("findings")).toContainText("14/02/2024");
  // The credit is printed on the page (the map attribution may be collapsed on phones).
  await expect(
    page.getByText("Dados: INPE/TerraBrasilis, CC BY-SA 4.0").filter({ visible: true }).first(),
  ).toBeVisible();
  const resultMap = page.locator('[data-testid="farm-result-map"]:visible');
  await expect(resultMap).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  await expect(resultMap).toHaveAttribute("data-rendered", /farm:[1-9]/);
  await expect(resultMap).toHaveAttribute("data-rendered", /deforestation:[1-9]/);

  await page.getByRole("link", { name: "Minhas fazendas" }).click();
  const list = page.locator('[data-testid="farm-list"]:visible');
  await expect(list).toContainText("Fazenda Teste E2E");
  await expect(list).toContainText("Não conforme");
});

test("drawing on the map shows the area live and enables Continue when closed", async ({
  page,
}, testInfo) => {
  userId = await signInAsTestUser(page, testInfo, "/app/fazendas/nova");
  await page.getByRole("button", { name: /Desenhar no mapa/ }).click();
  const map = page.getByTestId("farm-editor-map");
  await expect(map).toHaveAttribute("data-state", "ready", { timeout: 15_000 });
  // The dashed outline of the pilot region is drawn.
  await expect(map).toHaveAttribute("data-rendered", /coverage:[1-9]/);

  // Zoom in (+7 levels) so a small on-screen square is a farm-sized area.
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  for (let i = 0; i < 7; i++) {
    await zoomIn.click();
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(600);
  const box = (await map.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const s = Math.min(box.width, box.height) / 5;
  const corners: [number, number][] = [
    [cx - s, cy - s],
    [cx + s, cy - s],
    [cx + s, cy + s],
    [cx - s, cy + s],
  ];
  for (const [x, y] of corners) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
  }
  await expect(page.getByTestId("farm-area")).toBeVisible();
  const continueButton = page.getByRole("button", { name: "Continuar" });
  await expect(continueButton).toBeDisabled();

  await page.mouse.click(corners[0][0], corners[0][1]); // close
  await expect(page.getByText("Arraste os pontos para ajustar.")).toBeVisible();
  await expect(page.getByTestId("farm-area")).toContainText("ha");
});

test("walking the boundary with GPS closes the area", async ({ page }, testInfo) => {
  // Chromium's emulated geolocation only reports the first position to
  // watchPosition, so a fake geolocation feeds the walk to the app instead.
  await page.addInitScript(() => {
    type Success = (p: GeolocationPosition) => void;
    const w = window as unknown as { __gps?: Success };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: (success: Success) => {
          w.__gps = success;
          return 1;
        },
        clearWatch: () => {},
        getCurrentPosition: () => {},
      },
    });
  });
  const emit = (longitude: number, latitude: number, accuracy: number) =>
    page.evaluate(
      ([lon, lat, acc]) =>
        (window as unknown as { __gps: (p: unknown) => void }).__gps({
          coords: { longitude: lon, latitude: lat, accuracy: acc },
          timestamp: Date.now(),
        }),
      [longitude, latitude, accuracy] as const,
    );

  // Fictitious 300 m x 300 m walk near Medicilândia.
  const lon0 = -52.95;
  const lat0 = -3.5;
  const step = 20 / 111_000; // 20 m
  const n = 15; // 15 steps of 20 m = 300 m per side
  const walk: [number, number][] = [];
  for (let i = 0; i < n; i++) walk.push([lon0 + i * step, lat0]);
  for (let i = 0; i < n; i++) walk.push([lon0 + n * step, lat0 + i * step]);
  for (let i = n; i > 0; i--) walk.push([lon0 + i * step, lat0 + n * step]);
  for (let i = n; i > 0; i--) walk.push([lon0, lat0 + i * step]);

  userId = await signInAsTestUser(page, testInfo, "/app/fazendas/nova");
  await page.getByRole("button", { name: /Caminhar com o GPS/ }).click();
  await page.getByRole("button", { name: "Começar a caminhar" }).click();

  for (const [lon, lat] of walk) await emit(lon, lat, 5);
  await emit(lon0 + 0.01, lat0, 80); // poor accuracy: ignored
  await expect(
    page.getByText(/60 pontos · Precisão ±80 m · 1 leituras imprecisas ignoradas/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Fechar a área" }).click();
  await expect(page.getByTestId("farm-area")).toContainText(/(8,\d+|9,\d+) ha/);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
});
