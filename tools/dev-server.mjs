// 本機靜態檔案伺服器：頁面用 fetch 讀 data/*.json，直接開檔會被 CORS 擋下。
//
// 用法：node tools/dev-server.mjs [--port 8000] [--host 127.0.0.1]
//
// 刻意不引入依賴（見 AGENTS.md 的 Change boundaries）：只服務本 repo 的靜態檔，
// 不做 SPA fallback、不做快取、不處理 range request。
//
// 站內連結不帶 .html（見 AGENTS.md 的 URL 慣例），因此 /bracket 需解析到 bracket.html，
// 比照 GitHub Pages 的 extensionless 行為，避免本機與線上不一致。
//
// 只服務會部署的內容：BLOCKED 擋掉工作用目錄與本機證據。這同時是正確性措施——
// screenshots/、tmp/ 不進 git，線上根本不存在，本機若能載到就會漏掉「線上 404」的錯誤。

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

// 不對外服務的根層項目。css/ js/ img/ data/ assets/ docs/ 是網站內容，不在此列
// （assets/ 供 css 的 @font-face 使用，docs/ 在 GitHub Pages 上也是線上內容）。
const BLOCKED = new Set([
  'node_modules',
  'screenshots',
  'tmp',
  'notes',
  'tools',
  'test',
  'schemas',
  'package.json',
  'package-lock.json',
]);

// 任何 dotfile / dot 目錄（.git、.env、.github、.claude…）與秘密檔一律拒絕。
function isBlocked(relative) {
  const segments = relative.split(path.sep).filter(Boolean);
  if (!segments.length) return false;
  if (segments.some((segment) => segment.startsWith('.'))) return true;
  if (BLOCKED.has(segments[0])) return true;
  return /^\.env/i.test(segments.at(-1));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function parseArgs(argv) {
  const opts = { port: 8000, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port' || arg === '-p') opts.port = Number(argv[++i]);
    else if (arg === '--host') opts.host = argv[++i];
    else {
      console.error(`未知參數：${arg}`);
      process.exit(1);
    }
  }
  // 0 = 交給 OS 挑一個空閒埠（測試用，避免固定埠互撞）。
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) {
    console.error(`--port 需為 0–65535 的整數，收到：${opts.port}`);
    process.exit(1);
  }
  return opts;
}

// 解析 URL 到 repo 內的實體路徑；越界（../）或不存在時回傳 null。
async function resolveTarget(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null; // 非法百分號編碼
  }

  const resolved = path.resolve(ROOT, `.${path.posix.normalize(decoded)}`);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  if (isBlocked(path.relative(ROOT, resolved))) return null;

  const asFile = async (candidate) => {
    try {
      const info = await stat(candidate);
      return info.isFile() ? { file: candidate, size: info.size } : null;
    } catch {
      return null;
    }
  };

  let info;
  try {
    info = await stat(resolved);
  } catch {
    // 不存在時試 extensionless：/bracket → bracket.html
    return path.extname(resolved) ? null : asFile(`${resolved}.html`);
  }

  if (info.isDirectory()) return asFile(path.join(resolved, 'index.html'));
  return { file: resolved, size: info.size };
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const { port, host } = parseArgs(process.argv.slice(2));

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    send(res, 405, '405 Method Not Allowed\n');
    return;
  }

  const target = await resolveTarget(req.url ?? '/');
  if (!target) {
    send(res, 404, '404 Not Found\n');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(target.file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': target.size,
    'Cache-Control': 'no-store', // 本機開發：改了 data/*.json 重整就要看到新的
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(target.file);
  stream.on('error', () => {
    res.destroy();
  });
  stream.pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`連接埠 ${port} 已被占用，改用：npm run dev -- --port 8001`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, host, () => {
  // --port 0 時要印實際取得的埠，否則看不出該連哪裡。
  console.log(`archero2-web → http://${host}:${server.address().port}  (Ctrl+C 結束)`);
});
