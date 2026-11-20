// Catalog data tests (AC1, AC2).
//
// Contracts these tests rely on (from the approved plan):
//   scripts/datasets.mjs  exports `datasets`: a mapping from a file name in data/
//                         to the file name of its JSON Schema in schema/, e.g.
//                         { "categories.json": "category.schema.json", ... }
//                         (a plain object or a Map). Each data file is an array;
//                         every item is validated against the mapped schema.
//   scripts/validate.mjs  exports `validateCatalog({ categories, products })`,
//                         returning an array of errors (empty when valid). It is
//                         also runnable as a CLI that validates data/ and exits
//                         non-zero on errors.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = (...p) => JSON.parse(readFileSync(path.join(root, ...p), "utf8"));

const loadDatasets = async () => {
  const mod = await import("../scripts/datasets.mjs");
  const ds = mod.datasets ?? mod.default;
  assert.ok(ds, "scripts/datasets.mjs must export `datasets`");
  const entries = ds instanceof Map ? [...ds.entries()] : Object.entries(ds);
  return new Map(entries.map(([d, s]) => [path.basename(d), path.basename(s)]));
};

const loadValidateCatalog = async () => {
  const mod = await import("../scripts/validate.mjs");
  assert.equal(typeof mod.validateCatalog, "function", "scripts/validate.mjs must export validateCatalog");
  return mod.validateCatalog;
};

const makeAjv = () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats.default ? addFormats.default(ajv) : addFormats(ajv);
  return ajv;
};

const categorySchema = () => readJson("schema", "category.schema.json");
const productSchema = () => readJson("schema", "product.schema.json");
const realCatalog = () => ({
  categories: readJson("data", "categories.json"),
  products: readJson("data", "products.json"),
});
const fixture = (name) => readJson("test", "fixtures", name);
const clone = (v) => structuredClone(v);

const validProduct = {
  id: "enamel-mug",
  name: "Enamel Mug",
  categoryId: "kitchen",
  priceCents: 1299,
  currency: "USD",
  description: "A speckled enamel camp mug.",
  inStock: true,
};
const validCategory = { id: "kitchen", name: "Kitchen", description: "Cookware and utensils." };
const validCatalog = () => ({ categories: [clone(validCategory)], products: [clone(validProduct)] });

