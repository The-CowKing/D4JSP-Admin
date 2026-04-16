/** @type {import('next').NextConfig} */

const TRADE_URL = process.env.NEXT_PUBLIC_TRADE_URL || 'https://trade.d4jsp.org';

const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],

  // Proxy all /api/admin/* calls to the main trade app.
  // AdminView.js fetch paths stay unchanged ('/api/admin/...');
  // Next.js server forwards them to trade.d4jsp.org including auth headers.
  async rewrites() {
    return [
      {
        source: '/api/admin/:path*',
        destination: `${TRADE_URL}/api/admin/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${TRADE_URL}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://isjkdbmfxpxuuloqosib.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzamtkYm1meHB4dXVsb3Fvc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDk4MDcsImV4cCI6MjA5MDIyNTgwN30.UdzV7PkGnEo0jgnViPzif13kaS88MeAnhHYsbbg2ugA',
    NEXT_PUBLIC_ADMIN_EMAIL: process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'adam87lewis@gmail.com',
    NEXT_PUBLIC_TRADE_URL: TRADE_URL,
  },
};

module.exports = nextConfig;
