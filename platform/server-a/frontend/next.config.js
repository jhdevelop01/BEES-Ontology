/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Phase 1에서는 라이트 모드만 지원
  reactStrictMode: true,
}

module.exports = nextConfig
