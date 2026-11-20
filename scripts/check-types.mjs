// Fails (exit 1) if the committed index.d.ts differs from what
// scripts/gen-types.mjs would generate from the current schemas.
import { existsSync, readFileSync } from "node:fs";
import { generateTypes, outFile } from "./gen-types.mjs";

const expected = await generateTypes();
const actual = existsSync(outFile) ? readFileSync(outFile, "utf8") : null;

if (actual !== expected) {
  console.error(
    actual === null
      ? "index.d.ts is missing. Run `npm run gen:types` and commit the result."
      : "index.d.ts is out of date with schema/. Run `npm run gen:types` and commit the result.",
  );
  process.exit(1);
}
console.log("index.d.ts is up to date");
