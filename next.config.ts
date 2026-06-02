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
      // Drywall redirects
      {
        source: "/admin/catalog",
        destination: "/admin/lines/drywall/catalog",
        permanent: true,
      },
      {
        source: "/admin/production",
        destination: "/admin/lines/drywall/production",
        permanent: true,
      },
      {
        source: "/admin/operator",
        destination: "/admin/lines/drywall/operator",
        permanent: true,
      },
      // Roofing redirects
      {
        source: "/admin/roofing/catalog",
        destination: "/admin/lines/roofing/catalog",
        permanent: true,
      },
      {
        source: "/admin/roofing/inventory",
        destination: "/admin/lines/roofing/inventory",
        permanent: true,
      },
      // Metallic Roofing redirects
      {
        source: "/admin/metallic-roofing/catalog",
        destination: "/admin/lines/metallic-roofing/catalog",
        permanent: true,
      },
      {
        source: "/admin/metallic-roofing",
        destination: "/admin/lines/metallic-roofing/inventory",
        permanent: true,
      },
      // Trading redirects
      {
        source: "/admin/trading/catalog",
        destination: "/admin/lines/trading/catalog",
        permanent: true,
      },
      {
        source: "/admin/trading/inventory",
        destination: "/admin/lines/trading/inventory",
        permanent: true,
      },
      // Services redirects
      {
        source: "/admin/services/catalog",
        destination: "/admin/lines/services/catalog",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
