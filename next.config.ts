import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/admin",
        permanent: false, // Usa 'true' solo si la raíz nunca tendrá contenido público
      },
    ];
  },
};

export default nextConfig;
