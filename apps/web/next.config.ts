import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/downloads/IrminsulSync-Windows.zip",
        destination:
          "https://github.com/AditTempest25/WishCounter-GenshinImpact/releases/download/companion-v1.1.1/IrminsulSync-Windows.zip",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
