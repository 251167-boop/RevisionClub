import path from "node:path";
const nextConfig = {
  distDir: process.env.CLUB_E2E === "1" ? ".next-e2e" : ".next",
  outputFileTracingRoot: path.resolve("."),
  serverExternalPackages: ["mysql2"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  poweredByHeader: false,
};
export default nextConfig;
