import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    pool: "threads",
    maxWorkers: 20,
    fileParallelism: true,
    maxConcurrency: 20,
    include: [
      "src/app/**/dashboard/endpoint/__tests__/**/*.test.tsx",
      "src/app/**/dashboard/providers/**/__tests__/**/*.test.tsx",
      "src/shared/components/*.test.tsx",
      "src/shared/hooks/__tests__/**/*.test.tsx",
      "tests/unit/autoCombo/**/*.test.ts",
      "tests/unit/encryption.spec.ts",
      "tests/unit/**/*.test.tsx",
      "open-sse/services/autoCombo/__tests__/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "open-sse/services/autoCombo/__tests__/providerDiversity.test.ts",
    ],
    coverage: {
      reportsDirectory: "coverage",
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
