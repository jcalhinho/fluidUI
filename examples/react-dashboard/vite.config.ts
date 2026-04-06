import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.resolve(__dirname, "..", "..");

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("node_modules/zrender")) return "echarts-zrender";
          if (id.includes("node_modules/echarts")) return "echarts-runtime";
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@engine": path.resolve(rootDir, "src/index.ts"),
      "@example": path.resolve(__dirname, "src")
    }
  },
  server: {
    fs: {
      allow: [rootDir]
    }
  }
});
