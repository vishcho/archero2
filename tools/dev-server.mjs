// 本機靜態檔案伺服器：頁面用 fetch 讀 data/*.json，直接開檔會被 CORS 擋下。
//
// 用法：node tools/dev-server.mjs [--port 8000] [--host 127.0.0.1]
//
// 刻意不引入依賴（見 AGENTS.md 的 Change boundaries）：只服務本 repo 的靜態檔，
// 不做 SPA fallback、不做快取、不處理 range request。

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

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
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    console.error(`--port 需為 1–65535 的整數，收到：${opts.port}`);
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

  try {
    const info = await stat(resolved);
    if (info.isDirectory()) {
      const index = path.join(resolved, 'index.html');
      const indexInfo = await stat(index);
      return indexInfo.isFile() ? { file: index, size: indexInfo.size } : null;
    }
    return { file: resolved, size: info.size };
  } catch {
    return null;
  }
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
  console.log(`archero2-web → http://${host}:${port}  (Ctrl+C 結束)`);
});
