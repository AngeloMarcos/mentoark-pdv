import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { writeFileSync } from "fs";

// https://vitejs.dev/config/
export default defineConfig(() => {
  // ID único por build. Usado pra detectar, no navegador do cliente,
  // quando existe uma versão mais nova publicada (ver useAppVersionCheck) —
  // sem isso, o navegador pode continuar rodando um bundle antigo em cache
  // (com bugs já corrigidos) por tempo indefinido.
  const buildId = Date.now().toString();

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      {
        name: "write-app-version",
        closeBundle() {
          writeFileSync(
            path.resolve(__dirname, "dist/version.json"),
            JSON.stringify({ buildId })
          );
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
  };
});
