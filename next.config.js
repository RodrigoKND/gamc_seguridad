/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  // Fija la raíz del proyecto explícitamente: hay otro lockfile (bun.lock) en
  // una carpeta ancestral que hace que Next.js infiera mal el workspace root.
  outputFileTracingRoot: __dirname,
  experimental: {
    optimizePackageImports: ['lucide-react', 'leaflet', 'react-leaflet'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }, { protocol: 'http', hostname: '**' }],
    minimumCacheTTL: 60,
  },
  // Cabeceras de seguridad de línea base (aplican a todas las rutas). No se
  // incluye Content-Security-Policy todavía: el mapa carga teselas/tiles
  // externas configurables por variable de entorno (NEXT_PUBLIC_MAP_TILE_URL)
  // y una CSP estricta requiere probarse contra ese dominio antes de activarla.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;
