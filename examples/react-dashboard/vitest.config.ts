import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      css: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
    },
  })
);
