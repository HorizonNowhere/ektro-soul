import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: {
      "adapters/sqlite": "src/adapters/sqlite.ts",
      "adapters/memory": "src/adapters/memory.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["better-sqlite3"],
  },
]);
