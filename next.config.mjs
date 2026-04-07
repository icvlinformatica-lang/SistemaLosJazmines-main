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
}

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  exclude: [/^\/api\//],
})(nextConfig)
