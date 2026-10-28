import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

export async function loadTypewitRuntime() {
  mkdirSync(resolve("node_modules/.cache"), { recursive: true });
  const outdir = mkdtempSync(resolve("node_modules/.cache/typewit-"));
  await build({
    stdin: { contents: `export * as login from './src/app/api/auth/login/route.ts';
      export * as accounts from './src/app/api/typewit/accounts/route.ts';
      export * as forwarding from './src/app/api/typewit/forwarding/route.ts';
      export * from './src/lib/typewit/forwarding.ts';
      export * from './src/lib/auth/session.ts';
      export * from './src/lib/auth/password.ts';
      export * from './src/lib/mailboxes/access.ts';
      export * from './src/lib/backups/export.ts';
      export * from './src/db/index.ts';`, resolveDir: process.cwd() },
    outfile: join(outdir, "runtime.mjs"), bundle: true, platform: "node", format: "esm", packages: "external",
    alias: { "@": resolve("src") }, logLevel: "silent",
    plugins: [{ name: "test-runtime-boundaries", setup(builder) {
      builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "headers", namespace: "test" }));
      builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true }));
      builder.onResolve({ filter: /^@\/lib\/cloudflare$/ }, () => ({ path: "env", namespace: "test" }));
      builder.onResolve({ filter: /^@\/lib\/auth\/cookies$/ }, () => ({ path: "cookies", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ contents: path === "headers" ? `export async function cookies() { return { get() { return undefined; } }; }` : path === "env"
        ? `export function getEnv() { return globalThis.__typewitTestEnv; }`
        : `import { getUserFromSession, getSessionTokenFromRequestHeaders } from '${resolve("src/lib/auth/session.ts")}';
           export async function requireUser(env, request) {
             const user = await getUserFromSession(env, getSessionTokenFromRequestHeaders(request));
             if (!user) throw new Error('Unauthorized'); return user;
           }`, resolveDir: process.cwd() }));
    } }],
  });
  const runtime = await import(pathToFileURL(join(outdir, "runtime.mjs")).href);
  return { ...runtime, cleanup: () => rmSync(outdir, { recursive: true, force: true }) };
}

export function testDatabase({ beforeTypewit = false } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const name of readdirSync("drizzle/migrations").filter(x => x.endsWith(".sql")).sort()) {
    if (beforeTypewit && name.startsWith("0078_")) continue;
    sqlite.exec(readFileSync(join("drizzle/migrations", name), "utf8"));
  }
  const statement = (query, values = []) => ({
    bind: (...params) => statement(query, params),
    async all() { return { results: sqlite.prepare(query).all(...values), success: true, meta: {} }; },
    async first(column) { const row = sqlite.prepare(query).get(...values) ?? null; return column ? row?.[column] : row; },
    async raw() { return sqlite.prepare(query).all(...values).map(row => Object.values(row)); },
    async run() { const result = sqlite.prepare(query).run(...values); return { results: [], success: true, meta: { changes: Number(result.changes) } }; },
    query, values,
  });
  const DB = {
    prepare: statement,
    async batch(queries) {
      sqlite.exec("BEGIN");
      try {
        const rows = queries.map(({ query, values }) => {
          const prepared = sqlite.prepare(query);
          return { results: prepared.all(...values), success: true, meta: {} };
        });
        sqlite.exec("COMMIT"); return rows;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    async exec(query) { sqlite.exec(query); return { count: 1, duration: 0 }; },
  };
  return { DB, sqlite, close: () => sqlite.close() };
}
