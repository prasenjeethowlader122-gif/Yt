import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@workspace/api-client-react', '@workspace/api-zod'],
  experimental: {
    externalDir: true,
  },
}

export default nextConfig
