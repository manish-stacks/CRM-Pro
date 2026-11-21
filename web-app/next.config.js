/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
  typescript: { ignoreBuildErrors: false },
  // Decoupled Backend Proxy: Forward API and Socket.io to standalone backend if BACKEND_API_URL is configured
  async rewrites() {
    if (process.env.BACKEND_API_URL) {
      const backendUrl = process.env.BACKEND_API_URL.replace(/\/+$/, '').replace(/\/api$/, '')
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
        {
          source: '/socket.io/:path*',
          destination: `${backendUrl}/socket.io/:path*`,
        },
      ]
    }
    return []
  },
}

module.exports = nextConfig
