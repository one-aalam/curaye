import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, "./src") }],
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 1420,
    strictPort: process.env.TAURI_ENV_PLATFORM !== undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@base-ui/react/dialog",
      "@base-ui/react/menu",
      "@base-ui/react/popover",
      "@base-ui/react/switch",
      "@base-ui/react/tabs",
      "@base-ui/react/tooltip",
    ],
  },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
