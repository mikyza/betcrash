import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next 16 removed `next lint`; run `npm run lint` (plain ESLint with the flat config).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "dist/**", "out/**", "node_modules/**", "next-env.d.ts", "src/components/ui/**"]),
]);
