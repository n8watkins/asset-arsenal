import type { NextConfig } from "next";

// This app has its own lockfile inside the parent repo's app; pin the workspace root here so
// Turbopack and output tracing resolve against web/node_modules, not the parent's.
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
