/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Оптимизация изображений (для будущего использования Next/Image)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Пустая конфигурация Turbopack (использует дефолтные настройки)
  turbopack: {},
}

module.exports = nextConfig