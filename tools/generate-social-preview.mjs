import { Resvg } from "@resvg/resvg-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://archero2.forevergame.org/";
const seasonsPath = path.join(repoRoot, "data/star-cup/seasons.json");
const indexPath = path.join(repoRoot, "index.html");
const fontPath = path.join(repoRoot, "assets/fonts/NotoSansTC-VF.ttf");
const tataPath = path.join(repoRoot, "img/game/characters/tata.png");
const checkOnly = process.argv.includes("--check");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chineseNumber(value) {
  const digits = "零一二三四五六七八九";
  if (value < 10) return digits[value];
  if (value < 20) return `十${value === 10 ? "" : digits[value - 10]}`;
  if (value < 100) {
    const ones = value % 10;
    return `${digits[Math.floor(value / 10)]}十${ones ? digits[ones] : ""}`;
  }
  return String(value);
}

function renderSvg({ edition, season, theme, tataDataUri }) {
  const safeSeason = escapeXml(season);
  const safeTheme = escapeXml(theme);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#090b0e"/><stop offset=".62" stop-color="#0d0f12"/><stop offset="1" stop-color="#15130e"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8954f"/><stop offset="1" stop-color="#d6b568"/></linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#b8954f" stroke-opacity=".055"/></pattern>
    <clipPath id="tata"><rect x="82" y="66" width="78" height="78" rx="19"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="38" y="34" width="1124" height="562" rx="24" fill="#111419" stroke="#2a2d2f" stroke-width="2"/>
  <path d="M39 146V58a24 24 0 0 1 24-24h1075a24 24 0 0 1 24 24v88" fill="none" stroke="url(#gold)" stroke-opacity=".55" stroke-width="3"/>

  <rect x="74" y="58" width="94" height="94" rx="23" fill="#191b20" stroke="#4c4434"/>
  <image x="82" y="66" width="78" height="87" preserveAspectRatio="xMidYMid slice" clip-path="url(#tata)" xlink:href="${tataDataUri}"/>
  <text x="194" y="118" font-family="Noto Sans TC" font-size="36" font-weight="600"><tspan fill="#d6b568">弓箭傳說2</tspan><tspan fill="#f1eee7">  |  塔塔的寶藏</tspan></text>

  <text x="600" y="328" text-anchor="middle" fill="#d6b568" stroke="#d6b568" stroke-width="1.8" paint-order="stroke" font-family="Noto Sans TC" font-size="72" font-weight="800">明星盃助手</text>
  <line x1="435" y1="370" x2="765" y2="370" stroke="url(#gold)" stroke-opacity=".7" stroke-width="2"/>
  <text x="600" y="448" text-anchor="middle" fill="#f1eee7" font-family="Noto Sans TC" font-size="48" font-weight="500"><tspan fill="#d6b568">${safeSeason}</tspan><tspan fill="#706d67">  |  </tspan><tspan fill="#f1eee7">${safeTheme}</tspan></text>
</svg>`;
}

function socialMeta({ title, description, imageUrl }) {
  return `  <!-- social-preview:start -->
  <meta name="description" content="${escapeXml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="弓箭傳說 2｜塔塔的寶藏">
  <meta property="og:title" content="${escapeXml(title)}">
  <meta property="og:description" content="${escapeXml(description)}">
  <meta property="og:url" content="${siteUrl}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeXml(title)}｜對戰分析與下注建議">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeXml(title)}">
  <meta name="twitter:description" content="${escapeXml(description)}">
  <meta name="twitter:image" content="${imageUrl}">
  <link rel="canonical" href="${siteUrl}">
  <!-- social-preview:end -->`;
}

const seasonIds = JSON.parse(await readFile(seasonsPath, "utf8"));
const latestId = seasonIds.at(-1);
if (!latestId) throw new Error("data/star-cup/seasons.json 沒有任何賽事");
const season = JSON.parse(await readFile(path.join(repoRoot, `data/star-cup/${latestId}.json`), "utf8"));
const edition = `第${chineseNumber(season.round)}屆`;
const title = `塔塔的寶藏｜${edition}明星盃・${season.season}`;
const pageTitle = `弓箭傳說 2 塔塔的寶藏｜${edition}明星盃・${season.season}`;
const description = `${season.theme}｜查看各組對戰分析與推薦下注選手。`;
const imageName = `star-cup-preview-${latestId}.png`;
const imageUrl = `${siteUrl}img/${imageName}`;
const tataDataUri = `data:image/png;base64,${(await readFile(tataPath)).toString("base64")}`;
const svg = renderSvg({ edition, season: season.season, theme: season.theme, tataDataUri });

const png = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: {
    fontFiles: [fontPath],
    loadSystemFonts: false,
    defaultFontFamily: "Noto Sans TC",
  },
}).render().asPng();

const indexHtml = await readFile(indexPath, "utf8");
const metaPattern = /  <!-- social-preview:start -->[\s\S]*?  <!-- social-preview:end -->/;
if (!metaPattern.test(indexHtml)) throw new Error("index.html 找不到 social-preview 標記");
const nextIndex = indexHtml
  .replace(metaPattern, socialMeta({ title, description, imageUrl }))
  .replace(/<title>.*?<\/title>/, `<title>${escapeXml(pageTitle)}</title>`);
const imagePath = path.join(repoRoot, "img", imageName);
const svgPath = path.join(repoRoot, "img", "star-cup-preview.svg");

if (checkOnly) {
  const [currentIndex, currentPng, currentSvg] = await Promise.all([readFile(indexPath), readFile(imagePath), readFile(svgPath)]);
  if (!currentIndex.equals(Buffer.from(nextIndex))) throw new Error("index.html 預覽資訊需要更新");
  if (!currentPng.equals(png)) throw new Error(`${imageName} 需要更新`);
  if (!currentSvg.equals(Buffer.from(svg))) throw new Error("star-cup-preview.svg 需要更新");
  console.log(`社群預覽已是最新版本：${edition}・${season.season}`);
} else {
  await Promise.all([writeFile(indexPath, nextIndex), writeFile(imagePath, png), writeFile(svgPath, svg)]);
  console.log(`已產生 ${imageName}：${edition}・${season.season}`);
}
