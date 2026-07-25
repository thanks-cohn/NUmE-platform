import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const repositoryName = "NUmE-platform";
const basePath = isGitHubPages ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        output: "export" as const,
        trailingSlash: true,
        basePath,
        assetPrefix: `${basePath}/`,
        env: { NEXT_PUBLIC_BASE_PATH: basePath },
        images: {
          unoptimized: true,
        },
        typescript: {
          tsconfigPath: "./tsconfig.pages.json",
        },
      }
    : {}),
};

export default nextConfig;
