import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: '.next-nhn',
  experimental: {cpus: 1},
  serverExternalPackages: ['node:sqlite'],
  webpack(config,{webpack}) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/,path.resolve('lib/node-bindings.ts')));
    return config;
  },
};

export default nextConfig;
