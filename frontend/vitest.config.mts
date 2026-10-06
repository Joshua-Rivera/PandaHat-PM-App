import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"], include: ["tests/**/*.test.tsx"] },
});
