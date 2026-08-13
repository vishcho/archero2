#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateTournamentResults } from "./lib/domain.mjs";

const [, , dataPathArg] = process.argv;
if (!dataPathArg) {
  console.error(
    "Usage: node tools/validate-tournament-results.mjs <data/star-cup/{season}.json>",
  );
  process.exit(1);
}

const dataPath = path.resolve(process.cwd(), dataPathArg);
const season = JSON.parse(await readFile(dataPath, "utf8"));
const diagnostics = validateTournamentResults(season, dataPathArg);
const warnings = diagnostics.filter((item) => item.severity === "warning");
const errors = diagnostics.filter((item) => item.severity === "error");

if (warnings.length) {
  console.warn(
    warnings
      .map((warning) => `warning: ${warning.location}: ${warning.message}`)
      .join("\n"),
  );
}

if (errors.length) {
  console.error(
    errors.map((error) => `${error.location}: ${error.message}`).join("\n"),
  );
  process.exit(1);
}

console.log(`${dataPathArg}: tournament results OK`);
