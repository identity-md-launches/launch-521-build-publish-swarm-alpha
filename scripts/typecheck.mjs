import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const dependencyRoot = process.env.SWARM_DEPENDENCIES;
const require = createRequire(
  dependencyRoot
    ? path.resolve(dependencyRoot, "package.json")
    : path.join(root, "package.json"),
);
let temp;
let project = path.join(root, "tsconfig.json");
if (dependencyRoot) {
  temp = await mkdtemp(path.join(tmpdir(), "swarm-typecheck-"));
  project = path.join(temp, "tsconfig.json");
  const modules = path.join(dependencyRoot, "node_modules");
  await writeFile(
    project,
    JSON.stringify({
      extends: path.join(root, "tsconfig.json"),
      compilerOptions: {
        baseUrl: modules,
        typeRoots: [path.join(modules, "@types")],
        paths: {
          react: [path.join(modules, "@types/react")],
          "react/*": [path.join(modules, "@types/react/*")],
          "react-dom/*": [path.join(modules, "@types/react-dom/*")],
          "lucide-react": [path.join(modules, "lucide-react")],
        },
      },
      include: [path.join(root, "src")],
    }),
  );
}
const result = spawnSync(
  process.execPath,
  [require.resolve("typescript/bin/tsc"), "--noEmit", "--project", project],
  { stdio: "inherit" },
);
if (temp) await rm(temp, { recursive: true, force: true });
process.exitCode = result.status ?? 1;
