import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Vite config.
 *
 * Vite does two jobs. In development it runs a server that hands your browser
 * ES modules directly with almost no bundling — that's why `npm run dev` starts
 * in well under a second, and why saving a file updates the page without a full
 * reload (Hot Module Replacement). For production, `npm run build` bundles and
 * minifies everything with Rollup.
 *
 * Plugins teach Vite about file types it doesn't natively understand:
 *   react()      — compiles JSX (<div/> syntax) into real JS function calls,
 *                  and wires up HMR so editing a component preserves state.
 *   tailwindcss() — scans your files for utility class names and generates only
 *                  the CSS you actually used.
 *
 * Tailwind v4 note: there is deliberately NO tailwind.config.js and no
 * postcss.config.js. v4 replaced both with this plugin plus CSS-native
 * configuration (see the @theme block in src/index.css). If you follow an older
 * tutorial that tells you to run `npx tailwindcss init`, it's written for v3.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: true, // pop the browser open automatically on `npm run dev`
  },
});
