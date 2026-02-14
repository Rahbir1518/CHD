import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // serverActions: true, // v14+ default
  },
  async rewrites() {
    return [
      {
        source: "/ws/:path*",
        destination: "http://127.0.0.1:8000/ws/:path*", // Proxy to Backend
      },
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/:path*", // Proxy API requests too (optional but good)
      }
    ];
  },
};

export default nextConfig;
