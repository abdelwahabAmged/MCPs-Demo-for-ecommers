import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

export default defineConfig({
  plugins: [viteSingleFile()],
  root: "src/ui",
  build: {
    outDir: path.resolve("dist/ui"),
    emptyOutDir: true,
    rollupOptions: {
      input: process.env.INPUT,
    },
  },
});
