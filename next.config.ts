import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/admin/dashboard",
        destination: "/admin",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
