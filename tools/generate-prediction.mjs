import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson, readJson } from "./lib/json.mjs";
import { dataPath, repoRoot } from "./lib/repo.mjs";
import { assertSchema } from "./lib/schema-validation.mjs";
import { derivePreviousSummary, validatePrediction } from "./lib/domain.mjs";
import { generatePrediction } from "./lib/prediction.mjs";

const args = process.argv.slice(2);
const seasonId = args.find((arg) => !arg.startsWith("--"));
const matchupIndex = args.indexOf("--matchup");
const matchupArg = matchupIndex >= 0 ? args[matchupIndex + 1] : null;
const publish = args.includes("--publish");
const webPreview = args.includes("--web-preview");
const confirmed = args.includes("--confirm");
if (!seasonId || !matchupArg) {
  console.error(
    "用法：node tools/generate-prediction.mjs <season-id> --matchup <matchup.json> [--publish --confirm]",
  );
  process.exit(1);
}
if (publish && !confirmed)
  throw new Error(
    "正式發布必須同時提供 --publish --confirm，表示已人工核對候選結果",
  );

const matchupFile = path.resolve(matchupArg);
const [season, matchup, seasonIds] = await Promise.all([
  readJson(dataPath("star-cup", `${seasonId}.json`)),
  readJson(matchupFile),
  readJson(dataPath("star-cup", "seasons.json")),
]);
assertSchema("matchup", matchup, matchupFile);
const seasonIndex = seasonIds.indexOf(seasonId);
const previousSeasonId = seasonIndex > 0 ? seasonIds[seasonIndex - 1] : null;
const previousSeason = previousSeasonId
  ? await readJson(dataPath("star-cup", `${previousSeasonId}.json`))
  : null;
const predictionSeason = previousSeason
  ? {
      ...season,
      groups: season.groups.map((group) => ({
        ...group,
        players: group.players.map((player) => ({
          ...(derivePreviousSummary(previousSeason, player.player_id) ?? {}),
          ...player,
        })),
      })),
    }
  : season;
const prediction = generatePrediction(predictionSeason, matchup, {
  source: publish ? "snapshot" : "preview",
  status: publish ? "published" : "preview",
});
const predictionFile = dataPath("predictions", "star-cup", `${seasonId}.json`);
assertSchema("prediction", prediction, predictionFile);
const errors = validatePrediction(
  prediction,
  new Set(seasonIds),
  predictionFile,
);
if (errors.length)
  throw new Error(
    errors.map((error) => `${error.location}: ${error.message}`).join("\n"),
  );

const picks = prediction.groups.flatMap((group) => group.picks);
console.log(`${seasonId}：${prediction.groups.length} 組、${picks.length} 場`);
console.log(
  `覆蓋：戰力 ${prediction.coverage.power.available}/64、資格賽 ${prediction.coverage.qualifier.available}/64、歷史 ${prediction.coverage.history.available}/64`,
);
console.log(`歷史基準：${previousSeasonId ?? "無上一屆"}`);
console.log(`強制選擇：${picks.filter((pick) => pick.forced).length}/56`);
for (const group of prediction.groups)
  console.log(
    `第 ${group.id} 組：${group.picks.map((pick) => `${pick.slot} ${pick[pick.selected_side].name}`).join("、")}`,
  );

if (!publish) {
  if (webPreview) {
    const previewFile = dataPath("previews", "star-cup", `${seasonId}.json`);
    await mkdir(path.dirname(previewFile), { recursive: true });
    await atomicWriteJson(previewFile, prediction, {
      validate: async (candidate) =>
        assertSchema("prediction", candidate, previewFile),
    });
    console.log(
      `已寫入前端預覽 ${path.relative(repoRoot, previewFile)}（不進正式索引）`,
    );
  }
  console.log(
    `\n預覽完成${webPreview ? "，只更新非正式前端預覽" : "，未寫入任何檔案"}。人工核對後加上 --publish --confirm 正式發布。`,
  );
  process.exit(0);
}

try {
  await access(predictionFile);
  throw new Error(
    `${path.relative(repoRoot, predictionFile)} 已存在；正式快照不可覆寫`,
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const indexFile = dataPath("predictions", "star-cup", "seasons.json");
const predictionIds = await readJson(indexFile);
if (predictionIds.includes(seasonId))
  throw new Error(`預測索引已包含 ${seasonId}`);
const nextIds = [...predictionIds, seasonId].sort();
await atomicWriteJson(predictionFile, prediction, {
  validate: async (candidate) =>
    assertSchema("prediction", candidate, predictionFile),
});
await atomicWriteJson(indexFile, nextIds);
console.log(`已正式發布 ${path.relative(repoRoot, predictionFile)}`);
