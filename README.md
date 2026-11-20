# PGDataLayer

Sample data and schemas used to exercise [agentic-pipeline](https://github.com/notbobutah/agentic-pipeline).

Despite the name, there is no Postgres here: data lives in local JSON files, described by JSON Schemas, and is consumed by other repos as an npm package.

## Layout

| Path | Contents |
|------|----------|
| `schema/` | JSON Schemas (one per entity) |
| `data/` | JSON data files validated against `schema/` |
| `index.d.ts` | TypeScript types generated from the schemas (committed) |

## Entities

| Entity | Schema | Data | Notes |
|--------|--------|------|-------|
| `Category` | `schema/category.schema.json` | `data/categories.json` | `id` (slug), `name`, optional `description` |
| `Product` | `schema/product.schema.json` | `data/products.json` | `id` (slug), `name`, `categoryId` → `Category.id`, `priceCents` (integer ≥ 0), `currency` (`"USD"`), `description`, `inStock` |

Each data file is a JSON array; every item is validated against the schema mapped to it in `scripts/datasets.mjs`. Every file in `data/` must have a mapping there.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm test` | Runs `node --test`: schema validation of all data, unique ids, `categoryId` referential integrity, negative fixtures, and the stale-types check |
| `npm run check` | `scripts/validate.mjs` (validates `data/`) then `scripts/check-types.mjs` (fails if `index.d.ts` differs from freshly generated output) |
| `npm run gen:types` | Regenerates `index.d.ts` from `schema/` with json-schema-to-typescript |

After changing a schema, run `npm run gen:types` and commit the updated `index.d.ts`.

## Consuming

Install from GitHub at a **full 40-character commit SHA**:

```json
"dependencies": { "pgdatalayer": "github:notbobutah/PGDataLayer#<sha>" }
```

```ts
import products from "pgdatalayer/data/products.json";
import type { Category, Product } from "pgdatalayer";
```

## Rules

- No `prepare`/build script. Consumers install without git or devDependencies, so generated files must be committed.
- CI (`npm test`, `npm run check`) must fail on invalid data, dangling references, or stale generated types.
- `.github/` and `.agentic/` are human-owned.
