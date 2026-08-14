import { Resvg } from "@resvg/resvg-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://archero2.forevergame.org/";
const seasonsPath = path.join(repoRoot, "data/star-cup/seasons.json");
const indexPath = path.join(repoRoot, "index.html");
const fontPath = path.join(repoRoot, "assets/fonts/NotoSansTC-VF.ttf");
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

function renderSvg({ edition, season, theme }) {
  const safeEdition = escapeXml(edition);
  const safeSeason = escapeXml(season);
  const safeTheme = escapeXml(theme);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050b16"/><stop offset=".52" stop-color="#101b30"/><stop offset="1" stop-color="#160d29"/></linearGradient>
    <radialGradient id="aura" cx="50%" cy="43%" r="58%"><stop offset="0" stop-color="#7c3aed" stop-opacity=".32"/><stop offset=".45" stop-color="#3b2a66" stop-opacity=".13"/><stop offset="1" stop-color="#08111f" stop-opacity="0"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3ad"/><stop offset=".46" stop-color="#f5c84c"/><stop offset="1" stop-color="#b97816"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="30"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#aura)"/>
  <ellipse cx="600" cy="315" rx="350" ry="230" fill="#6636a5" opacity=".13" filter="url(#soft)"/>
  <g fill="none" stroke="#f5c84c" stroke-opacity=".36" stroke-width="3"><path d="M0 164h108v62h70v58h64"/><path d="M0 466h108v-62h70v-58h64"/><path d="M1200 164h-108v62h-70v58h-64"/><path d="M1200 466h-108v-62h-70v-58h-64"/></g>
  <g fill="none" stroke="#b99cff" stroke-opacity=".16" stroke-width="2"><circle cx="600" cy="300" r="204"/><circle cx="600" cy="300" r="174"/><path d="M600 84v432M384 300h432M447 147l306 306M753 147 447 453"/></g>
  <g transform="translate(600 118)" filter="url(#glow)"><path d="M0-48 18-16 55-9 28 17 35 54 0 36-35 54-28 17-55-9-18-16Z" fill="#0d1627" stroke="url(#gold)" stroke-width="4"/><path d="M0-23 14 0 0 23-14 0Z" fill="#b99cff" stroke="#f5c84c" stroke-width="3"/></g>
  <g opacity=".52" stroke="url(#gold)" stroke-width="8" stroke-linecap="round"><path d="M330 112 515 292"/><path d="M870 112 685 292"/></g>
  <g fill="url(#gold)" opacity=".82"><path d="m303 82 61 18-43 43Z"/><path d="m897 82-61 18 43 43Z"/></g>
  <text x="600" y="312" text-anchor="middle" fill="url(#gold)" stroke="#f5c84c" stroke-width="1.5" paint-order="stroke" font-family="Noto Sans TC" font-size="82" font-weight="700" letter-spacing="3">明星盃下注助手</text>
  <line x1="310" y1="342" x2="890" y2="342" stroke="#f5c84c" stroke-opacity=".55"/>
  <text x="600" y="407" text-anchor="middle" fill="#edf3fb" stroke="#edf3fb" stroke-width=".7" paint-order="stroke" font-family="Noto Sans TC" font-size="43" font-weight="700" letter-spacing="6">${safeEdition}・${safeSeason}</text>
  <rect x="318" y="448" width="564" height="58" rx="29" fill="#111d30" stroke="#b99cff" stroke-opacity=".6"/>
  <text x="600" y="488" text-anchor="middle" fill="#d8ccff" font-family="Noto Sans TC" font-size="24" font-weight="500" letter-spacing="2">${safeTheme}</text>
  <text x="600" y="563" text-anchor="middle" fill="#91a1b7" font-family="Noto Sans TC" font-size="23" font-weight="500" letter-spacing="5">對戰分析｜下注建議</text>
  <circle cx="92" cy="78" r="3" fill="#f5c84c"/><circle cx="1090" cy="102" r="3" fill="#b99cff"/><circle cx="154" cy="548" r="2" fill="#b99cff"/><circle cx="1046" cy="536" r="2" fill="#f5c84c"/>
</svg>`;
}

function socialMeta({ title, description, imageUrl }) {
  return `  <!-- social-preview:start -->
  <meta name="description" content="${escapeXml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="明星盃下注助手">
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
const title = `⚔️ 明星盃下注助手｜${edition}・${season.season}`;
const description = `${season.theme}｜查看各組對戰分析與推薦下注選手。`;
const imageName = `star-cup-preview-${latestId}.png`;
const imageUrl = `${siteUrl}img/${imageName}`;
const svg = renderSvg({ edition, season: season.season, theme: season.theme });

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
  .replace(/<title>.*?<\/title>/, `<title>${escapeXml(title)}</title>`);
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
