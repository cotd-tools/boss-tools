import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { markerEditorPlugin } from "./scripts/marker-editor-plugin.ts";

export default defineConfig({
  plugins: [vue(), tailwindcss(), markerEditorPlugin()],
  // Relative assets work on both / and /<repository>/, including custom domains.
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
