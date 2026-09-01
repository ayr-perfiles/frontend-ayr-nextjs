import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // [E2E-HARNESS] (COLA #6, v6.90.0) — ADITIVO, y NO-OP sin la variable.
  //
  // `next dev` toma un lock exclusivo en `<distDir>/dev/lock`, así que el
  // harness de Playwright NO puede levantar su propio dev server mientras el
  // `next dev` del dueño esté vivo sobre este mismo repo (medido: PID 24748,
  // creado 30/08 16:17, respondiendo 200 en :3000 y :3001 — se verificó que
  // está VIVO, no zombie, y NO se lo mata: terminar el servidor de otra sesión
  // no corresponde, misma decisión que v6.52.0 ya tomó ante este mismo proceso).
  //
  // `next dev` no tiene flag `--dist-dir` (verificado en `next dev --help`,
  // v16.1.7) y no existe ninguna env var estándar equivalente, así que el
  // único punto donde esto se puede parametrizar es acá.
  //
  // El default es `.next`, byte-idéntico al comportamiento previo: ningún build
  // que no setee `AYR_E2E_DIST_DIR` cambia en nada. Solo el harness la setea.
  distDir: process.env.AYR_E2E_DIST_DIR || ".next",
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
