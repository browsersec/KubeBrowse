import type { NextConfig } from "next";

const guacClient = process.env.GUAC_CLIENT_URL || 'https://localhost:4567'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/tunnel/:path*',
        destination: `${guacClient}/tunnel/:path*`
      },
      {
        source: '/test/:path*',
        destination: `${guacClient}/test/:path*`
      },
      {
        source: '/sessions/:path*',
        destination: `${guacClient}/sessions/:path*`
      }
    ]
  }
};

export default nextConfig;
