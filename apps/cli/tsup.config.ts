import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    bin: "src/bin.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Only apply the shebang to the bin entry
  onSuccess: async () => {
    const { chmod } = await import("fs/promises");
    await chmod("dist/bin.js", 0o755).catch(() => {});
  },
});
