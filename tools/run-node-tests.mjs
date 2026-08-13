import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

async function discover(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "browser") files.push(...(await discover(file)));
    } else if (entry.name.endsWith(".test.mjs")) {
      files.push(file);
    }
  }
  return files;
}

const files = (await discover("test")).sort();
if (!files.length) {
  console.error("No Node test files found");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
