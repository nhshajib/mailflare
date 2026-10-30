import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.argv[2] ?? "dist/server");
assert.ok(existsSync(join(root, "wrangler.json")), "Build the Worker before checking its modules");
const config = JSON.parse(readFileSync(join(root, "wrangler.json"), "utf8"));
assert.ok(existsSync(resolve(root, config.main)), "Worker entry module is missing");
const missing = [];
let modules = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) inspect(file);
    else if (/\.m?js$/.test(entry.name)) {
      modules++;
      const { importedFiles } = ts.preProcessFile(readFileSync(file, "utf8"), true, true);
      for (const { fileName } of importedFiles) {
        if (fileName.startsWith(".") && !existsSync(resolve(dirname(file), fileName))) {
          missing.push(`${file}: ${fileName}`);
        }
      }
    }
  }
}
inspect(root);
assert.deepEqual(missing, [], "Worker contains imports that Cloudflare cannot resolve");
console.log(`Verified relative imports in ${modules} Worker modules.`);