describe("schemas (AC1)", () => {
  test("category schema is draft 2020-12, titled Category, closed", () => {
    const s = categorySchema();
    assert.equal(s.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(s.title, "Category");
    assert.equal(s.type, "object");
    assert.equal(s.additionalProperties, false);
    for (const k of ["id", "name"]) assert.ok(s.required?.includes(k), `category requires ${k}`);
    assert.ok(!s.required?.includes("description"), "category description is optional");
  });

  test("product schema is draft 2020-12, titled Product, closed", () => {
    const s = productSchema();
    assert.equal(s.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(s.title, "Product");
    assert.equal(s.type, "object");
    assert.equal(s.additionalProperties, false);
    for (const k of ["id", "name", "categoryId", "priceCents", "currency", "description", "inStock"]) {
      assert.ok(s.required?.includes(k), `product requires ${k}`);
    }
  });

  test("category schema accepts a valid category and rejects bad ones", () => {
    const validate = makeAjv().compile(categorySchema());
    assert.ok(validate(validCategory), JSON.stringify(validate.errors));
    const { description, ...noDescription } = validCategory;
    assert.ok(validate(noDescription), "description must be optional");
    assert.equal(validate({ ...validCategory, id: "Not A Slug!" }), false, "id must be a slug");
    assert.equal(validate({ ...validCategory, extra: 1 }), false, "no additional properties");
    assert.equal(validate({ id: "kitchen" }), false, "name is required");
  });

  test("product schema accepts a valid product and rejects bad ones", () => {
    const validate = makeAjv().compile(productSchema());
    assert.ok(validate(validProduct), JSON.stringify(validate.errors));
    assert.equal(validate({ ...validProduct, priceCents: -1 }), false, "priceCents >= 0");
    assert.equal(validate({ ...validProduct, priceCents: 12.5 }), false, "priceCents is an integer");
    assert.equal(validate({ ...validProduct, currency: "EUR" }), false, "currency is fixed to USD");
    assert.equal(validate({ ...validProduct, inStock: "yes" }), false, "inStock is boolean");
    assert.equal(validate({ ...validProduct, extra: 1 }), false, "no additional properties");
    const { categoryId, ...noCategory } = validProduct;
    assert.equal(validate(noCategory), false, "categoryId is required");
  });
});

describe("dataset mapping (AC2)", () => {
  test("every JSON file in data/ has a schema mapping", async () => {
    const ds = await loadDatasets();
    const dataFiles = readdirSync(path.join(root, "data")).filter((f) => f.endsWith(".json"));
    assert.ok(dataFiles.length > 0, "data/ contains JSON files");
    for (const f of dataFiles) assert.ok(ds.has(f), `data/${f} has no schema mapping in scripts/datasets.mjs`);
  });

  test("categories and products are mapped to their schemas, and all mapped files exist", async () => {
    const ds = await loadDatasets();
    assert.equal(ds.get("categories.json"), "category.schema.json");
    assert.equal(ds.get("products.json"), "product.schema.json");
    const schemaFiles = readdirSync(path.join(root, "schema"));
    const dataFiles = readdirSync(path.join(root, "data"));
    for (const [d, s] of ds) {
      assert.ok(dataFiles.includes(d), `mapped data file data/${d} exists`);
      assert.ok(schemaFiles.includes(s), `mapped schema schema/${s} exists`);
    }
  });
});

describe("real catalog data (AC1, AC2)", () => {
  test("every item in every data file validates against its schema", async () => {
    const ds = await loadDatasets();
    const ajv = makeAjv();
    for (const [dataFile, schemaFile] of ds) {
      const items = readJson("data", dataFile);
      assert.ok(Array.isArray(items), `data/${dataFile} is an array`);
      const validate = ajv.compile(readJson("schema", schemaFile));
      items.forEach((item, i) => {
        assert.ok(validate(item), `data/${dataFile}[${i}]: ${JSON.stringify(validate.errors)}`);
      });
    }
  });

  test("validateCatalog reports no errors for the real data", async () => {
    const validateCatalog = await loadValidateCatalog();
    const errors = validateCatalog(realCatalog());
    assert.ok(Array.isArray(errors), "validateCatalog returns an array");
    assert.deepEqual(errors, []);
  });

  test("has exactly 5 categories and 20–30 products", () => {
    const { categories, products } = realCatalog();
    assert.equal(categories.length, 5);
    assert.ok(products.length >= 20 && products.length <= 30, `got ${products.length} products`);
  });

  test("ids are unique and every product references an existing category", () => {
    const { categories, products } = realCatalog();
    const catIds = categories.map((c) => c.id);
    const prodIds = products.map((p) => p.id);
    assert.equal(new Set(catIds).size, catIds.length, "category ids are unique");
    assert.equal(new Set(prodIds).size, prodIds.length, "product ids are unique");
    for (const p of products) assert.ok(catIds.includes(p.categoryId), `${p.id} -> ${p.categoryId}`);
  });

  test("every category has at least one product", () => {
    const { categories, products } = realCatalog();
    for (const c of categories) {
      assert.ok(products.some((p) => p.categoryId === c.id), `category ${c.id} has no products`);
    }
  });

  test("validate.mjs CLI exits 0 on the real data", () => {
    const r = spawnSync(process.execPath, [path.join(root, "scripts", "validate.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  });
});

describe("validateCatalog rejects bad data (AC2)", () => {
  test("baseline: a valid catalog has no errors", async () => {
    const validateCatalog = await loadValidateCatalog();
    assert.deepEqual(validateCatalog(validCatalog()), []);
  });

  test("fixture with a dangling categoryId produces an error naming it", async () => {
    const validateCatalog = await loadValidateCatalog();
    const errors = validateCatalog(fixture("dangling-category.json"));
    assert.ok(Array.isArray(errors) && errors.length > 0, "expected errors");
    const text = JSON.stringify(errors);
    assert.ok(text.includes("no-such-category"), `errors mention the missing categoryId: ${text}`);
  });

  test("fixture with a schema violation produces an error", async () => {
    const validateCatalog = await loadValidateCatalog();
    const errors = validateCatalog(fixture("invalid-product.json"));
    assert.ok(Array.isArray(errors) && errors.length > 0, "expected errors");
  });

  test("an invalid category produces an error", async () => {
    const validateCatalog = await loadValidateCatalog();
    const c = validCatalog();
    c.categories[0].unexpected = true;
    assert.ok(validateCatalog(c).length > 0);
  });

  test("duplicate product ids produce an error", async () => {
    const validateCatalog = await loadValidateCatalog();
    const c = validCatalog();
    c.products.push({ ...clone(validProduct), name: "Another Mug" });
    assert.ok(validateCatalog(c).length > 0);
  });

  test("duplicate category ids produce an error", async () => {
    const validateCatalog = await loadValidateCatalog();
    const c = validCatalog();
    c.categories.push({ ...clone(validCategory), name: "Kitchen Again" });
    assert.ok(validateCatalog(c).length > 0);
  });
});
