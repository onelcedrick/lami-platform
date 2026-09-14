/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next.js 16: images.domains deprecated -> remotePatterns
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/**" },
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/:path*`
          : "http://localhost:8000/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
