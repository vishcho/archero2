import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("home lists both tournament series", async ({ page }) => {
  await page.goto("/index.html");
  await expect(
    page.getByRole("heading", { name: "明星盃", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "超級明星盃" })).toBeVisible();
});

test("legacy season URL defaults to Star Cup and all tabs switch", async ({
  page,
}) => {
  await page.goto("/season.html?id=2026-07-31");
  await expect(page.getByRole("heading", { name: /明星盃/ })).toBeVisible();
  for (const tab of ["資格賽排名", "淘汰賽對陣", "總決賽"]) {
    await page.getByRole("button", { name: tab }).click();
  }
  await expect(page.getByText("本屆總決賽資料尚未收錄")).toBeVisible();
});

test("roster preserves an interior null enchant slot", async ({ page }) => {
  await page.goto("/season.html?cup=super-star-cup&id=2026-08-06");
  const row = page.getByRole("row").filter({ hasText: "101548138" });
  await expect(row).toContainText("—");
});

test("07-31 group one R1 opponents come from matches and tabs switch", async ({
  page,
}) => {
  await page.goto("/bracket.html?id=2026-07-31");
  await expect(page.locator("svg")).toContainText("牛大力");
  await expect(page.locator("svg")).toContainText("LD丨힘");
  await page.getByRole("button", { name: "第 2 組" }).click();
  await expect(page.locator("svg")).toContainText("某剩啊");
});

test("missing and invalid query parameters render errors", async ({ page }) => {
  for (const url of [
    "/season.html",
    "/season.html?cup=bad&id=2026-07-31",
    "/season.html?id=not-a-season",
  ]) {
    await page.goto(url);
    await expect(page.getByRole("alert")).toContainText("載入失敗");
  }
});

test("HTTP and malformed JSON failures render errors", async ({ page }) => {
  await page.route("**/data/star-cup/2026-07-31.json", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/season.html?id=2026-07-31");
  await expect(page.getByRole("alert")).toContainText("http:");
  await page.unroute("**/data/star-cup/2026-07-31.json");
  await page.route("**/data/star-cup/2026-07-31.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{bad",
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("json:");
});

test("malicious names remain text while Unicode is preserved", async ({
  page,
}) => {
  const season = JSON.parse(
    await readFile("data/star-cup/2026-07-31.json", "utf8"),
  );
  const malicious = `<img onerror="window.__xss=1">\"><script>window.__xss=2</script>&'`;
  season.groups[0].matches[0].p1.name = malicious;
  season.groups[0].players[0].name = malicious;
  await page.route("**/data/star-cup/2026-07-31.json", (route) =>
    route.fulfill({ json: season }),
  );
  await page.goto("/bracket.html?id=2026-07-31");
  await expect(page.locator("svg")).toContainText(malicious);
  await expect(page.locator("script")).not.toContainText("window.__xss=2");
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator("svg")).toContainText("LD丨힘");
});

test("display text preserves representative Unicode characters", async ({
  page,
}) => {
  await page.goto("/bracket.html?id=2026-06-19");
  await expect(page.locator("svg")).toContainText("龍×꽃");
  await page.goto("/bracket.html?id=2026-07-03");
  await page.getByRole("button", { name: "第 6 組" }).click();
  await expect(page.locator("svg")).toContainText("Egø");
});
