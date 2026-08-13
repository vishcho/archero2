// 以 vm 載入 js/ 下的傳統 <script> 檔案，讓 node --test 能測試瀏覽器端邏輯。
//
// 頁面刻意沒有建置流程與 module 系統（見 AGENTS.md「不引入 build system」），
// 所以那些檔案不能寫 export。這個 helper 讓同一份實作既能被 <script> 載入，
// 也能被測試與工具匯入，避免出現兩套會漂移的邏輯。

import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

// 用 vm.runInThisContext 而非 createContext：後者會建立新的 realm，其中的 Array/Object
// 與測試端不同源，assert.deepStrictEqual 會判定「結構相同但非同源」而失敗。
// 這裡把 script 包成 IIFE 並回傳其中宣告的名稱，既留在同一個 realm，
// 也不會污染測試行程的全域。
export async function loadBrowserScript(...relativePaths) {
  const sources = [];
  for (const relativePath of relativePaths) {
    const filename = path.resolve(relativePath);
    sources.push(await readFile(filename, "utf8"));
  }
  // 收集頂層 function 與 const 宣告的名稱，於 IIFE 結尾一併回傳。
  const body = sources.join("\n");
  const names = [
    ...body.matchAll(
      /^(?:(?:async\s+)?function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    ),
  ].map((m) => m[1]);
  const unique = [...new Set(names)];
  const wrapped = `(function () {\n${body}\nreturn { ${unique.join(", ")} };\n})()`;
  return vm.runInThisContext(wrapped, {
    filename: path.resolve(relativePaths[0]),
  });
}
