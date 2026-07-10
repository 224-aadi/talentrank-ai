/** @type {import('next').NextConfig} */
const backendUrl = process.env.TALENTRANK_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const frontendOnly = process.env.TALENTRANK_FRONTEND_ONLY === "true";

const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  async rewrites() {
    if (!frontendOnly || !backendUrl) return [];
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
