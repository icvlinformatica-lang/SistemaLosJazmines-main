/** @type {import('next').NextConfig} */
import withPWA from '@ducanh2912/next-pwa'

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {},
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Evita que el navegador adivine el tipo MIME.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limita la info del referer enviada a otros sitios.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Fuerza HTTPS por 2 años (aplica solo en producción HTTPS).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Es una app interna de gestión: no debe embeberse en otros sitios (anti-clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Deshabilita funciones del navegador que la app no usa.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  exclude: [/^\/api\//],
})(nextConfig)
