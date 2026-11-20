// Validates the catalog: every item against its JSON Schema, unique ids, and
// that every product.categoryId refers to an existing category.
//
// Library: import { validateCatalog } from "./validate.mjs"
// CLI:     node scripts/validate.mjs   (exits 1 if data/ has any error)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { datasets } from "./datasets.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const addFormats = addFormatsModule.default ?? addFormatsModule;
const readJson = (...p) => JSON.parse(readFileSync(path.join(root, ...p), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validators = {
  categories: ajv.compile(readJson("schema", "category.schema.json")),
  products: ajv.compile(readJson("schema", "product.schema.json")),
};

const checkItems = (errors, key, items) => {
  if (!Array.isArray(items)) {
    errors.push({ path: key, message: `${key} must be an array` });
    return [];
  }
  const validate = validators[key];
  items.forEach((item, i) => {
    if (!validate(item)) {
      for (const e of validate.errors) {
        errors.push({ path: `${key}[${i}]${e.instancePath}`, message: e.message, keyword: e.keyword });
      }
    }
  });
  return items;
};

const checkUniqueIds = (errors, key, items) => {
  const seen = new Set();
  items.forEach((item, i) => {
    const id = item?.id;
    if (typeof id !== "string") return;
    if (seen.has(id)) errors.push({ path: `${key}[${i}].id`, message: `duplicate id "${id}"` });
    seen.add(id);
  });
};

/**
 * @param {{ categories: unknown[], products: unknown[] }} catalog
 * @returns {{ path: string, message: string, keyword?: string }[]} errors (empty when valid)
 */
export function validateCatalog({ categories, products } = {}) {
  const errors = [];
  const cats = checkItems(errors, "categories", categories);
  const prods = checkItems(errors, "products", products);
  checkUniqueIds(errors, "categories", cats);
  checkUniqueIds(errors, "products", prods);

  const categoryIds = new Set(cats.map((c) => c?.id));
  prods.forEach((p, i) => {
    if (p && typeof p.categoryId === "string" && !categoryIds.has(p.categoryId)) {
      errors.push({
        path: `products[${i}].categoryId`,
        message: `product "${p.id}" references unknown categoryId "${p.categoryId}"`,
      });
    }
  });
  return errors;
}

/** Loads every mapped data file from data/, keyed by base name (e.g. "products"). */
export function loadCatalog() {
  return Object.fromEntries(
    Object.keys(datasets).map((file) => [path.basename(file, ".json"), readJson("data", file)]),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateCatalog(loadCatalog());
  if (errors.length > 0) {
    for (const e of errors) console.error(`${e.path}: ${e.message}`);
    console.error(`\n${errors.length} error(s) in data/`);
    process.exit(1);
  }
  console.log("data/ is valid");
}
