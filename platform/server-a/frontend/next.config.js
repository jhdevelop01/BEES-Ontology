const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./messages/**/*', './node_modules/next-intl/**/*', './node_modules/use-intl/**/*'],
    },
  },
}

module.exports = withNextIntl(nextConfig)
