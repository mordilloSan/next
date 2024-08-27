/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: true,
        locale: false,
      },
    ];
  },
};

import withBundleAnalyzer from '@next/bundle-analyzer';

// Configure the bundle analyzer
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Export the configuration wrapped with bundle analyzer
export default bundleAnalyzer(nextConfig);
