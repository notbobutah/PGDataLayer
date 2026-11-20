// Generated TypeScript types and packaging tests (AC3).
//
// Contracts these tests rely on (from the approved plan):
//   index.d.ts              committed output of `npm run gen:types`
//                           (scripts/gen-types.mjs, json-schema-to-typescript),
//                           exporting Category and Product, deterministic (no timestamp).
//   scripts/check-types.mjs regenerates the types in memory from schema/, compares
//                           byte-for-byte with index.d.ts, exits 0 when equal and 1
//                           with a "run npm run gen:types" message when different.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, cpSync, symlinkSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const dts = () => readFileSync(path.join(root, "index.d.ts"), "utf8");
const pkg = () => JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const runCheck = (cwd) =>
  spawnSync(process.execPath, [path.join(cwd, "scripts", "check-types.mjs")], { cwd, encoding: "utf8" });

// Copy the inputs check-types needs into a scratch directory so we can tamper
// with index.d.ts without touching the working tree.
const scratchCopy = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pgdatalayer-types-"));
  for (const p of ["scripts", "schema", "data", "package.json", "index.d.ts"]) {
    cpSync(path.join(root, p), path.join(dir, p), { recursive: true });
  }
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  return dir;
};

describe("index.d.ts (AC3)", () => {
  test("is committed and exports Category and Product", () => {
    assert.ok(existsSync(path.join(root, "index.d.ts")), "index.d.ts exists");
    const src = dts();
    assert.match(src, /export (interface|type) Category\b/);
    assert.match(src, /export (interface|type) Product\b/);
  });

  test("Product type carries the schema fields", () => {
    const src = dts();
    for (const field of ["id", "name", "categoryId", "priceCents", "currency", "description", "inStock"]) {
      assert.match(src, new RegExp(`\\b${field}\\??:`), `Product has ${field}`);
    }
    assert.match(src, /currency\??:\s*"USD"/, "currency is the literal USD");
    assert.match(src, /inStock\??:\s*boolean/);
    assert.match(src, /priceCents\??:\s*number/);
  });

  test("contains no timestamp (deterministic output)", () => {
    assert.doesNotMatch(dts(), /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  test("check-types passes on the committed file", () => {
    const r = runCheck(root);
    assert.equal(r.status, 0, `index.d.ts is stale or check failed.\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  });

  test("check-types fails with a regeneration hint when index.d.ts is stale", () => {
    const dir = scratchCopy();
    try {
      writeFileSync(path.join(dir, "index.d.ts"), dts() + "\nexport interface Stale { x: string }\n");
      const r = runCheck(dir);
      assert.equal(r.status, 1, `expected exit 1.\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
      assert.match(r.stdout + r.stderr, /npm run gen:types/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("check-types fails when a schema changes without regenerating", () => {
    const dir = scratchCopy();
    try {
      const schemaPath = path.join(dir, "schema", "product.schema.json");
      const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
      schema.properties.sku = { type: "string" };
      writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + "\n");
      const r = runCheck(dir);
      assert.equal(r.status, 1, `expected exit 1.\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("package.json (AC3)", () => {
  test("exposes the types and keeps data/schema exports", () => {
    const p = pkg();
    assert.equal(p.types, "./index.d.ts");
    assert.equal(p.exports?.["."]?.types, "./index.d.ts");
    assert.equal(p.exports?.["./data/*"], "./data/*");
    assert.equal(p.exports?.["./schema/*"], "./schema/*");
  });

  test("files list ships data, schema and index.d.ts", () => {
    const files = (pkg().files ?? []).map((f) => f.replace(/^\.\//, "").replace(/\/(\*\*?)?$/, ""));
    for (const f of ["data", "schema", "index.d.ts"]) assert.ok(files.includes(f), `files includes ${f}`);
  });

  test("has check and gen:types scripts and no install-time build hooks", () => {
    const s = pkg().scripts ?? {};
    assert.equal(s.test, "node --test");
    assert.ok(s.check, "check script");
    assert.match(s.check, /check-types\.mjs/);
    assert.ok(s["gen:types"], "gen:types script");
    assert.match(s["gen:types"], /gen-types\.mjs/);
    for (const hook of ["prepare", "preinstall", "install", "postinstall", "build"]) {
      assert.equal(s[hook], undefined, `no ${hook} script`);
    }
  });
});
