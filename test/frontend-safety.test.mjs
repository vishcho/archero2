import assert from "node:assert/strict";
import { test } from "node:test";
import { loadBrowserScript } from "./helpers/load-browser-script.mjs";

const { displayName, fetchJson } = await loadBrowserScript(
  "js/common.js",
  "js/api.js",
);

test("displayName composes Unicode text without treating it as markup", () => {
  const value = `<img onerror=x> 龍×꽃 丨 Egø 😀 &'"`;
  assert.equal(displayName({ name: value, flag: "⚠" }), `${value} ⚠`);
});

test("fetchJson distinguishes network, HTTP, and JSON failures", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await assert.rejects(fetchJson("/network.json"), (error) => {
      return (
        error.name === "DataFetchError" &&
        error.kind === "network" &&
        error.url === "/network.json"
      );
    });

    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    await assert.rejects(
      fetchJson("/missing.json"),
      (error) => error.kind === "http" && error.message.includes("404"),
    );

    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        throw new SyntaxError("bad JSON");
      },
    });
    await assert.rejects(
      fetchJson("/bad.json"),
      (error) => error.kind === "json" && error.url === "/bad.json",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
