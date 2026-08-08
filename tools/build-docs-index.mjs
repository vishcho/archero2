// 由目錄結構生成 docs/README.md 索引，避免手抄連結失效。
//
// 用法：node tools/build-docs-index.mjs
//
// 標題取每份 Markdown 的第一個 H1；沒有 H1 時退回檔名。

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DOCS_DIR = 'docs';
const NOTES_DIR = 'notes';

async function listMarkdown(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => path.join(dir, e.name))
    .sort();
}

async function titleOf(file) {
  const text = await readFile(file, 'utf8');
  const h1 = text.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : path.basename(file, '.md');
}

// 從 docs/ 的角度產生相對連結
function linkFrom(file) {
  const rel = path.relative(DOCS_DIR, file).split(path.sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

async function section(title, files, note) {
  if (files.length === 0) return '';
  const lines = [`## ${title}`, ''];
  if (note) lines.push(note, '');
  for (const f of files) {
    lines.push(`- [${await titleOf(f)}](${linkFrom(f)})`);
  }
  lines.push('');
  return lines.join('\n');
}

const starCup = await listMarkdown(path.join(DOCS_DIR, 'star-cup'));
const superStarCup = await listMarkdown(path.join(DOCS_DIR, 'super-star-cup'));
const topLevel = await listMarkdown(DOCS_DIR);
const notes = await listMarkdown(NOTES_DIR);
const workflows = await listMarkdown(path.join(NOTES_DIR, 'workflows'));

// 賽事文件依日期新→舊，規則類（無日期前綴）置頂。
// 兩個賽事系列排序規則相同，抽成函式避免各寫一份而分岔。
function rulesFirstNewestFirst(files) {
  const dated = files.filter((f) => /\d{4}-\d{2}-\d{2}/.test(path.basename(f)));
  const undated = files.filter((f) => !/\d{4}-\d{2}-\d{2}/.test(path.basename(f)));
  return [...undated, ...dated.reverse()];
}

const out = [
  '<!-- 本檔由 tools/build-docs-index.mjs 生成，請勿手動編輯。 -->',
  '',
  '# 文件索引',
  '',
  '`docs/` 保存賽事說明、戰報與分析。網站讀取的結構化資料在根目錄 `data/`，',
  '個人筆記與工作流在 `notes/`。',
  '',
  await section('綜合', topLevel),
  await section('明星盃', rulesFirstNewestFirst(starCup), '兩週一輪：資格賽 → 8 組淘汰賽 → 總決賽。'),
  await section('超級明星盃', rulesFirstNewestFirst(superStarCup), '四週一輪：受邀制，目前收錄選手配置。'),
  await section('個人筆記', notes),
  await section('工作流', workflows),
].join('\n');

await writeFile(path.join(DOCS_DIR, 'README.md'), out.replace(/\n{3,}/g, '\n\n'), 'utf8');
console.log(`${DOCS_DIR}/README.md 已更新`);
