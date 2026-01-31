import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile three.js related packages
  transpilePackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "@react-three/postprocessing",
  ],
  // Enable experimental features for better server-side handling
  experimental: {
    // Allow server actions with larger payloads for document uploads
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
