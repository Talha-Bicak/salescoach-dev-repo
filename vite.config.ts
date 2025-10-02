import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "644d5e4d-5177-414a-8297-64e804eca698-00-uah66ckknxjb.sisko.replit.dev",
    port: 5000,
    strictPort: true,
    hmr: {
      clientPort: 443,
      protocol: "wss",
    },
  },
});
