/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
}

let finalConfig = nextConfig

try {
  const { default: withPWA } = await import('@ducanh2912/next-pwa')
  finalConfig = withPWA({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    exclude: [/^\/api\//],
  })(nextConfig)
} catch {
  // @ducanh2912/next-pwa not yet installed — skip PWA wrapping
}

export default finalConfig
