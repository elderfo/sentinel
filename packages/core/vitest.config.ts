import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    name: "@sentinel/core",
    environment: "node",
    reporters: [
      "default",
      ["junit", { outputFile: "./test-results/junit.xml" }],
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["node_modules", "dist", "**/*.test.ts", "**/__tests__/**"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@sentinel/shared": resolve(__dirname, "../shared/src/index.ts"),
      "@sentinel/core": resolve(__dirname, "./src/index.ts"),
    },
  },
});
