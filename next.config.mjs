/** @type {import('next').NextConfig} */
const backendUrl = process.env.TALENTRANK_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  async rewrites() {
    if (!backendUrl) return [];
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendUrl.replace(/\/$/, "")}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
