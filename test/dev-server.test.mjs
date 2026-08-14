import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { repoRoot } from '../tools/lib/repo.mjs';

// dev-server 是本機開發工具，但它決定了「本機看到的站」等不等於「線上部署的站」。
// 這裡用真的 HTTP 請求驗證兩件事：extensionless 路由要通，非部署內容要擋掉。

let child;
let base;

before(async () => {
  const script = path.join(repoRoot, 'tools', 'dev-server.mjs');
  child = spawn('node', [script, '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dev-server 未在時限內啟動')), 10_000);
    child.stdout.on('data', (chunk) => {
      const match = String(chunk).match(/http:\/\/[^\s]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`dev-server 啟動失敗，exit ${code}`));
    });
  });
});

after(() => child?.kill());

const status = async (urlPath) => (await fetch(`${base}${urlPath}`)).status;

test('extensionless 路由解析到對應的 .html，比照 GitHub Pages', async () => {
  for (const route of ['/', '/bracket', '/archive', '/history', '/season']) {
    assert.equal(await status(route), 200, `${route} 應可存取`);
  }
  assert.equal(await status('/bracket?id=2026-08-14'), 200, 'query string 不影響解析');
});

test('舊的 .html 網址維持可用，外部既有連結不失效', async () => {
  for (const route of ['/index.html', '/bracket.html', '/season.html']) {
    assert.equal(await status(route), 200, `${route} 應維持可用`);
  }
});

test('網站內容照常服務', async () => {
  for (const route of ['/css/site.css', '/js/common.js', '/data/cups.json']) {
    assert.equal(await status(route), 200, `${route} 是網站內容`);
  }
  // css 的 @font-face 讀 ../assets/fonts/，assets/ 不可被擋掉。
  assert.equal(await status('/assets/fonts/NotoSansTC-VF.ttf'), 200, 'assets/ 供字型使用');
});

test('非部署內容一律 404：本機證據、工作目錄與 dotfile', async () => {
  const blocked = [
    '/.git/config',
    '/.env',
    '/.github/workflows/check.yml',
    '/screenshots',
    '/tmp',
    '/notes',
    '/tools/dev-server.mjs',
    '/test/dev-server.test.mjs',
    '/schemas',
    '/package.json',
    '/node_modules',
  ];
  for (const route of blocked) {
    assert.equal(await status(route), 404, `${route} 不該被服務`);
  }
});

test('路徑正規化後才判斷，繞道寫法同樣擋得住', async () => {
  for (const route of ['/js/../.git/config', '/./tools/dev-server.mjs', '/data/../.env']) {
    assert.equal(await status(route), 404, `${route} 不該繞過封鎖`);
  }
  // normalize 會把開頭的 ../ 收掉，等同根層路徑，仍不得逃出 ROOT。
  assert.equal(await status('/../../../../etc/passwd'), 404, '不得讀取 repo 外檔案');
});

test('不存在的路徑不做 SPA fallback', async () => {
  assert.equal(await status('/nope'), 404);
  assert.equal(await status('/nope.html'), 404);
});
