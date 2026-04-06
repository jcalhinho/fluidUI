import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.resolve(__dirname, "..", "..");
function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveBasePath(): string {
  const explicitBasePath = process.env.VITE_BASE_PATH;
  if (explicitBasePath && explicitBasePath.trim().length > 0) {
    return ensureTrailingSlash(explicitBasePath.trim());
  }

  const repository = process.env.GITHUB_REPOSITORY;
  const inGithubActions = process.env.GITHUB_ACTIONS === "true";
  if (inGithubActions && repository) {
    const [, repoName] = repository.split("/");
    if (repoName && !repoName.endsWith(".github.io")) {
      return `/${repoName}/`;
    }
  }

  return "/";
}

export default defineConfig({
  plugins: [react()],
  base: resolveBasePath(),
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
      "@fluidui/core": path.resolve(rootDir, "packages/core/src/index.ts"),
      "@example": path.resolve(__dirname, "src")
    }
  },
  server: {
    fs: {
      allow: [rootDir]
    }
  }
});
