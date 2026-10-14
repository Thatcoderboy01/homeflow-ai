import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../..", // read VITE_* variables from the repo-root .env
  server: { port: 5173, host: "127.0.0.1" },
});
