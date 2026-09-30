import path from "node:path";
import { createRequire } from "node:module";
const dependencyRoot = process.env.SWARM_DEPENDENCIES;
const require = createRequire(
  dependencyRoot
    ? path.resolve(dependencyRoot, "package.json")
    : import.meta.url,
);
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
export default defineConfig({
  base: "./",
  plugins: [react.default()],
  resolve: dependencyRoot
    ? {
        alias: {
          "react-dom": path.join(dependencyRoot, "node_modules/react-dom"),
          react: path.join(dependencyRoot, "node_modules/react"),
          "lucide-react": path.join(
            dependencyRoot,
            "node_modules/lucide-react",
          ),
        },
      }
    : {},
  build: { sourcemap: false },
});
