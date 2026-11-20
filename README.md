# PGDataLayer

Sample data and schemas used to exercise [agentic-pipeline](https://github.com/notbobutah/agentic-pipeline).

Despite the name, there is no Postgres here: data lives in local JSON files, described by JSON Schemas, and is consumed by other repos as an npm package.

## Layout

| Path | Contents |
|------|----------|
| `schema/` | JSON Schemas (one per entity) |
| `data/` | JSON data files validated against `schema/` |
| `index.d.ts` | TypeScript types generated from the schemas (committed) |

## Consuming

Install from GitHub at a **full 40-character commit SHA**:

```json
"dependencies": { "pgdatalayer": "github:notbobutah/PGDataLayer#<sha>" }
```

```ts
import products from "pgdatalayer/data/products.json";
```

## Rules

- No `prepare`/build script. Consumers install without git or devDependencies, so generated files must be committed.
- CI (`npm test`, `npm run check`) must fail on invalid data, dangling references, or stale generated types.
- `.github/` and `.agentic/` are human-owned.
