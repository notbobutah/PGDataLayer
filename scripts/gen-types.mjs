// Generates index.d.ts from the JSON Schemas in schema/.
//
// Library: import { generateTypes } from "./gen-types.mjs"  (returns the file contents)
// CLI:     node scripts/gen-types.mjs                      (writes index.d.ts)
//
// Output is deterministic (fixed banner, no timestamp) so scripts/check-types.mjs
// can compare it byte-for-byte with the committed file.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compile } from "json-schema-to-typescript";

export const root = fileURLToPath(new URL("..", import.meta.url));
export const outFile = path.join(root, "index.d.ts");

// Order is fixed so output is stable.
const schemaFiles = ["category.schema.json", "product.schema.json"];

const banner = `/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Generated from schema/*.schema.json by scripts/gen-types.mjs.
 * Run \`npm run gen:types\` to regenerate.
 */
`;

export async function generateTypes() {
  const parts = [];
  for (const file of schemaFiles) {
    const schema = JSON.parse(readFileSync(path.join(root, "schema", file), "utf8"));
    // $id would otherwise be used for naming; rely on `title` instead.
    const { $id, ...rest } = schema;
    const ts = await compile(rest, schema.title, {
      bannerComment: "",
      additionalProperties: false,
      strictIndexSignatures: true,
      cwd: path.join(root, "schema"),
      format: true,
    });
    parts.push(ts.trim());
  }
  return `${banner}\n${parts.join("\n\n")}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(outFile, await generateTypes());
  console.log(`wrote ${path.relative(process.cwd(), outFile) || outFile}`);
}
