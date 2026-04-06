/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa'

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
}

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  exclude: [/^\/api\//],
})(nextConfig)
