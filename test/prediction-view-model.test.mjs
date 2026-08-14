import assert from "node:assert/strict";
import { test } from "node:test";
import { loadBrowserScript } from "./helpers/load-browser-script.mjs";

const browser = await loadBrowserScript("js/common.js");

test("betting state follows Taipei date and publication lifecycle", () => {
  const season = { id: "2026-08-14", status: "upcoming" };
  assert.equal(
    browser.bettingState(season, null, new Date("2026-08-13T16:00:00Z")).key,
    "preparing",
  );
  assert.equal(
    browser.bettingState(season, {}, new Date("2026-08-13T16:00:00Z")).key,
    "open",
  );
  assert.equal(
    browser.bettingState(
      { ...season, status: "finished" },
      {},
      new Date("2026-08-20T00:00:00Z"),
    ).key,
    "finished",
  );
});

test("copied betting list preserves the seven game operation order", () => {
  const slots = ["A", "B", "C", "D", "upper", "lower", "final"];
  const text = browser.predictionText([
    {
      id: 1,
      picks: slots.map((slot) => ({
        slot,
        p1: { name: slot },
        p2: { name: "X" },
        selected_side: "p1",
      })),
    },
  ]);
  assert.equal(
    text,
    "第1組：A A、B B、C C、D D、R2 上 upper、R2 下 lower、組冠軍 final",
  );
});

test("coverage gaps and HTML escaping remain explicit", () => {
  assert.deepEqual(
    browser.coverageGaps({
      power: { available: 60, total: 64 },
      qualifier: { available: 64, total: 64 },
      history: { available: 20, total: 64 },
    }),
    ["戰力缺 4 人", "歷史缺 44 人"],
  );
  assert.equal(
    browser.escapeHtml('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
});
