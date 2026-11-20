// Maps each data file in data/ to the JSON Schema in schema/ that every item
// of that file must satisfy. Every JSON file in data/ must appear here
// (enforced by test/catalog.test.mjs).
export const datasets = {
  "categories.json": "category.schema.json",
  "products.json": "product.schema.json",
};

export default datasets;
